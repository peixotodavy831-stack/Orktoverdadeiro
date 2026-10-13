import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:https';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildStagingBrowserEnvironment, browserTlsEnvironment, redactSecrets, sanitizeArtifacts } from '../readiness/staging-browser-security.mjs';

async function child(command, args, env = process.env) {
  return await new Promise((resolveResult, reject) => {
    const processChild = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => processChild.kill(), 60_000);
    processChild.stdout.on('data', chunk => { stdout += chunk; });
    processChild.stderr.on('data', chunk => { stderr += chunk; });
    processChild.on('error', error => { clearTimeout(timer); reject(error); });
    processChild.on('close', code => { clearTimeout(timer); resolveResult({ code, stdout, stderr }); });
  });
}

test('actual subprocess receives system CA configuration and no administrative/provider secrets', async () => {
  const env = buildStagingBrowserEnvironment({ ...process.env, NODE_USE_SYSTEM_CA: '1',
    ORKTO_STAGING_SUPABASE_ADMIN_KEY: 'synthetic-admin-not-forwarded', ASAAS_API_KEY: 'synthetic-billing-not-forwarded' }, {});
  const result = await child(process.execPath, ['--input-type=module', '-e',
    "import tls from 'node:tls'; console.log(JSON.stringify({ca:process.env.NODE_USE_SYSTEM_CA, roots:tls.getCACertificates('system').length, admin:!!process.env.ORKTO_STAGING_SUPABASE_ADMIN_KEY,billing:!!process.env.ASAAS_API_KEY,insecure:!!process.env.NODE_TLS_REJECT_UNAUTHORIZED}))"], env);
  assert.equal(result.code, 0);
  const info = JSON.parse(result.stdout);
  assert.equal(info.ca, '1'); assert.ok(info.roots > 0);
  assert.equal(info.admin, false); assert.equal(info.billing, false); assert.equal(info.insecure, false);
});

test('insecure TLS overrides and missing extra CA files fail closed', () => {
  assert.throws(() => browserTlsEnvironment({ NODE_TLS_REJECT_UNAUTHORIZED: '0' }), /INSECURE_TLS/);
  assert.throws(() => browserTlsEnvironment({ ORKTO_E2E_ALLOW_RUNNER_CA: '1' }), /INSECURE_TLS/);
  assert.throws(() => browserTlsEnvironment({ NODE_EXTRA_CA_CERTS: 'missing.pem' }), /TRUSTED_CA/);
});

test('redaction removes JWTs and known secrets in plain, JSON and URL-encoded diagnostics', () => {
  const password = 'synthetic-password-"special%&';
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzeW50aGV0aWMifQ.syntheticSignature';
  const output = redactSecrets(`Authorization: Bearer ${jwt}\nx-vercel-trusted-oidc-idp-token: ${jwt}\n${password}\n${JSON.stringify(password)}\n${encodeURIComponent(password)}`, [password]);
  for (const value of [jwt, password, encodeURIComponent(password), JSON.stringify(password).slice(1, -1)]) assert.ok(!output.includes(value));
});

