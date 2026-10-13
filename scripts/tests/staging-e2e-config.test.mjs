import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STAGING_E2E_TARGET, validateStagingE2EConfig, validateStagingE2ETargetConfig, validateStagingPreviewDeployment } from '../readiness/staging-e2e-config.mjs';

const valid = {
  ORKTO_STAGING_E2E: '1',
  ORKTO_STAGING_PREVIEW_URL: 'https://orkto-staging-preview.vercel.app',
  ORKTO_STAGING_EXPECTED_SHA: 'a'.repeat(40),
  ORKTO_STAGING_VERCEL_PROJECT_ID: STAGING_E2E_TARGET.vercelProjectId,
  ORKTO_STAGING_SUPABASE_REF: STAGING_E2E_TARGET.supabaseRef,
  ORKTO_STAGING_E2E_USER_A_EMAIL: 'user-a@staging.synthetic',
  ORKTO_STAGING_E2E_USER_A_PASSWORD: 'a-private-random-secret-1',
  ORKTO_STAGING_E2E_USER_B_EMAIL: 'user-b@staging.synthetic',
  ORKTO_STAGING_E2E_USER_B_PASSWORD: 'b-private-random-secret-2',
};

test('E2E gate accepts only explicit isolated staging and synthetic A/B identities', () => {
  assert.equal(validateStagingE2EConfig(valid).ok, true);
  assert.equal(validateStagingE2ETargetConfig({ ...valid,
    ORKTO_STAGING_E2E_USER_A_EMAIL: undefined,
    ORKTO_STAGING_E2E_USER_A_PASSWORD: undefined,
    ORKTO_STAGING_E2E_USER_B_EMAIL: undefined,
    ORKTO_STAGING_E2E_USER_B_PASSWORD: undefined,
  }).ok, true, 'preview identity can be checked before synthetic users are created');
  assert.equal(validateStagingE2EConfig({ ...valid,
    ORKTO_STAGING_E2E_USER_A_EMAIL:'orkto-readiness-a-9ab7fc5b087b@example.invalid',
    ORKTO_STAGING_E2E_USER_B_EMAIL:'orkto-readiness-b-9ab7fc5b087b@example.invalid',
  }).ok,true);
});

test('E2E gate fails closed for production, unknown preview, missing opt-in, and missing synthetic users', () => {
  assert.equal(validateStagingE2EConfig({ ...valid, ORKTO_STAGING_E2E: undefined }).code, 'STAGING_E2E_EXPLICIT_OPT_IN_REQUIRED');
  assert.equal(validateStagingE2EConfig({ ...valid, ORKTO_STAGING_PREVIEW_URL: 'https://orkto.co' }).code, 'STAGING_PREVIEW_URL_REQUIRED_OR_UNSAFE');
  assert.equal(validateStagingE2EConfig({ ...valid, ORKTO_STAGING_PREVIEW_URL: 'https://attacker-staging.example' }).code, 'STAGING_PREVIEW_URL_REQUIRED_OR_UNSAFE');
  assert.equal(validateStagingE2EConfig({ ...valid, ORKTO_STAGING_EXPECTED_SHA: undefined }).code, 'STAGING_EXPECTED_SHA_REQUIRED');
  assert.equal(validateStagingE2EConfig({ ...valid, ORKTO_STAGING_VERCEL_PROJECT_ID: 'prj_XiwDjfbGC8sq8L8zb59lcZA4HUny' }).code, 'STAGING_PROJECT_BOUNDARY_MISMATCH');
  assert.equal(validateStagingE2EConfig({ ...valid, ORKTO_STAGING_E2E_USER_B_EMAIL: 'real.person@example.com' }).code, 'STAGING_SYNTHETIC_USER_B_REQUIRED');
  assert.equal(validateStagingE2EConfig({ ...valid, ORKTO_STAGING_E2E_USER_A_EMAIL:'orkto-readiness-a-9ab7fc5b087b@example.invalid' }).code,'STAGING_SYNTHETIC_USERS_MUST_SHARE_BATCH');
  assert.equal(validateStagingE2EConfig({ ...valid, APP_ADMIN: 'qneqljlphgkptebsaonb' }).code, 'STAGING_ENVIRONMENT_MISMATCH');
});

test('E2E refuses credentials unless authenticated Vercel inspect binds URL to the staging project', () => {
  const good = { projectId: STAGING_E2E_TARGET.vercelProjectId, url: 'orkto-staging-preview.vercel.app', target: null, readyState:'READY', meta:{githubCommitSha:valid.ORKTO_STAGING_EXPECTED_SHA} };
  const check = (deployment, list = [], sha = valid.ORKTO_STAGING_EXPECTED_SHA) => validateStagingPreviewDeployment(valid.ORKTO_STAGING_PREVIEW_URL, deployment, list, sha);
  assert.equal(check(good).ok, true);
  assert.equal(check({...good,target:'preview'}).ok,true);
  assert.equal(check(good, [], 'b'.repeat(40)).code,'STAGING_PREVIEW_SHA_MISMATCH');
  assert.equal(check({...good,meta:{}}).code,'STAGING_PREVIEW_SHA_MISMATCH');
  const cliInspect = { id:'dpl_staging', name:'orkto-staging', url:good.url, target:'preview', readyState:'READY' };
  const cliList = [{ url:good.url, name:'orkto-staging', state:'READY', target:null,
    meta:{githubCommitSha:valid.ORKTO_STAGING_EXPECTED_SHA} }];
  assert.equal(check(cliInspect, cliList).ok, true, 'Vercel inspect omits SHA, scoped list supplies it');
  assert.equal(check(cliInspect, [{...cliList[0],meta:{githubCommitSha:'b'.repeat(40)}}]).code,
    'STAGING_PREVIEW_SHA_MISMATCH');
  assert.equal(check({ ...good, projectId:'prj_XiwDjfbGC8sq8L8zb59lcZA4HUny' }).ok, false);
  assert.equal(check({ ...good, projectId:'prj_XiwDjfbGC8sq8L8zb59lcZA4HUny' }, [
    { url:good.url, name:'orkto-staging', state:'READY', target:null },
  ]).ok, false);
  assert.equal(check({ ...good, projectId:undefined }, [
    { url:good.url, name:'orkto-staging', state:'READY', target:null },
  ]).ok, true);
  assert.equal(check({ ...good, projectId:undefined }, [
    { url:good.url, name:'orkto', state:'READY', target:null },
  ]).ok, false);
  assert.equal(check({ ...good, projectId:undefined }, [
    { url:good.url, name:'orkto-staging', state:'READY', target:'staging' },
  ]).ok, false);
  assert.equal(check({ ...good, url:'attacker-staging.vercel.app' }).ok, false);
  assert.equal(check({ ...good, target:'production' }).ok, false);
  assert.equal(check({ ...good, readyState:'ERROR' }).ok, false);
});
