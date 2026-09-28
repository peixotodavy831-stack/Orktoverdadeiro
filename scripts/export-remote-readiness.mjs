import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getPostgresConnection, invokePsql, isLoopbackHost } from './lib/postgres-cli.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');

function parseArguments(argv) {
  const result = { outputDirectory: '', confirmReadOnlyTarget: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--output-dir') result.outputDirectory = argv[++index] || '';
    else if (argv[index] === '--confirm-read-only-target') result.confirmReadOnlyTarget = true;
    else if (argv[index] === '--help' || argv[index] === '-h') result.help = true;
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return result;
}

function parseJsonOutput(output, label) {
  const line = String(output).split(/\r?\n/).map((value) => value.trim()).find((value) => value.startsWith('{'));
  if (!line) throw new Error(`${label} returned no JSON object.`);
  try { return JSON.parse(line); } catch (error) { throw new Error(`${label} returned invalid JSON: ${error.message}`); }
}

function validateInventory(inventory) {
  const required = [
    'schemas', 'tables', 'columns', 'types', 'constraints', 'indexes', 'policies',
    'grants', 'columnGrants', 'schemaGrants', 'defaultPrivileges', 'sequences',
    'sequenceGrants', 'functions', 'functionGrants', 'triggers', 'extensions',
  ];
  for (const section of required) {
    if (!Array.isArray(inventory?.[section])) throw new Error(`Remote schema inventory lacks '${section}'.`);
  }
  if (inventory.inventory_version !== 2 || typeof inventory.server_version_full !== 'string') {
    throw new Error('Remote inventory version/connection metadata is unsupported.');
  }
}

export async function exportRemoteReadiness({ outputDirectory, confirmReadOnlyTarget = false } = {}) {
  const connection = getPostgresConnection();
  if (!isLoopbackHost(connection.host) && !confirmReadOnlyTarget) {
    throw new Error('External PostgreSQL export is read-only but still requires --confirm-read-only-target after verifying the exact project in the database dashboard.');
  }
  if (!isLoopbackHost(connection.host) && !['require', 'verify-ca', 'verify-full'].includes(connection.sslmode || process.env.PGSSLMODE)) {
    throw new Error('Remote capture requires TLS: set sslmode=require (or verify-ca/verify-full) in the connection URL or PGSSLMODE.');
  }
  const outputPath = path.resolve(outputDirectory || path.join(os.tmpdir(), 'orkto-remote-readiness', new Date().toISOString().replaceAll(/[-:.]/g, '')));
  await mkdir(outputPath, { recursive: true });

  const inventory = parseJsonOutput(invokePsql({
    args: ['--quiet', '--tuples-only', '--no-align', '--file', path.join(repositoryRoot, 'supabase', 'tests', 'schema_inventory.sql')],
    connection,
    label: 'Remote read-only schema catalog query',
    cwd: repositoryRoot,
  }).stdout, 'Remote schema inventory');
  validateInventory(inventory);

  const ledger = parseJsonOutput(invokePsql({
    args: ['--quiet', '--tuples-only', '--no-align', '--file', path.join(repositoryRoot, 'supabase', 'tests', 'migration_ledger_inventory.sql')],
    connection,
    label: 'Remote read-only migration ledger query',
    cwd: repositoryRoot,
  }).stdout, 'Remote migration ledger');
  if (!Array.isArray(ledger.migrations)) throw new Error('Remote migration ledger inventory has no migrations array.');

  const capture = {
    capturedAt: new Date().toISOString(),
    source: { host: connection.host, database: connection.database },
    server: {
      version: inventory.server_version,
      versionNumber: inventory.server_version_num,
      fullVersion: inventory.server_version_full,
    },
    inventoryVersion: inventory.inventory_version,
    rowDataExported: false,
    migrationSqlExported: false,
    inventoryFile: 'schema-inventory.json',
    ledgerFile: 'migration-ledger.json',
  };

  await writeFile(path.join(outputPath, 'schema-inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outputPath, 'migration-ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outputPath, 'capture.json'), `${JSON.stringify(capture, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outputPath, 'capture.md'), [
    '# ORKTO remote readiness capture',
    '',
    `- Captured: ${capture.capturedAt}`,
    `- Host: \`${connection.host}\``,
    `- Database: \`${connection.database}\``,
    `- PostgreSQL: \`${inventory.server_version_full}\``,
    `- Migration ledger rows: ${ledger.migrations.length}`,
    '- Mode: read-only transaction; no migrations applied.',
    '- Data: no application rows or function bodies exported.',
    '- Auth gate: `MANUAL_AUTH_CONFIGURATION_REQUIRED` remains unchanged.',
    '',
  ].join('\n'), 'utf8');

  return { outputDirectory: outputPath, migrationCount: ledger.migrations.length, serverVersion: inventory.server_version_full };
}

const isDirectExecution = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectExecution) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write('Usage: node scripts/export-remote-readiness.mjs --confirm-read-only-target --output-dir <directory>\nUses catalog-only SELECTs inside read-only transactions; requires PG* or ORKTO_DATABASE_URL/DATABASE_URL.\n');
    } else {
      const result = await exportRemoteReadiness(options);
      process.stdout.write(`Read-only capture written to ${result.outputDirectory}; ${result.migrationCount} migration ledger rows; PostgreSQL ${result.serverVersion}.\n`);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
