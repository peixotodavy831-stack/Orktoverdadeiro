import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function manifest(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const files = [];
  for (const entry of entries) {
    const name = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await manifest(path.join(directory, entry.name), name));
    else files.push([name, createHash('sha256').update(await readFile(path.join(directory, entry.name))).digest('hex')]);
  }
  return files.sort(([a], [b]) => a.localeCompare(b));
}
const before = await manifest(path.join(root, 'dist'));
const scratch = await mkdtemp(path.join(os.tmpdir(), 'orkto-build-validation-'));
const output = path.join(scratch, 'dist');
// The repository .env may point to production. A readiness artifact must never
// inherit it, even when the output directory itself is disposable.
const publicPlaceholder = 'sb_publishable_readiness_only_not_valid';
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(path|systemroot|windir|temp|tmp|comspec)$/i.test(key)));
Object.assign(env, {
  ORKTO_READINESS_ISOLATED_BUILD: '1', ORKTO_READINESS_ENV_DIR: scratch,
  APP_ENV: 'staging', VITE_APP_ENV: 'staging',
  APP_URL: 'https://orkto-staging.invalid', PUBLIC_SITE_URL: 'https://orkto-staging.invalid',
  VITE_SUPABASE_URL: 'https://ghrjongiodziasupakrk.supabase.co',
  VITE_SUPABASE_ANON_KEY: publicPlaceholder,
  STAGING_PUBLISHABLE_KEY_SHA256: createHash('sha256').update(publicPlaceholder).digest('hex'),
  COLLECTIVE_MEMORY_CROSS_WORKSPACE: 'OFF', PUBLIC_CASE_PUBLICATION: 'OFF',
});
const run = (...args) => execFileSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
async function assertNoProductionFrontend(directory) {
  const files = await manifest(directory);
  for (const [relative] of files) {
    if (relative === 'server.cjs' || relative === 'server.cjs.map') continue;
    const value = await readFile(path.join(directory, relative), 'utf8');
    if (/qneqljlphgkptebsaonb|orktoverdadeiro-production\.up\.railway\.app|orkto\.vercel\.app/i.test(value)) {
      throw new Error(`Temporary frontend still contains a production reference: ${relative}`);
    }
  }
}
const report = { scratch, frontend: false, publicUrl: false, server: false, runtime: false, distPreserved: false };
console.log(`Build evidence: ${scratch}`);
try {
  // The default config bundler asks esbuild to traverse beyond this checkout
  // on some restricted Windows runners. Vite's runner loader keeps config
  // evaluation in-process and still writes only to the isolated scratch dir.
  run('node_modules/vite/bin/vite.js', 'build', '--configLoader', 'runner', '--outDir', output);
  report.frontend = true;
  run('scripts/render-public-url.mjs', output);
  report.publicUrl = true;
  await assertNoProductionFrontend(output);
  run('node_modules/esbuild/bin/esbuild', 'server.ts', '--bundle', '--platform=node', '--format=cjs', '--packages=external', '--sourcemap', `--outfile=${path.join(output, 'server.cjs')}`);
  report.server = true;
  run('scripts/smoke-build.mjs', output);
  report.runtime = true;
} finally {
  report.distPreserved = JSON.stringify(before) === JSON.stringify(await manifest(path.join(root, 'dist')));
  await writeFile(path.join(scratch, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (!report.distPreserved) throw new Error('Original dist changed during validation. Inspect before proceeding.');
}
