import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evaluateStagingMigrationGate, TARGET_MIGRATION_COUNT } from './staging-migration-gate.mjs';

function parseArgs(argv) {
  const args = { captureDir: process.env.ORKTO_STAGING_READINESS_CAPTURE_DIR || '' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--capture-dir') args.captureDir = argv[++index] || '';
    else if (argv[index] === '--help' || argv[index] === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return args;
}

export async function checkStagingMigrationGate(captureDir) {
  if (!captureDir) return { status: 'CONFIGURATION_REQUIRED', code: 'REMOTE_LEDGER_CAPTURE_REQUIRED', expected: TARGET_MIGRATION_COUNT };
  const directory = path.resolve(captureDir);
  let capture;
  let ledger;
  try {
    [capture, ledger] = await Promise.all([
      readFile(path.join(directory, 'capture.json'), 'utf8').then(JSON.parse),
      readFile(path.join(directory, 'migration-ledger.json'), 'utf8').then(JSON.parse),
    ]);
  } catch {
    return { status: 'CONFIGURATION_REQUIRED', code: 'REMOTE_LEDGER_CAPTURE_REQUIRED', expected: TARGET_MIGRATION_COUNT };
  }
  return evaluateStagingMigrationGate({ capture, ledger });
}

const isDirectExecution = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectExecution) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write('Usage: node scripts/readiness/check-staging-migration-gate.mjs --capture-dir <fresh-read-only-capture>\n');
    } else {
      const result = await checkStagingMigrationGate(args.captureDir);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (result.status !== 'PASS') process.exitCode = 2;
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
