import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateGooglePilotPreflight as evaluate } from '../readiness/google-pilot-preflight.mjs';

const inventoryPath = new URL('../../docs/05_ENGINEERING/evidence/google-pilot-inventory-2026-10-14.json', import.meta.url);
const observed = JSON.parse(readFileSync(inventoryPath, 'utf8'));

test('observed staging inventory blocks activation and preserves legacy access', () => {
  const result = evaluate(observed);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.technicalReady, 'NO');
  assert.ok(result.blockers.includes('LEGACY_AUTH_TRANSITION_REQUIRED'));
  assert.ok(result.blockers.includes('UNAPPROVED_WORKSPACE_PROVISIONING_RISK'));
  assert.deepEqual(result.actionsPerformed, []);
});

test('hiding password UI or enabling Google cannot prove Google-only Auth', () => {
  const result = evaluate({ ...observed, googleProviderEnabled: true });
  assert.ok(result.blockers.includes('PILOT_PASSWORDLESS_ENFORCEMENT_UNPROVEN'));
  assert.ok(result.blockers.includes('SERVER_ADMISSION_REQUIRED'));
});

test('disabling project-wide email with legacy accounts remains blocked', () => {
  assert.ok(evaluate({ ...observed, emailProviderEnabled: false }).blockers
    .includes('LEGACY_PASSWORD_ACCESS_AT_RISK'));
});

test('production targets and altered app baselines are refused without echoing input', () => {
  for (const [key, value] of Object.entries({ supabaseRef: 'qneqljlphgkptebsaonb',
    vercelProjectId: 'prj_XiwDjfbGC8sq8L8zb59lcZA4HUny', baselineAppSha: 'unexpected-sensitive-input' })) {
    const result = evaluate({ ...observed, [key]: value });
    assert.deepEqual(result.blockers, ['TARGET_OR_BASELINE_MISMATCH']);
    assert.ok(!JSON.stringify(result).includes(value));
  }
});

test('malformed, partial, unknown and credential-bearing inventories fail closed', () => {
  for (const value of [null, [], {}, { ...observed, passwordAccounts: -1 },
    { ...observed, authUsers: 0 }, { ...observed, googleProviderEnabled: 'true' },
    { ...observed, passwordAccounts: 1.5 }, { ...observed, token: 'private-input-marker' }]) {
    const result = evaluate(value);
    assert.deepEqual(result.blockers, ['INVALID_SANITIZED_INVENTORY']);
    assert.ok(!JSON.stringify(result).includes('private-input-marker'));
  }
});

test('manual linking, anonymous login, implicit flow and email confirmation regressions block', () => {
  const result = evaluate({ ...observed, manualLinkingEnabled: true, anonymousEnabled: true, confirmEmail: false });
  for (const code of ['MANUAL_LINKING_REVIEW_REQUIRED', 'ANONYMOUS_AUTH_ENABLED',
    'LEGACY_EMAIL_CONFIRMATION_DISABLED', 'PKCE_REQUIRED']) assert.ok(result.blockers.includes(code));
});

test('even ideal declared configuration never substitutes for authenticated runtime evidence', () => {
  const result = evaluate({ ...observed, authUsers: 0, passwordAccounts: 0,
    privilegedActiveMemberships: 0, emailProviderEnabled: false,
    googleProviderEnabled: true, pkceConfigured: true, pilotAdmissionEnforced: true });
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.technicalReady, 'NO');
  assert.equal(result.stagingRecommendation, 'NO_GO');
  assert.ok(result.remainingVerification.includes('PASSWORD_ADD_LOGIN_RECOVERY_DENIAL'));
});

test('CLI rejects malformed secret-bearing JSON without raw logs or environment disclosure', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orkto-google-preflight-'));
  const fixture = join(dir, 'inventory.json');
  const cli = fileURLToPath(new URL('../readiness/google-pilot-preflight.mjs', import.meta.url));
  try {
    for (const raw of ['{"token":"private-input-marker",', JSON.stringify({ ...observed, token: 'private-input-marker' })]) {
      writeFileSync(fixture, raw);
      const result = spawnSync(process.execPath, [cli, fixture], {
        encoding: 'utf8', env: { ...process.env, ADMIN_KEY: 'private-environment-marker' },
      });
      assert.ifError(result.error);
      assert.equal(result.status, 2);
      const output = `${result.stdout}${result.stderr}`;
      assert.ok(!output.includes('private-input-marker'));
      assert.ok(!output.includes('private-environment-marker'));
      assert.ok(!output.includes(fixture));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
