import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// The isolated test runner compiles suites into a disposable directory while
// retaining the repository as cwd; resolve the source script from there.
const repository = process.cwd();
const scanner = path.join(repository, 'scripts/readiness/scan-secrets.mjs');

test('secret scan reports categories without printing credential material', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'orkto-secret-scan-test-'));
  const secret = `sk-${'X'.repeat(40)}`;
  writeFileSync(path.join(directory, 'bundle.js'), `const credential = '${secret}';`);
  const result = spawnSync(process.execPath, [scanner, directory], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /OPENAI_SECRET/);
  assert.doesNotMatch(result.stderr + result.stdout, /sk-X{10}/);
});

test('secret scan passes a safe standalone artifact', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'orkto-secret-scan-safe-'));
  writeFileSync(path.join(directory, 'bundle.js'), 'export const status = "ready";');
  const output = execFileSync(process.execPath, [scanner, directory], { encoding: 'utf8' });
  assert.match(output, /"status":"PASS"/);
});

test('Supabase anon JWT is reported as public config review while privileged JWTs remain blocking', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'orkto-secret-scan-supabase-'));
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const anon = `${header}.${encode({ role: 'anon', ref: 'synthetic-staging' })}.${'A'.repeat(24)}`;
  writeFileSync(path.join(directory, 'anon.js'), `const publicKey = '${anon}';`);
  const publicResult = spawnSync(process.execPath, [scanner, directory], { encoding: 'utf8' });
  assert.equal(publicResult.status, 0);
  assert.match(publicResult.stderr, /PUBLIC_SUPABASE_ANON_CONFIG/);
  assert.match(publicResult.stdout, /"status":"REVIEW"/);
  assert.doesNotMatch(publicResult.stderr + publicResult.stdout, /A{20}/);

  const privileged = `${header}.${encode({ role: 'service_role', ref: 'synthetic-staging' })}.${'B'.repeat(24)}`;
  writeFileSync(path.join(directory, 'service.js'), `const privateKey = '${privileged}';`);
  const privilegedResult = spawnSync(process.execPath, [scanner, directory], { encoding: 'utf8' });
  assert.equal(privilegedResult.status, 1);
  assert.match(privilegedResult.stderr, /JWT_LITERAL/);
  assert.match(privilegedResult.stdout, /"status":"FAIL"/);
  assert.doesNotMatch(privilegedResult.stderr + privilegedResult.stdout, /B{20}/);

  // A public key earlier in the same artifact must not hide a privileged JWT.
  writeFileSync(path.join(directory, 'mixed.js'), `const keys = ['${anon}', '${privileged}'];`);
  const mixedResult = spawnSync(process.execPath, [scanner, path.join(directory, 'mixed.js')], { encoding: 'utf8' });
  assert.equal(mixedResult.status, 1);
  assert.match(mixedResult.stderr, /PUBLIC_SUPABASE_ANON_CONFIG/);
  assert.match(mixedResult.stderr, /JWT_LITERAL/);
  assert.match(mixedResult.stdout, /"blockers":1/);
  assert.doesNotMatch(mixedResult.stderr + mixedResult.stdout, /[AB]{20}/);
});

test('default repository scan includes server/frontend build and test artifacts but skips dependency trees', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'orkto-secret-scan-artifact-'));
  const bundle = path.join(directory, 'dist/server.cjs');
  const secret = `sk-${'Z'.repeat(40)}`;
  mkdirSync(path.dirname(bundle), { recursive: true });
  writeFileSync(bundle, `const accidentalBundleSecret = '${secret}';`);
  const result = spawnSync(process.execPath, [scanner, directory], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /OPENAI_SECRET/);
  assert.doesNotMatch(result.stderr + result.stdout, /sk-Z{10}/);
});