test('Playwright TLS rejects untrusted chains and wrong hostnames; explicit test CA works; failed tests retain no secrets', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'orkto-tls-security-'));
  let server;
  try {
    const generator = `from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from datetime import datetime, timedelta, timezone
import sys, pathlib
p=pathlib.Path(sys.argv[1]); k=rsa.generate_private_key(public_exponent=65537,key_size=2048)
n=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'localhost')]); now=datetime.now(timezone.utc)
c=x509.CertificateBuilder().subject_name(n).issuer_name(n).public_key(k.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(minutes=1)).not_valid_after(now+timedelta(days=1)).add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost')]),False).add_extension(x509.BasicConstraints(ca=True,path_length=None),True).sign(k,hashes.SHA256())
(p/'cert.pem').write_bytes(c.public_bytes(serialization.Encoding.PEM))
(p/'key.pem').write_bytes(k.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))`;
    let generated;
    try {
      generated = await child('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(temp, 'key.pem'),
        '-out', join(temp, 'cert.pem'), '-subj', '/CN=localhost', '-days', '1', '-addext', 'subjectAltName=DNS:localhost']);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    // Linux CI normally supplies OpenSSL. This managed Windows runner supplies
    // Python/cryptography instead; both generate disposable test-only keys.
    if (!generated || generated.code !== 0) generated = await child(process.env.ORKTO_TEST_PYTHON || 'python', ['-c', generator, temp]);
    assert.equal(generated.code, 0, 'test certificate generator must succeed');
    server = createServer({ key: readFileSync(join(temp, 'key.pem')), cert: readFileSync(join(temp, 'cert.pem')) }, (_req, res) => { res.end('safe-test-response'); });
    await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
    const port = server.address().port;
    const target = `https://localhost:${port}`;
    const moduleUrl = new URL('../../node_modules/playwright/index.mjs', import.meta.url).href;
    const probe = `import { request } from ${JSON.stringify(moduleUrl)}; const c=await request.newContext({ignoreHTTPSErrors:false}); try{const r=await c.get(process.argv[1],{maxRedirects:0});console.log(JSON.stringify({ok:r.ok()}))}catch{console.log(JSON.stringify({ok:false}))}finally{await c.dispose()}`;
    const env = buildStagingBrowserEnvironment({ ...process.env, NODE_USE_SYSTEM_CA: '1', NODE_EXTRA_CA_CERTS: undefined }, {});
    const untrusted = await child(process.execPath, ['--input-type=module', '-e', probe, target], env);
    assert.equal(JSON.parse(untrusted.stdout).ok, false, 'system roots do not trust an arbitrary self-signed certificate');
    const trustedEnv = { ...env, NODE_EXTRA_CA_CERTS: join(temp, 'cert.pem') };
    const trusted = await child(process.execPath, ['--input-type=module', '-e', probe, target], trustedEnv);
    assert.equal(JSON.parse(trusted.stdout).ok, true, 'explicit trusted test CA validates the complete chain');
    const wrongHost = await child(process.execPath, ['--input-type=module', '-e', probe, `https://127.0.0.1:${port}`], trustedEnv);
    assert.equal(JSON.parse(wrongHost.stdout).ok, false, 'trusting the CA does not bypass hostname validation');

    const output = join(temp, 'artifacts');
    const config = join(temp, 'security.config.mjs');
    writeFileSync(config, `export default ${JSON.stringify({ testDir: resolve('scripts/tests/fixtures'), testMatch: 'staging-security-failure.spec.ts', workers: 1,
      reporter: [[resolve('scripts/readiness/staging-safe-reporter.mjs')]], outputDir: output, use: { ignoreHTTPSErrors: false, screenshot: 'off', trace: 'off', video: 'off' } })}`);
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzZWNyZXQtZml4dHVyZSJ9.syntheticSignature';
    const password = 'synthetic-private-password-for-redaction';
    const key = 'sb_' + 'secret_' + 'synthetic_private_key_for_redaction';
    const failed = await child(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', '--config', config],
      { ...env, VERCEL_OIDC_TOKEN: token, ORKTO_TEST_ACCESS_TOKEN: token, ORKTO_TEST_SECRET_KEY: key,
        ORKTO_STAGING_E2E_USER_A_PASSWORD: password, ORKTO_TEST_TLS_URL: target });
    assert.equal(failed.code, 0, 'both deliberately failing fixtures must fail as expected');
    const records = failed.stdout.split(/\r?\n/).filter(line => line.startsWith('ORKTO_SAFE_RESULT '));
    assert.equal(records.length, 2);
    const walk = p => readdirSync(p, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(p, e.name)) : [join(p, e.name)]);
    const combined = failed.stdout + failed.stderr + walk(output).map(file => readFileSync(file, 'utf8')).join('\n');
    for (const secret of [token, password, key]) assert.ok(!combined.includes(secret), 'no fixture secret is retained in stdout, stderr or artifacts');
    assert.ok(!combined.includes('opaque-unrecognized-sensitive-fixture-value'), 'unknown opaque secrets are withheld with raw context');
    assert.ok(!combined.includes('eyJ'), 'no JWT survives failed Playwright calls');
    assert.ok(records.some(line => line.includes('TLS_CERTIFICATE_ERROR')));
  } finally {
    if (server) await new Promise(resolveClose => server.close(resolveClose));
    rmSync(temp, { recursive: true, force: true });
  }
});

test('artifact sanitation handles old error contexts and removes unreviewed binaries', () => {
  const temp = mkdtempSync(join(tmpdir(), 'orkto-artifact-redaction-'));
  try {
    writeFileSync(join(temp, 'error-context.md'), 'Authorization: Bearer synthetic-private-value');
    writeFileSync(join(temp, 'trace.zip'), 'unreviewed trace');
    sanitizeArtifacts(temp);
    assert.ok(!readFileSync(join(temp, 'error-context.md'), 'utf8').includes('synthetic-private-value'));
    assert.deepEqual(readdirSync(temp), ['error-context.md']);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
