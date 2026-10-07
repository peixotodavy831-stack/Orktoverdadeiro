import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assertMigrationTargetAllowed,
  getPostgresConnection,
  invokePsql,
} from './lib/postgres-cli.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');

function parseArguments(argv) {
  const result = {
    target: process.env.ORKTO_MIGRATION_TARGET || '',
    evidenceDirectory: process.env.ORKTO_MIGRATION_EVIDENCE_DIR || '',
    expectedCount: Number(process.env.ORKTO_EXPECTED_MIGRATION_COUNT || 28),
    fixturePath: '', startAfter: '', candidatePath: '', preAssertionPath: '', securityAssertionPath: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--target') result.target = argv[++index] || '';
    else if (argument === '--evidence-dir') result.evidenceDirectory = argv[++index] || '';
    else if (argument === '--expected-count') result.expectedCount = Number(argv[++index]);
    else if (argument === '--fixture') result.fixturePath = argv[++index] || '';
    else if (argument === '--start-after') result.startAfter = argv[++index] || '';
    else if (argument === '--candidate') result.candidatePath = argv[++index] || '';
    else if (argument === '--pre-assertion') result.preAssertionPath = argv[++index] || '';
    else if (argument === '--security-assertion') result.securityAssertionPath = argv[++index] || '';
    else if (argument === '--help' || argument === '-h') result.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return result;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function now() {
  return new Date().toISOString();
}

function escapeMarkdown(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function assertInventory(inventory) {
  const required = [
    'schemas', 'tables', 'columns', 'types', 'constraints', 'indexes', 'policies',
    'grants', 'columnGrants', 'schemaGrants', 'defaultPrivileges', 'sequences',
    'sequenceGrants', 'functions', 'functionGrants', 'triggers', 'extensions',
  ];
  for (const section of required) {
    if (!Array.isArray(inventory?.[section])) {
      throw new Error(`Target schema inventory is missing array section '${section}'.`);
    }
  }
  if (inventory.inventory_version !== 2 || typeof inventory.server_version_full !== 'string') {
    throw new Error('Target schema inventory does not contain the expected version/server metadata.');
  }
}

async function readMigrations(expectedCount) {
  const directory = path.join(repositoryRoot, 'supabase', 'migrations');
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const seen = new Set();
  const migrations = [];

  for (const name of files) {
    const match = name.match(/^(\d{14})_.+\.sql$/);
    if (!match) throw new Error(`Migration filename must start with a unique 14-digit timestamp: ${name}`);
    if (seen.has(match[1])) throw new Error(`Duplicate migration version detected: ${match[1]}`);
    seen.add(match[1]);
    const filePath = path.join(directory, name);
    const contents = await readFile(filePath);
    migrations.push({
      name,
      version: match[1],
      path: filePath,
      sha256: sha256(contents),
      status: 'NOT_RUN',
      startedAt: null,
      endedAt: null,
      error: null,
    });
  }

  if (migrations.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} timestamped local migrations, found ${migrations.length}.`);
  }
  const versions = migrations.map(({ version }) => version);
  if (versions.some((version, index) => index > 0 && version <= versions[index - 1])) {
    throw new Error('Migrations are not in unique deterministic timestamp order.');
  }

  for (const migration of migrations) {
    const sql = await readFile(migration.path, 'utf8');
    if (/(?:CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?pg_cron|cron\.schedule\s*\()/i.test(sql)) {
      throw new Error(`Core migration ${migration.name} depends on pg_cron; scheduler installation must remain separate.`);
    }
  }
  return migrations;
}

function parseJsonOutput(output, label) {
  const jsonLine = String(output).split(/\r?\n/).map((line) => line.trim()).find((line) => line.startsWith('{'));
  if (!jsonLine) throw new Error(`${label} returned no JSON object.`);
  try {
    return JSON.parse(jsonLine);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error.message}`);
  }
}

export async function validateMigrations({
  target,
  evidenceDirectory,
  expectedCount = 28,
  fixturePath = '', startAfter = '', candidatePath = '', preAssertionPath = '', securityAssertionPath = '',
} = {}) {
  const runId = `migration-replay-${new Date().toISOString().replaceAll(/[-:.]/g, '').replace('Z', 'Z')}-${Math.random().toString(16).slice(2, 10)}`;
  const evidencePath = path.resolve(evidenceDirectory || path.join(os.tmpdir(), 'orkto-production-readiness', runId));
  await mkdir(evidencePath, { recursive: true });
  const logPath = path.join(evidencePath, 'full-validation.log');
  const inventoryPath = path.join(evidencePath, 'target-schema-inventory.json');
  const resultJsonPath = path.join(evidencePath, 'result.json');
  const resultMarkdownPath = path.join(evidencePath, 'result.md');
  const startedAt = now();
  const migrations = [];
  const assertions = [
    { name: 'RLS and browser grants', status: 'NOT_RUN' },
    { name: 'workspace memberships and legacy backfills', status: 'NOT_RUN' },
    { name: 'tenant A/B isolation and cross-tenant constraints', status: 'NOT_RUN' },
    { name: 'constraints, foreign keys, and indexes', status: 'NOT_RUN' },
    { name: 'legacy rows and trigger restoration', status: 'NOT_RUN' },
    { name: 'Starter active proposal limit: fixture 1 + 4 = 5; next rejected', status: 'NOT_RUN' },
    { name: 'Scale entitlement and expired-trial rejection', status: 'NOT_RUN' },
  ];
  const logLines = [];
  let phase = 'REPOSITORY_PREFLIGHT';
  let status = 'FAIL';
  let failure = null;
  let serverVersion = null;
  let connectionSummary = null;
  let migrationsApplied = 0;
  let candidateStatus = candidatePath ? 'NOT_RUN' : 'NOT_APPLICABLE';
  let securityStatus = securityAssertionPath ? 'NOT_RUN' : 'NOT_APPLICABLE';

  const log = (message) => {
    const line = `[${now()}] ${message}`;
    logLines.push(line);
    process.stdout.write(`${line}\n`);
  };

  const invokePsqlAndLog = (options) => {
    const result = invokePsql(options);
    for (const [streamName, value] of [['stdout', result.stdout], ['stderr', result.stderr]]) {
      for (const line of String(value || '').split(/\r?\n/).filter(Boolean)) {
        log(`${options.label} ${streamName}: ${line}`);
      }
    }
    return result;
  };

  const writeEvidence = async () => {
    const result = {
      runId,
      status,
      phase,
      startedAt,
      endedAt: now(),
      target,
      postgres: serverVersion,
      connection: connectionSummary,
      expectedMigrationCount: expectedCount,
      discoveredMigrationCount: migrations.length,
      appliedMigrationCount: migrationsApplied,
      startAfter, candidateStatus, securityStatus,
      migrations: migrations.map(({ path: _path, ...entry }) => entry),
      assertions,
      inventory: status === 'PASS' ? path.basename(inventoryPath) : null,
      inventorySha256: status === 'PASS' ? sha256(await readFile(inventoryPath)) : null,
      remoteComparison: 'NOT_EVALUATED_IN_REPLAY',
      authGate: 'MANUAL_AUTH_CONFIGURATION_REQUIRED',
      failure,
    };
    await writeFile(logPath, `${logLines.join('\n')}\n`, 'utf8');
    await writeFile(resultJsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    const report = [
      '# ORKTO migration replay evidence',
      '',
      `- Run: \`${runId}\``,
      `- Target: \`${target || 'UNSPECIFIED'}\``,
      `- Status: **${status}**`,
      `- Phase: \`${phase}\``,
      `- PostgreSQL: \`${serverVersion?.server_version_full || 'not captured'}\``,
      `- Migrations: ${migrationsApplied}/${expectedCount}`,
      '- Auth gate: `MANUAL_AUTH_CONFIGURATION_REQUIRED`',
      '- Remote diff: `NOT_EVALUATED_IN_REPLAY`',
      `- Full log: \`${path.basename(logPath)}\``,
      '',
      '## Migration results',
      '',
      '| Version | File | SHA-256 | Result |',
      '| --- | --- | --- | --- |',
      ...migrations.map((entry) => `| ${entry.version} | \`${escapeMarkdown(entry.name)}\` | \`${entry.sha256}\` | ${entry.status} |`),
      '',
      '## Assertions',
      '',
      '| Assertion | Result |',
      '| --- | --- |',
      ...assertions.map((entry) => `| ${escapeMarkdown(entry.name)} | ${entry.status} |`),
      ...(failure ? ['', '## Failure', '', `\`${phase}\`: ${failure}`] : []),
      ...(status === 'PASS' ? ['', `Target inventory: \`${path.basename(inventoryPath)}\``, `Inventory SHA-256: \`${result.inventorySha256}\``] : []),
      '',
    ].join('\n');
    await writeFile(resultMarkdownPath, report, 'utf8');
    return result;
  };

  try {
    if (!['ci', 'local', 'staging'].includes(target)) {
      throw new Error('Set --target to ci, local, or staging.');
    }
    const migrationList = await readMigrations(expectedCount);
    if (startAfter && !migrationList.some((migration) => migration.version === startAfter)) {
      throw new Error(`Unknown --start-after migration version: ${startAfter}`);
    }
    migrations.push(...migrationList.filter((migration) => !startAfter || migration.version > startAfter));
    log(`Repository migration preflight passed: ${migrationList.length}/${expectedCount} timestamped files; ${migrations.length} selected.`);

    phase = 'POSTGRES_PREFLIGHT';
    const connection = getPostgresConnection();
    assertMigrationTargetAllowed(target, connection);
    connectionSummary = { host: connection.host, port: String(connection.port), user: connection.user, database: connection.database };
    log(`Connecting to target=${target}, host=${connection.host}, database=${connection.database}; credentials are not logged.`);

    const preflightSql = `select jsonb_build_object(
      'server_version', current_setting('server_version'),
      'server_version_num', current_setting('server_version_num')::integer,
      'server_version_full', version(),
      'database', current_database(),
      'current_user', current_user,
      'is_superuser', (select rolsuper from pg_roles where rolname=current_user),
      'can_create_roles', (select rolcreaterole from pg_roles where rolname=current_user),
      'can_create_database_objects', has_database_privilege(current_user, current_database(), 'CREATE'),
      'application_object_count', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where left(n.nspname,3)<>'pg_' and n.nspname<>'information_schema' and c.relkind in ('r','p','v','m','f','S')),
      'non_public_user_schemas', (select count(*) from pg_namespace where left(nspname,3)<>'pg_' and nspname not in ('information_schema','public')),
      'non_builtin_extensions', (select coalesce(jsonb_agg(extname order by extname), '[]'::jsonb) from pg_extension where extname<>'plpgsql'),
      'custom_function_count', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where left(n.nspname,3)<>'pg_' and n.nspname<>'information_schema' and p.prokind in ('f','p'))
    );`;
    const preflight = parseJsonOutput(invokePsql({
      args: ['--quiet', '--tuples-only', '--no-align', '--command', preflightSql],
      connection,
      label: 'PostgreSQL read-only preflight',
      cwd: repositoryRoot,
    }).stdout, 'PostgreSQL read-only preflight');
    serverVersion = {
      server_version: preflight.server_version,
      server_version_num: preflight.server_version_num,
      server_version_full: preflight.server_version_full,
    };
    const major = Math.floor(Number(preflight.server_version_num) / 10000);
    if (major !== 17) throw new Error(`PostgreSQL 17 is required for the migration runner; found ${preflight.server_version_full}.`);
    if (Number(preflight.application_object_count) !== 0) {
      throw new Error(`Refusing non-empty target database: found ${preflight.application_object_count} relation/sequence objects before fixture load.`);
    }
    if (Number(preflight.non_public_user_schemas) !== 0 || Number(preflight.custom_function_count) !== 0) {
      throw new Error('Refusing target with pre-existing user schemas or functions. The replay requires an empty, disposable vanilla PostgreSQL database; Supabase-managed auth/storage databases are not fixture targets.');
    }
    if (Array.isArray(preflight.non_builtin_extensions) && preflight.non_builtin_extensions.length > 0) {
      throw new Error(`Refusing target with pre-installed non-default extensions: ${preflight.non_builtin_extensions.join(', ')}.`);
    }
    if (!preflight.is_superuser) {
      throw new Error('The replay requires a PostgreSQL superuser on the disposable database (fixture roles, extensions, and transactional trigger assertions).');
    }
    if (!preflight.can_create_database_objects) {
      throw new Error('The replay role cannot create objects in the target database.');
    }
    log(`PostgreSQL exact version: ${preflight.server_version_full}`);
    log('Target safety preflight passed: PostgreSQL 17, vanilla and empty; no migration SQL has run yet.');

    phase = 'LOAD_LEGACY_FIXTURE';
    fixturePath = fixturePath ? path.resolve(fixturePath) : path.join(repositoryRoot, 'supabase', 'tests', 'fixtures', 'legacy_schema.sql');
    invokePsqlAndLog({
      args: ['--single-transaction', '--file', fixturePath],
      connection,
      label: 'Legacy fixture load',
      cwd: repositoryRoot,
    });
    log('Legacy fixture loaded in a transaction.');

    phase = 'MIGRATION_REPLAY';
    for (const migration of migrations) {
      migration.status = 'RUNNING';
      migration.startedAt = now();
      try {
        invokePsqlAndLog({
          args: ['--single-transaction', '--file', migration.path],
          connection,
          label: `Migration ${migration.version} (${migration.name})`,
          cwd: repositoryRoot,
        });
        migration.status = 'PASS';
        migrationsApplied += 1;
        log(`PASS migration ${migration.version} (${migration.sha256.slice(0, 12)}…).`);
      } catch (error) {
        migration.status = 'FAIL';
        migration.error = error.message;
        throw error;
      } finally {
        migration.endedAt = now();
      }
    }

    if (candidatePath) {
      phase = 'SECURITY_CANDIDATE';
      invokePsqlAndLog({
        args: ['--single-transaction', '--file', path.resolve(candidatePath)],
        connection, label: 'Security candidate (draft)', cwd: repositoryRoot,
      });
      candidateStatus = 'PASS';
    }

    if (preAssertionPath) {
      phase = 'BASELINE_COMPENSATION_ASSERTION';
      invokePsqlAndLog({
        args: ['--single-transaction', '--file', path.resolve(preAssertionPath)],
        connection, label: 'Baseline-specific assertion/compensation', cwd: repositoryRoot,
      });
    }

    phase = 'SQL_ASSERTIONS';
    const assertionFiles = [
      ['assert_local_migrations.sql', assertions.slice(0, 5), true],
      ['assert_readiness.sql', assertions.slice(5), false],
    ];
    for (const [filename, assertionGroup, rollbackAfterSuccess] of assertionFiles) {
      invokePsqlAndLog({
        args: [...(rollbackAfterSuccess ? ['--single-transaction'] : []), '--file', path.join(repositoryRoot, 'supabase', 'tests', filename)],
        connection,
        label: `SQL assertions (${filename})`,
        cwd: repositoryRoot,
      });
      assertionGroup.forEach((assertion) => { assertion.status = 'PASS'; });
      log(`PASS SQL assertions ${filename}.`);
    }

    if (securityAssertionPath) {
      phase = 'SECURITY_ASSERTIONS';
      invokePsqlAndLog({
        args: ['--single-transaction', '--file', path.resolve(securityAssertionPath)],
        connection, label: 'Security contract and negative assertions', cwd: repositoryRoot,
      });
      securityStatus = 'PASS';
    }

    phase = 'TARGET_SCHEMA_INVENTORY';
    const inventoryOutput = invokePsql({
      args: ['--quiet', '--tuples-only', '--no-align', '--file', path.join(repositoryRoot, 'supabase', 'tests', 'schema_inventory.sql')],
      connection,
      label: 'Read-only target schema inventory',
      cwd: repositoryRoot,
    }).stdout;
    const inventory = parseJsonOutput(inventoryOutput, 'Target schema inventory');
    assertInventory(inventory);
    await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
    status = 'PASS';
    log(`PASS: ${migrationsApplied}/${migrations.length} selected migrations and all SQL assertions; target inventory exported without row data.`);
  } catch (error) {
    failure = error.message;
    status = phase === 'POSTGRES_PREFLIGHT' ? 'BLOCKED_ENVIRONMENT' : 'FAIL';
    log(`${status} at ${phase}: ${failure}`);
  }

  const result = await writeEvidence();
  process.stdout.write(`Evidence: ${evidencePath}\n`);
  return result;
}

function showHelp() {
  process.stdout.write([
    'Usage: node scripts/validate-migrations.mjs --target <ci|local|staging> [--evidence-dir PATH] [--expected-count 28]',
    'Requires a disposable, empty PostgreSQL 17 database. The shared runner loads the legacy fixture, replays migrations, runs assertions, and exports catalog-only inventory.',
    'For staging, additionally require an explicit disposable-database acknowledgment and exact expected host. Never point this command at production.',
  ].join('\n') + '\n');
}

const isDirectExecution = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectExecution) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) showHelp();
    else {
      const result = await validateMigrations(options);
      if (result.status !== 'PASS') process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
