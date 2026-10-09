import path from 'node:path';
import { checkStagingMigrationGate } from './check-staging-migration-gate.mjs';

export const STAGING_TARGET = Object.freeze({
  appEnv: 'staging',
  vercelProjectId: 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc',
  supabaseRef: 'ghrjongiodziasupakrk',
  supabaseUrl: 'https://ghrjongiodziasupakrk.supabase.co',
  migrationCount: 35,
});

export function evaluateStagingPreflight(env, migrationGate) {
  const checks = {
    appEnv: env.APP_ENV === STAGING_TARGET.appEnv && env.VITE_APP_ENV === STAGING_TARGET.appEnv,
    vercelProject: env.VERCEL_PROJECT_ID === STAGING_TARGET.vercelProjectId
      && env.ORKTO_STAGING_VERCEL_PROJECT_ID === STAGING_TARGET.vercelProjectId,
    supabaseProject: String(env.VITE_SUPABASE_URL || '').replace(/\/$/, '') === STAGING_TARGET.supabaseUrl,
    noElevatedPreviewKey: !String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
      && !String(env.STAGING_SERVICE_ROLE_KEY_SHA256 || '').trim(),
    legalFlagsOff: env.COLLECTIVE_MEMORY_CROSS_WORKSPACE === 'OFF' && env.PUBLIC_CASE_PUBLICATION === 'OFF',
    mockRoutesOff: env.ORKTO_ENABLE_MOCK_ROUTES !== 'true' && env.ORKTO_ENABLE_DEMO_LOGIN !== 'true',
    nonProductionPayment: env.ASAAS_ENVIRONMENT !== 'production'
      && env.STRIPE_MODE !== 'live' && env.PAYMENT_ENVIRONMENT !== 'production',
    migrationCurrent: migrationGate?.status === 'PASS' && migrationGate.expected === STAGING_TARGET.migrationCount
      && migrationGate.actual === STAGING_TARGET.migrationCount,
  };
  const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  return {
    status: failures.length ? 'BLOCKED' : 'PASS',
    code: failures.includes('migrationCurrent') && migrationGate?.code === 'STAGING_SCHEMA_OUTDATED'
      ? 'STAGING_SCHEMA_OUTDATED'
      : failures.length ? 'STAGING_PREFLIGHT_BLOCKED' : 'STAGING_PREFLIGHT_PASS',
    target: STAGING_TARGET,
    checks,
    failures,
    migrationGate: migrationGate || { status: 'CONFIGURATION_REQUIRED', code: 'REMOTE_LEDGER_CAPTURE_REQUIRED', expected: STAGING_TARGET.migrationCount },
    actionsPerformed: [],
    note: 'Read-only preflight only: this command never applies migrations, creates users, changes environment variables, or deploys.',
  };
}

function parseArgs(argv) {
  const options = { captureDir: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--capture-dir') options.captureDir = argv[++i] || '';
    else if (argv[i] === '--help' || argv[i] === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write('Read-only staging check: npm run readiness:staging -- --capture-dir <sanitized-read-only-capture>\n');
    } else {
      const gate = args.captureDir ? await checkStagingMigrationGate(args.captureDir) : undefined;
      const result = evaluateStagingPreflight(process.env, gate);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (result.status !== 'PASS') process.exitCode = 2;
    }
  } catch {
    process.stderr.write('STAGING_PREFLIGHT_BLOCKED: check arguments and sanitized capture directory.\n');
    process.exitCode = 2;
  }
}
