import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY_IDENTITIES = {
  schemas: (value) => [value],
  tables: (value) => [value.schema, value.name],
  columns: (value) => [value.schema, value.table, value.name],
  types: (value) => [value.schema, value.name],
  constraints: (value) => [value.schema, value.table, value.name],
  indexes: (value) => [value.schema, value.name],
  policies: (value) => [value.schema, value.table, value.name],
  grants: (value) => [value.schema, value.table, value.grantee, value.privilege],
  columnGrants: (value) => [value.schema, value.table, value.column, value.grantee, value.privilege],
  schemaGrants: (value) => [value.schema, value.grantee, value.privilege],
  defaultPrivileges: (value) => [value.owner, value.schema || '', value.object_type, value.grantee, value.privilege],
  sequences: (value) => [value.schema, value.name],
  sequenceGrants: (value) => [value.schema, value.sequence, value.grantee, value.privilege],
  functions: (value) => [value.schema, value.name, value.identity],
  functionGrants: (value) => [value.schema, value.function, value.identity, value.grantee, value.privilege],
  triggers: (value) => [value.schema, value.table, value.name],
  extensions: (value) => [value.schema, value.name],
};

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function canonical(value) {
  return JSON.stringify(stableValue(value));
}

function identityFor(section, value) {
  const identify = INVENTORY_IDENTITIES[section];
  if (!identify) return null;
  const parts = identify(value);
  if (!Array.isArray(parts) || parts.some((part) => part === null || part === undefined || String(part) === '')) return null;
  return `${section}:${parts.map((part) => String(part).replaceAll(':', '\\:')).join(':')}`;
}

function getObjects(inventory, section) {
  if (section === 'schemas') {
    return inventory.schemas.map((name) => ({ key: identityFor(section, name), value: name }));
  }
  return inventory[section].map((value) => ({ key: identityFor(section, value), value }));
}

function classifyObjects(targetInventory, remoteInventory, expectedPendingKeys = []) {
  const expected = new Set(expectedPendingKeys);
  const differences = [];
  const unknowns = [];
  if (targetInventory?.inventory_version !== 2 || remoteInventory?.inventory_version !== 2) {
    unknowns.push({
      key: 'inventory:version',
      status: 'UNKNOWN',
      reason: `Unsupported or mismatched inventory versions (target=${targetInventory?.inventory_version ?? 'missing'}, remote=${remoteInventory?.inventory_version ?? 'missing'}); regenerate both captures with the same exporter.`,
    });
  }

  for (const section of Object.keys(INVENTORY_IDENTITIES)) {
    if (!Array.isArray(targetInventory?.[section]) || !Array.isArray(remoteInventory?.[section])) {
      unknowns.push({ key: `${section}:*`, status: 'UNKNOWN', reason: `Required inventory section '${section}' is missing or not an array.` });
      continue;
    }
    const targetItems = getObjects(targetInventory, section);
    const remoteItems = getObjects(remoteInventory, section);
    const targetMap = new Map();
    const remoteMap = new Map();

    for (const item of targetItems) {
      if (!item.key) {
        unknowns.push({ key: `${section}:<invalid-target-object>`, status: 'UNKNOWN', reason: 'Target object has incomplete identity fields.' });
      } else if (targetMap.has(item.key)) {
        unknowns.push({ key: item.key, status: 'UNKNOWN', reason: 'Target inventory contains duplicate identities.' });
      } else targetMap.set(item.key, item.value);
    }
    for (const item of remoteItems) {
      if (!item.key) {
        unknowns.push({ key: `${section}:<invalid-remote-object>`, status: 'UNKNOWN', reason: 'Remote object has incomplete identity fields.' });
      } else if (remoteMap.has(item.key)) {
        unknowns.push({ key: item.key, status: 'UNKNOWN', reason: 'Remote inventory contains duplicate identities.' });
      } else remoteMap.set(item.key, item.value);
    }

    const keys = new Set([...targetMap.keys(), ...remoteMap.keys()]);
    for (const key of keys) {
      const hasTarget = targetMap.has(key);
      const hasRemote = remoteMap.has(key);
      if (hasTarget && hasRemote) {
        differences.push(canonical(targetMap.get(key)) === canonical(remoteMap.get(key))
          ? { key, status: 'MATCH' }
          : { key, status: 'DIVERGENT', target: targetMap.get(key), remote: remoteMap.get(key) });
      } else if (hasTarget && expected.has(key)) {
        differences.push({ key, status: 'EXPECTED_PENDING' });
      } else if (hasTarget) {
        differences.push({ key, status: 'LOCAL_ONLY' });
      } else differences.push({ key, status: 'REMOTE_ONLY' });
    }
  }

  return [...differences, ...unknowns].sort((left, right) => left.key.localeCompare(right.key));
}

