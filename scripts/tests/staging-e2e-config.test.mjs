import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STAGING_E2E_TARGET, validateStagingE2EConfig, validateStagingPreviewDeployment } from '../readiness/staging-e2e-config.mjs';

const valid = {
  ORKTO_STAGING_E2E: '1',
  ORKTO_STAGING_PREVIEW_URL: 'https://orkto-staging-preview.vercel.app',
  ORKTO_STAGING_VERCEL_PROJECT_ID: STAGING_E2E_TARGET.vercelProjectId,
  ORKTO_STAGING_SUPABASE_REF: STAGING_E2E_TARGET.supabaseRef,
  ORKTO_STAGING_E2E_USER_A_EMAIL: 'user-a@staging.synthetic',
  ORKTO_STAGING_E2E_USER_A_PASSWORD: 'a-private-random-secret-1',
  ORKTO_STAGING_E2E_USER_B_EMAIL: 'user-b@staging.synthetic',
  ORKTO_STAGING_E2E_USER_B_PASSWORD: 'b-private-random-secret-2',
};

test('E2E gate accepts only explicit isolated staging and synthetic A/B identities', () => {
  assert.equal(validateStagingE2EConfig(valid).ok, true);
  assert.equal(validateStagingE2EConfig({ ...valid,
    ORKTO_STAGING_E2E_USER_A_EMAIL:'orkto-readiness-a-9ab7fc5b087b@example.invalid',
    ORKTO_STAGING_E2E_USER_B_EMAIL:'orkto-readiness-b-9ab7fc5b087b@example.invalid',
  }).ok,true);
});

test('E2E gate fails closed for production, unknown preview, missing opt-in, and missing synthetic users', () => {
  assert.equal(validateStagingE2EConfig({ ...valid, ORKTO_STAGING_E2E: undefined }).code, 'STAGING_E2E_EXPLICIT_OPT_IN_REQUIRED');
  assert.equal(validateStagingE2EConfig({ ...valid, ORKTO_STAGING_PREVIEW_URL: 'https://orkto.co' }).code, 'STAGING_PREVIEW_URL_REQUIRED_OR_UNSAFE');
  assert.equal(validateStagingE2EConfig({ ...valid, ORKTO_STAGING_PREVIEW_URL: 'https://attacker-staging.example' }).code, 'STAGING_PREVIEW_URL_REQUIRED_OR_UNSAFE');
  assert.equal(validateStagingE2EConfig({ ...valid, ORKTO_STAGING_VERCEL_PROJECT_ID: 'prj_XiwDjfbGC8sq8L8zb59lcZA4HUny' }).code, 'STAGING_PROJECT_BOUNDARY_MISMATCH');
  assert.equal(validateStagingE2EConfig({ ...valid, ORKTO_STAGING_E2E_USER_B_EMAIL: 'real.person@example.com' }).code, 'STAGING_SYNTHETIC_USER_B_REQUIRED');
  assert.equal(validateStagingE2EConfig({ ...valid, ORKTO_STAGING_E2E_USER_A_EMAIL:'orkto-readiness-a-9ab7fc5b087b@example.invalid' }).code,'STAGING_SYNTHETIC_USERS_MUST_SHARE_BATCH');
  assert.equal(validateStagingE2EConfig({ ...valid, APP_ADMIN: 'qneqljlphgkptebsaonb' }).code, 'STAGING_ENVIRONMENT_MISMATCH');
});

test('E2E refuses credentials unless authenticated Vercel inspect binds URL to the staging project', () => {
  const good = { projectId: STAGING_E2E_TARGET.vercelProjectId, url: 'orkto-staging-preview.vercel.app', target: 'preview', readyState:'READY' };
  assert.equal(validateStagingPreviewDeployment(valid.ORKTO_STAGING_PREVIEW_URL, good).ok, true);
  assert.equal(validateStagingPreviewDeployment(valid.ORKTO_STAGING_PREVIEW_URL, { ...good, projectId:'prj_XiwDjfbGC8sq8L8zb59lcZA4HUny' }).ok, false);
  assert.equal(validateStagingPreviewDeployment(valid.ORKTO_STAGING_PREVIEW_URL, { ...good, projectId:'prj_XiwDjfbGC8sq8L8zb59lcZA4HUny' }, [
    { url:good.url, name:'orkto-staging', state:'READY', target:null },
  ]).ok, false);
  assert.equal(validateStagingPreviewDeployment(valid.ORKTO_STAGING_PREVIEW_URL, { ...good, projectId:undefined }, [
    { url:good.url, name:'orkto-staging', state:'READY', target:null },
  ]).ok, true);
  assert.equal(validateStagingPreviewDeployment(valid.ORKTO_STAGING_PREVIEW_URL, { ...good, projectId:undefined }, [
    { url:good.url, name:'orkto', state:'READY', target:null },
  ]).ok, false);
  assert.equal(validateStagingPreviewDeployment(valid.ORKTO_STAGING_PREVIEW_URL, { ...good, url:'attacker-staging.vercel.app' }).ok, false);
  assert.equal(validateStagingPreviewDeployment(valid.ORKTO_STAGING_PREVIEW_URL, { ...good, target:'production' }).ok, false);
  assert.equal(validateStagingPreviewDeployment(valid.ORKTO_STAGING_PREVIEW_URL, { ...good, readyState:'ERROR' }).ok, false);
});
