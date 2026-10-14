import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { sanitizeTrace, safeRoute, safeResults, safeStep, safeEvent } from '../readiness/staging-diagnostics.mjs';
import { buildStagingBrowserEnvironment } from '../readiness/staging-browser-security.mjs';
import { runSafePlaywright } from '../readiness/staging-playwright-process.mjs';

test('route diagnostics discard query tokens, identifiers and unknown route content', () => {
  assert.equal(safeRoute('/api/contacts/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?secret=private').route, '/api/contacts/:id');
  assert.equal(safeRoute('/proposta-viva/private-value').route, '/[unclassified]');
  assert.equal(safeRoute('/api/clients/opaque_secret').route, '/[unclassified]');
  assert.equal(safeRoute('/rest/v1/rpc/orkto_private_secret').route, '/[unclassified]');
  assert.equal(safeStep({ title: 'Expect "toBeVisible" on private-locator', category: 'expect' }).api, 'tobevisible');
  assert.equal(safeEvent({kind:'request',host:'STAGING_SUPABASE',route:'/auth/v1/logout',method:'POST',status:204,failure:'NETWORK_ERROR',transport_code:'ERR_ABORTED'}).transport_code, 'ERR_ABORTED');
  assert.equal(safeEvent({kind:'request',host:'STAGING_SUPABASE',route:'/auth/v1/logout',method:'POST',transport_code:'private-secret'}).transport_code, undefined);
  assert.ok(!JSON.stringify(safeResults({ tests: [{ id: 'a'.repeat(16), status: 'failed', errors: ['private-error'], password: 'private-password' }] })).includes('private'));
});

