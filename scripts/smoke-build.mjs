import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.resolve(process.argv[2]);
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
// Deliberately do not inherit credentials, provider config or the repository .env.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(path|systemroot|windir|temp|tmp|comspec)$/i.test(key)));
Object.assign(env, {
  NODE_ENV: 'production', APP_ENV: 'staging', VITE_APP_ENV: 'staging',
  PORT: String(port), NODE_PATH: path.join(root, 'node_modules'),
  APP_URL: 'https://orkto-staging.invalid', PUBLIC_SITE_URL: 'https://orkto-staging.invalid',
  ALLOWED_ORIGINS: 'https://orkto-staging.invalid',
  VITE_SUPABASE_URL: 'https://ghrjongiodziasupakrk.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'e30.eyJyZWYiOiJnaHJqb25naW9kemlhc3VwYWtyayIsInJvbGUiOiJhbm9uIn0.signature',
  COLLECTIVE_MEMORY_CROSS_WORKSPACE: 'OFF', PUBLIC_CASE_PUBLICATION: 'OFF',
  ASAAS_ENVIRONMENT: 'sandbox',
});
// The public key is synthetic. No elevated credential or Bearer token is
// supplied; the app's sentry/provider/channel integrations stay off.
const server = spawn(process.execPath, [path.join(directory, 'server.cjs')], { cwd: path.dirname(directory), env, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
let output = '';
server.stdout.on('data', chunk => { output += chunk; });
server.stderr.on('data', chunk => { output += chunk; });
let failure;
server.on('error', error => { failure = error; });
try {
  let ready = false;
  for (let attempt=0; attempt<80; attempt++) {
    if (failure || server.exitCode !== null) throw failure || new Error(`Server exited ${server.exitCode}: ${output}`);
    try { ready = (await fetch(`http://127.0.0.1:${port}/api/health`)).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, `Server did not become ready: ${output}`);
  for (const [url,status] of [['/',200],['/inbox',200],['/api/wia/chat-history',401],['/api/nonexistent',404],['/server.cjs',404],['/server.cjs.map',404],['/%73erver.cjs',404]]) {
    assert.equal((await fetch(`http://127.0.0.1:${port}${url}`)).status,status,url);
  }
  console.log('PASS: built production server starts; health, SPA, auth boundary and source protection verified (no external credentials).');
} finally {
  server.kill();
  if (server.exitCode === null) await new Promise(resolve => server.once('exit',resolve));
}
