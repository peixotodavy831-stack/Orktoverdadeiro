import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname, sep } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const mode = process.argv[2];
const output = process.argv[3] && resolve(process.argv[3]);
if (!output || !['create', 'verify'].includes(mode)) {
  throw new Error('Use: node scripts/create-staging-snapshot.mjs create|verify <absolute-snapshot-directory>');
}

const rootFiles = new Set([
  'AGENTS.md', 'README.md', 'index.html', 'package.json', 'package-lock.json',
  'server.ts', 'tsconfig.json', 'vite.config.ts', 'vercel.json',
  'cloudflare-worker.js', 'check-imports.cjs', 'test-adapter-simple.ts',
  'staging.env.example', 'docs/05_ENGINEERING/FRONTEND_BACKEND_CONTRACT_GAPS.md',
]);
const explicitFiles = new Set([
  'docs/05_ENGINEERING/STAGING_ENVIRONMENT_MATRIX.md',
  'docs/05_ENGINEERING/ORKTO_CURRENT_STATE.md',
  'docs/05_ENGINEERING/MIGRATION_DEPLOYMENT_RISK.md',
  'docs/05_ENGINEERING/DATABASE_ROLLBACK_PLAN.md',
  'docs/05_ENGINEERING/ORKTO_INCIDENT_RECOVERY_RUNBOOK.md',
  'docs/05_ENGINEERING/ORKTO_RELEASE_CANDIDATE_CHECKLIST.md',
  'docs/05_ENGINEERING/ORKTO_PRODUCTION_GO_LIVE_RUNBOOK.md',
  'docs/05_ENGINEERING/ORKTO_HUMAN_ACTION_BACKLOG.md',
  'docs/05_ENGINEERING/ORKTO_API_AUTHORIZATION_MATRIX.md',
  'docs/05_ENGINEERING/STAGING_E2E_HARNESS.md',
  'docs/05_ENGINEERING/ORKTO_SECURITY_AUDIT_2026-09-28.md',
  'docs/05_ENGINEERING/MIGRATION_18_STAGING_EXECUTION.md',
]);
const prefixes = ['backend/', 'src/', 'public/', 'scripts/', 'tests/', '.github/workflows/',
  'supabase/migrations/', 'supabase/tests/', 'supabase/scheduler/'];
const deny = /(^|\/)(?:\.env(?:\..*)?|node_modules|dist|build|coverage|\.git|\.tmp[^/]*|\.vercel|\.temp)(\/|$)|\.(?:pem|key|p12|pfx|log)$/i;
const normalize = (file) => file.replaceAll('\\', '/');
const include = (file) => !deny.test(file) && (rootFiles.has(file) || explicitFiles.has(file) || prefixes.some((prefix) => file.startsWith(prefix)));
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const sourceHash = (entries) => createHash('sha256')
  .update(entries.map(({ path, sha256, bytes }) => `${path}\0${sha256}\0${bytes}\n`).join(''))
  .digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const getPaths = (...args) => git('ls-files', '-z', ...args).split('\0').filter(Boolean).map(normalize);
const localSecrets = ['.env', '.env.local'].filter((file) => existsSync(resolve(repo, file))).flatMap((file) =>
  readFileSync(resolve(repo, file), 'utf8').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match || !/(SECRET|SERVICE_ROLE|TOKEN|PRIVATE|PASSWORD|API_KEY)/i.test(match[1])) return [];
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    return value.length >= 12 ? [value] : [];
  }));
const assertNoLocalSecret = (file, path) => {
  const contents = readFileSync(file);
  for (const secret of localSecrets) {
    if (contents.includes(Buffer.from(secret))) throw new Error(`Local secret value detected in snapshot source: ${path}`);
  }
};

if (mode === 'create') {
  if (existsSync(output)) throw new Error(`Snapshot path already exists: ${output}`);
  if (relative(repo, output) === '' || !relative(repo, output).startsWith('..' + sep)) {
    throw new Error('Snapshot output must be outside the repository.');
  }
  const tracked = new Set(getPaths('--cached'));
  const untracked = getPaths('--others', '--exclude-standard');
  const paths = [...new Set([...tracked, ...untracked])].filter(include).sort();
  const migrations = paths.filter((file) => /^supabase\/migrations\/\d+_.+\.sql$/.test(file));
  if (migrations.length !== 25) throw new Error(`Expected 25 migrations; found ${migrations.length}`);
  const entries = [];
  for (const path of paths) {
    const source = resolve(repo, path);
    const stat = lstatSync(source);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Non-regular source refused: ${path}`);
    if (stat.size > 16 * 1024 * 1024) throw new Error(`Large source requires review: ${path}`);
    assertNoLocalSecret(source, path);
    entries.push({ path, sha256: hash(source), bytes: stat.size, git: tracked.has(path) ? 'tracked' : 'untracked' });
  }
  mkdirSync(output, { recursive: true });
  for (const entry of entries) {
    const destination = resolve(output, entry.path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(resolve(repo, entry.path), destination);
    if (hash(destination) !== entry.sha256) throw new Error(`Copy changed: ${entry.path}`);
  }
  const manifest = {
    format: 'orkto-staging-source-v1',
    createdAt: new Date().toISOString(),
    branch: git('branch', '--show-current').trim(),
    head: git('rev-parse', 'HEAD').trim(),
    migrationCount: migrations.length,
    globalSha256: sourceHash(entries),
    files: entries,
  };
  const manifestPath = resolve(output, 'SOURCE_MANIFEST.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(resolve(output, 'SOURCE_MANIFEST.sha256'), `${hash(manifestPath)}  SOURCE_MANIFEST.json\n${manifest.globalSha256}  source-files\n`);
  writeFileSync(resolve(output, 'GIT_STATUS.txt'), git('status', '--short'));
  console.log(JSON.stringify({ output, head: manifest.head, files: entries.length, migrations: migrations.length,
    tracked: entries.filter((entry) => entry.git === 'tracked').length,
    untracked: entries.filter((entry) => entry.git === 'untracked').length,
    manifestSha256: hash(resolve(output, 'SOURCE_MANIFEST.json')) }));
} else {
  const manifest = JSON.parse(readFileSync(resolve(output, 'SOURCE_MANIFEST.json'), 'utf8'));
  if (manifest.format !== 'orkto-staging-source-v1') throw new Error('Unknown snapshot format');
  if (sourceHash(manifest.files) !== manifest.globalSha256) throw new Error('Snapshot global source hash mismatch');
  for (const entry of manifest.files) {
    if (!include(entry.path)) throw new Error(`Unsafe manifest path: ${entry.path}`);
    if (hash(resolve(output, entry.path)) !== entry.sha256) throw new Error(`Snapshot mismatch: ${entry.path}`);
    assertNoLocalSecret(resolve(output, entry.path), entry.path);
    if (hash(resolve(repo, entry.path)) !== entry.sha256) throw new Error(`Working tree changed since snapshot: ${entry.path}`);
  }
  const sidecar = readFileSync(resolve(output, 'SOURCE_MANIFEST.sha256'), 'utf8');
  const expectedSidecar = `${hash(resolve(output, 'SOURCE_MANIFEST.json'))}  SOURCE_MANIFEST.json\n${manifest.globalSha256}  source-files\n`;
  if (sidecar !== expectedSidecar) throw new Error('Snapshot manifest hash sidecar mismatch');
  console.log(JSON.stringify({ verified: true, files: manifest.files.length, migrations: manifest.migrationCount,
    globalSha256: manifest.globalSha256, manifestSha256: hash(resolve(output, 'SOURCE_MANIFEST.json')) }));
}