test('trace sanitizer retains timelines without request headers, bodies, resources or opaque values', () => {
  const temp = mkdtempSync(join(tmpdir(), 'orkto-safe-trace-'));
  try {
    const file = join(temp, 'trace.zip');
    const raw = zipSync({
      '0-trace.trace': strToU8(JSON.stringify({ type: 'context-options', version: 8, options: { extraHTTPHeaders: { Authorization: 'private-header' } } }) + '\n'
        + JSON.stringify({ type: 'before', callId: 'opaque-private-id', class: 'APIRequestContext', method: 'get', startTime: 12, params: { url: '/api/clients?token=private-query', headers: { Authorization: 'private-header' }, data: 'opaque-private-value' } }) + '\n'
        + JSON.stringify({ type: 'after', callId: 'opaque-private-id', endTime: 88, error: { message: 'Timeout 75ms private-header' } })),
      '0-trace.network': strToU8(JSON.stringify({ type: 'resource-snapshot', snapshot: { request: { method: 'POST', url: 'https://ghrjongiodziasupakrk.supabase.co/auth/v1/token', headers: [{ value: 'private-header' }], postData: { text: 'private-body' } }, response: { status: 401, content: { text: 'private-response' } } } })),
      'resources/private-file': strToU8('private-resource'),
    });
    writeFileSync(file, raw); sanitizeTrace(file);
    const entries = unzipSync(readFileSync(file));
    assert.equal(Object.keys(entries).length, 2);
    const content = Object.values(entries).map(strFromU8).join('\n');
    assert.ok(!content.includes('private')); assert.ok(!content.includes('opaque'));
    assert.ok(content.includes('TIMEOUT')); assert.ok(content.includes('/auth/v1/token'));
    sanitizeTrace(file);
    assert.deepEqual(unzipSync(readFileSync(file)), entries, 'sanitation stays stable when reporter and parent both apply it');
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('safe wrapper distinguishes its own process deadline and suppresses raw stdout/stderr', async () => {
  const records = [];
  const result = await runSafePlaywright(process.execPath, ['-e', "console.log('private-stdout');console.error('private-stderr');console.log('ORKTO_SAFE_EVENT '+JSON.stringify({kind:'phase',stage:'AUTH_A',status:'start',duration_ms:0}));setTimeout(()=>{},10000)"], {
    cwd: process.cwd(), env: buildStagingBrowserEnvironment(process.env, {}), timeout: 1000, onRecord: item => records.push(item),
  });
  assert.equal(result.timedOut, true); assert.equal(result.timeout_scope, 'RUNNER_PROCESS');
  assert.ok(!JSON.stringify(records).includes('private'));
});

test('actual Playwright failures identify action, whole-test and API-request deadlines and retain sanitized traces', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'orkto-timeout-diag-'));
  const server = createServer(() => {});
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  try {
    const output = join(temp, 'artifacts'); const config = join(temp, 'config.mjs');
    writeFileSync(config, `export default ${JSON.stringify({ testDir: resolve('scripts/tests/fixtures'), testMatch: 'staging-timeout-diagnostics.spec.ts', workers: 1, timeout: 10000,
      reporter: [[resolve('scripts/readiness/staging-safe-reporter.mjs')]], outputDir: output,
      use: { ignoreHTTPSErrors: false, screenshot: 'off', trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false, sources: false }, video: 'off' } })}`);
    const records = [];
    const result = await runSafePlaywright(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', '--config', config], {
      cwd: process.cwd(), env: { ...buildStagingBrowserEnvironment(process.env, {}), ORKTO_TEST_HANG_URL: `http://127.0.0.1:${server.address().port}/api/clients`,
        ORKTO_TEST_ACCESS_TOKEN: 'synthetic-private-bearer', VERCEL_OIDC_TOKEN: 'synthetic-private-oidc' }, onRecord: record => records.push(record), timeout: 60000,
    });
    assert.equal(result.status, 1); assert.equal(result.records.length, 5);
    const scopes = result.records.map(record => record.timeout_scope);
    assert.ok(scopes.includes('PLAYWRIGHT_TEST')); assert.ok(scopes.includes('PLAYWRIGHT_API_REQUEST')); assert.ok(scopes.includes('PLAYWRIGHT_ACTION'));
    assert.ok(result.records.filter(record => record.status !== 'passed').every(record => record.trace_retained));
    const ambiguous = result.records.find(record => record.errors.includes('LOCATOR_AMBIGUOUS'));
    assert.ok(ambiguous); assert.equal(ambiguous.timeout_scope, 'NONE'); assert.equal(ambiguous.operation_timeout_ms, 0);
    assert.ok(ambiguous.duration_ms < 15000);
    assert.ok(result.records.some(record => record.status === 'passed'));
    assert.ok(result.records.every(record => record.source_line > 0));
    assert.equal(result.records.find(record => record.timeout_scope === 'PLAYWRIGHT_TEST').timeout_ms, 150);
    assert.equal(result.records.find(record => record.timeout_scope === 'PLAYWRIGHT_API_REQUEST').operation_timeout_ms, 75);
    assert.ok(result.records.some(record => record.last_step?.line > 0));
    assert.ok(records.some(record => record.kind === 'request' && record.failure === 'TIMEOUT'));
    const walk = p => readdirSync(p, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(p, e.name)) : [join(p, e.name)]);
    const archive = join(temp, 'staging-e2e-failures');
    assert.equal(readdirSync(archive).length, 4, 'all four failed scenarios retain their sanitized timeline');
    const contents = [...walk(output), ...walk(archive)].map(file => file.endsWith('.zip') ? Object.values(unzipSync(readFileSync(file))).map(strFromU8).join('\n') : readFileSync(file, 'utf8')).join('\n');
    assert.ok(!contents.includes('synthetic-private')); assert.ok(!JSON.stringify(records).includes('synthetic-private'));
    const persisted = JSON.parse(readFileSync(join(output, 'safe-results.json'), 'utf8'));
    assert.equal(persisted.tests.length, 5); assert.ok(persisted.tests.every(record => record.duration_ms > 0));
    // Only this known disposable path inside temp is removed, as Playwright does
    // at the next launch. Failure archives must survive that reset.
    assert.equal(resolve(output), resolve(temp, 'artifacts'));
    rmSync(output, { recursive: true, force: true });
    assert.equal(walk(archive).filter(file => file.endsWith('.zip')).length, 4);
  } finally {
    server.closeAllConnections(); await new Promise(resolveClose => server.close(resolveClose));
    rmSync(temp, { recursive: true, force: true });
  }
});