function checksum(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function readLocalMigrations(directory = path.join(repositoryRoot, 'supabase', 'migrations')) {
  const names = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const result = [];
  for (const name of names) {
    const match = name.match(/^(\d{14})_(.+)\.sql$/);
    if (!match) throw new Error(`Invalid local migration file name: ${name}`);
    result.push({ version: match[1], name: match[2], file: name, sha256: checksum(await readFile(path.join(directory, name))) });
  }
  if (new Set(result.map(({ version }) => version)).size !== result.length) throw new Error('Local migration directory contains duplicate versions.');
  return result;
}

export function compareLedgers(localMigrations, remoteLedger) {
  if (!Array.isArray(localMigrations) || !Array.isArray(remoteLedger?.migrations)) {
    return [{ key: 'migration-ledger:*', status: 'UNKNOWN', reason: 'Local or remote migration ledger is missing/invalid.' }];
  }
  const localMap = new Map(localMigrations.map((migration) => [String(migration.version), migration]));
  const remoteMap = new Map();
  const differences = [];
  for (const migration of remoteLedger.migrations) {
    const version = String(migration?.version || '');
    if (!/^\d{14}$/.test(version)) {
      differences.push({ key: `migration-ledger:${version || '<missing-version>'}`, status: 'UNKNOWN', reason: 'Remote ledger contains an invalid migration version.' });
      continue;
    }
    if (remoteMap.has(version)) {
      differences.push({ key: `migration-ledger:${version}`, status: 'UNKNOWN', reason: 'Remote ledger contains duplicate versions.' });
      continue;
    }
    remoteMap.set(version, migration);
  }

  const remoteVersions = [...remoteMap.keys()].sort();
  const localVersions = [...localMap.keys()].sort();
  const maxRemoteVersion = remoteVersions.at(-1) || '';
  const isRemotePrefix = remoteVersions.every((version, index) => localVersions[index] === version);

  for (const version of new Set([...localMap.keys(), ...remoteMap.keys()])) {
    const local = localMap.get(version);
    const remote = remoteMap.get(version);
    const key = `migration-ledger:${version}`;
    if (local && remote) {
      const localName = local.name || local.file?.replace(/^\d{14}_/, '').replace(/\.sql$/, '');
      const remoteName = remote.name;
      const checksumStatus = remote.sha256
        ? (remote.sha256 === local.sha256 ? 'VERIFIED_MATCH' : 'CHECKSUM_DIVERGENT')
        : 'UNVERIFIED_FROM_REMOTE_LEDGER';
      if (remoteName && localName && remoteName !== localName) {
        differences.push({ key, status: 'DIVERGENT', localName, remoteName, sqlChecksum: checksumStatus });
      } else if (checksumStatus === 'CHECKSUM_DIVERGENT') {
        differences.push({ key, status: 'DIVERGENT', localName, remoteName: remoteName || null, sqlChecksum: checksumStatus });
      } else {
        differences.push({ key, status: 'MATCH', localName, remoteName: remoteName || null, sqlChecksum: checksumStatus });
      }
    } else if (local && isRemotePrefix && version > maxRemoteVersion) {
      differences.push({ key, status: 'EXPECTED_PENDING', localName: local.name || local.file, remoteName: null });
    } else if (local) {
      differences.push({ key, status: 'LOCAL_ONLY', localName: local.name || local.file, remoteName: null });
    } else {
      differences.push({ key, status: 'REMOTE_ONLY', localName: null, remoteName: remote?.name || null });
    }
  }
  return differences.sort((left, right) => left.key.localeCompare(right.key));
}

export function comparePostgresVersions(targetInventory, remoteInventory) {
  const targetNumber = Number(targetInventory?.server_version_num);
  const remoteNumber = Number(remoteInventory?.server_version_num);
  const targetVersion = targetInventory?.server_version;
  const remoteVersion = remoteInventory?.server_version;
  if (!Number.isFinite(targetNumber) || !Number.isFinite(remoteNumber)) {
    return { status: 'UNKNOWN', target: targetInventory?.server_version_full || null, remote: remoteInventory?.server_version_full || null, requiresManualReview: true };
  }
  const targetMajor = Math.floor(targetNumber / 10000);
  const remoteMajor = Math.floor(remoteNumber / 10000);
  if (targetMajor !== remoteMajor) {
    return { status: 'MAJOR_MISMATCH', target: targetInventory.server_version_full, remote: remoteInventory.server_version_full, requiresManualReview: true };
  }
  if (targetNumber !== remoteNumber) {
    return { status: 'MINOR_VERSION_REVIEW', target: targetVersion || targetInventory.server_version_full, remote: remoteVersion || remoteInventory.server_version_full, requiresManualReview: true };
  }
  if (typeof targetVersion !== 'string' || typeof remoteVersion !== 'string') {
    return { status: 'UNKNOWN', target: targetVersion || null, remote: remoteVersion || null, requiresManualReview: true };
  }
  if (targetVersion !== remoteVersion) {
    return { status: 'PATCH_VERSION_REVIEW', target: targetVersion, remote: remoteVersion, requiresManualReview: true };
  }
  return { status: 'MATCH', target: targetVersion, remote: remoteVersion, requiresManualReview: false };
}

export function buildReadinessDiff({ targetInventory, remoteInventory, localMigrations, remoteLedger, expectedPendingKeys = [] }) {
  const migrationLedgerDiff = compareLedgers(localMigrations, remoteLedger);
  const schemaObjectDiff = classifyObjects(targetInventory, remoteInventory, expectedPendingKeys);
  const postgresVersion = comparePostgresVersions(targetInventory, remoteInventory);
  const blockingStatuses = new Set(['LOCAL_ONLY', 'REMOTE_ONLY', 'DIVERGENT', 'UNKNOWN']);
  const unresolvedLedger = migrationLedgerDiff.some((item) => blockingStatuses.has(item.status));
  const unresolvedSchema = schemaObjectDiff.some((item) => blockingStatuses.has(item.status));
  const staging = unresolvedLedger || unresolvedSchema || postgresVersion.status === 'MAJOR_MISMATCH' || postgresVersion.status === 'UNKNOWN'
    ? 'BLOCKED_UNEXPLAINED_DIFFS'
    : ['MINOR_VERSION_REVIEW', 'PATCH_VERSION_REVIEW'].includes(postgresVersion.status)
      ? 'REVIEW_REQUIRED_FOR_POSTGRES_VERSION'
      : 'EXPLAINED';

  return {
    generatedAt: new Date().toISOString(),
    status: staging,
    migrationLedgerDiff,
    schemaObjectDiff,
    postgresVersion,
    summary: {
      migrationLedger: countStatuses(migrationLedgerDiff),
      schemaObjects: countStatuses(schemaObjectDiff),
      targetVersion: targetInventory?.server_version_full || null,
      remoteVersion: remoteInventory?.server_version_full || null,
      overlappingMigrationSqlChecksums: migrationLedgerDiff.filter((item) => item.sqlChecksum === 'UNVERIFIED_FROM_REMOTE_LEDGER').length,
      unknownBlocksStaging: migrationLedgerDiff.some((item) => item.status === 'UNKNOWN') || schemaObjectDiff.some((item) => item.status === 'UNKNOWN'),
      authGate: 'MANUAL_AUTH_CONFIGURATION_REQUIRED',
    },
  };
}

function countStatuses(items) {
  return Object.fromEntries(['MATCH', 'EXPECTED_PENDING', 'REMOTE_ONLY', 'LOCAL_ONLY', 'DIVERGENT', 'UNKNOWN'].map((status) => [
    status,
    items.filter((item) => item.status === status).length,
  ]));
}

async function loadJson(filePath, label) {
  try { return JSON.parse(await readFile(filePath, 'utf8')); } catch (error) { throw new Error(`Unable to read ${label} (${filePath}): ${error.message}`); }
}

async function parseArguments(argv) {
  const options = { expectedPending: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--target-inventory') options.targetInventoryPath = argv[++index];
    else if (argument === '--remote-inventory') options.remoteInventoryPath = argv[++index];
    else if (argument === '--remote-ledger') options.remoteLedgerPath = argv[++index];
    else if (argument === '--local-migrations') options.localMigrationsPath = argv[++index];
    else if (argument === '--expected-pending') options.expectedPendingPath = argv[++index];
    else if (argument === '--output') options.outputPath = argv[++index];
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.help) return options;
  for (const [key, label] of [['targetInventoryPath', '--target-inventory'], ['remoteInventoryPath', '--remote-inventory'], ['remoteLedgerPath', '--remote-ledger'], ['outputPath', '--output']]) {
    if (!options[key]) throw new Error(`Required option is missing: ${label}`);
  }
  const targetInventory = await loadJson(options.targetInventoryPath, 'target inventory');
  const remoteInventory = await loadJson(options.remoteInventoryPath, 'remote inventory');
  const remoteLedger = await loadJson(options.remoteLedgerPath, 'remote migration ledger');
  const localMigrations = await readLocalMigrations(options.localMigrationsPath);
  if (options.expectedPendingPath) {
    const manifest = await loadJson(options.expectedPendingPath, 'expected-pending manifest');
    if (!Array.isArray(manifest.expectedPending)) throw new Error('Expected-pending manifest must contain an expectedPending string array.');
    options.expectedPending = manifest.expectedPending;
  }
  options.diff = buildReadinessDiff({ targetInventory, remoteInventory, localMigrations, remoteLedger, expectedPendingKeys: options.expectedPending });
  return options;
}

const isDirectExecution = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectExecution) {
  try {
    const options = await parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write([
        'Usage: node scripts/compare-readiness-inventories.mjs --target-inventory target.json --remote-inventory remote.json --remote-ledger ledger.json --output diff.json [--expected-pending manifest.json]',
        'The expected-pending manifest shape is {"expectedPending":["tables:public.example", ...]} and must be reviewed explicitly.',
        'Only MATCH/EXPECTED_PENDING are explained. LOCAL_ONLY, REMOTE_ONLY, DIVERGENT, or UNKNOWN block staging.',
      ].join('\n') + '\n');
    } else {
      const outputPath = path.resolve(options.outputPath);
      await writeFile(outputPath, `${JSON.stringify(options.diff, null, 2)}\n`, 'utf8');
      process.stdout.write(`${options.diff.status}: migration ledger ${JSON.stringify(options.diff.summary.migrationLedger)}; schema objects ${JSON.stringify(options.diff.summary.schemaObjects)}; output=${outputPath}\n`);
      if (options.diff.status === 'BLOCKED_UNEXPLAINED_DIFFS') process.exitCode = 2;
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
