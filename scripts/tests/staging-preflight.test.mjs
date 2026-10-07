import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateStagingPreflight, STAGING_TARGET } from '../readiness/staging-preflight.mjs';

const validEnv = {
  APP_ENV: 'staging', VITE_APP_ENV: 'staging',
  VERCEL_PROJECT_ID: STAGING_TARGET.vercelProjectId,
  ORKTO_STAGING_VERCEL_PROJECT_ID: STAGING_TARGET.vercelProjectId,
  VITE_SUPABASE_URL: STAGING_TARGET.supabaseUrl,
  COLLECTIVE_MEMORY_CROSS_WORKSPACE: 'OFF', PUBLIC_CASE_PUBLICATION: 'OFF',
  ORKTO_ENABLE_MOCK_ROUTES: 'false', ORKTO_ENABLE_DEMO_LOGIN: 'false', ASAAS_ENVIRONMENT: 'sandbox',
};

test('staging preflight is read-only and passes only for the pinned staging environment and current schema', () => {
  const passing = evaluateStagingPreflight(validEnv, { status: 'PASS', code: 'STAGING_SCHEMA_CURRENT', expected: STAGING_TARGET.migrationCount, actual: STAGING_TARGET.migrationCount });
  assert.equal(passing.status, 'PASS');
  assert.deepEqual(passing.actionsPerformed, []);

  const outdated = evaluateStagingPreflight(validEnv, { status: 'STAGING_SCHEMA_OUTDATED', code: 'STAGING_SCHEMA_OUTDATED', expected: STAGING_TARGET.migrationCount, actual: 17 });
  assert.equal(outdated.status, 'BLOCKED');
  assert.equal(outdated.code, 'STAGING_SCHEMA_OUTDATED');
  assert.ok(outdated.failures.includes('migrationCurrent'));
});

test('staging preflight fails closed on production refs, project IDs, missing legal OFF flags and mock routes', () => {
  const result = evaluateStagingPreflight({
    ...validEnv,
    VERCEL_PROJECT_ID: 'prj_XiwDjfbGC8sq8L8zb59lcZA4HUny',
    VITE_SUPABASE_URL: 'https://qneqljlphgkptebsaonb.supabase.co',
    COLLECTIVE_MEMORY_CROSS_WORKSPACE: undefined,
    PUBLIC_CASE_PUBLICATION: 'ON',
    ORKTO_ENABLE_MOCK_ROUTES: 'true',
  }, { status: 'PASS', expected: STAGING_TARGET.migrationCount, actual: STAGING_TARGET.migrationCount });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.failures.includes('vercelProject'));
  assert.ok(result.failures.includes('supabaseProject'));
  assert.ok(result.failures.includes('legalFlagsOff'));
  assert.ok(result.failures.includes('mockRoutesOff'));
});

test('staging preflight rejects elevated credentials in Preview', () => {
  const gate = { status: 'PASS', expected: STAGING_TARGET.migrationCount, actual: STAGING_TARGET.migrationCount };
  for (const elevated of [
    { SUPABASE_SERVICE_ROLE_KEY: 'synthetic-elevated-key' },
    { STAGING_SERVICE_ROLE_KEY_SHA256: 'a'.repeat(64) },
  ]) {
    const result = evaluateStagingPreflight({ ...validEnv, ...elevated }, gate);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.failures.includes('noElevatedPreviewKey'));
  }
});
