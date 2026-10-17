import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STAGING_E2E_TARGET, stagingPreviewAccessForBrowser, validatePasswordRunnerMode, validateStagingE2EConfig, validateStagingE2ETargetConfig, validateStagingPreviewDeployment } from '../readiness/staging-e2e-config.mjs';
import { readFileSync } from 'node:fs';

test('password runner fails closed for Google pilot, disabled Email and unavailable settings', () => {
  assert.equal(validatePasswordRunnerMode({ external: { email: true } }).ok, true);
  for (const settings of [undefined, null, {}, { external: {} }, { external: { email: false } },
    { external: { email: 'true' } }, { external: { google: true } }]) {
    assert.equal(validatePasswordRunnerMode(settings).code, 'PASSWORD_RUNNER_INCOMPATIBLE_WITH_AUTH_MODE');
  }
  for (const key of ['ORKTO_AUTH_MODE', 'VITE_ORKTO_AUTH_MODE']) {
    assert.equal(validatePasswordRunnerMode({ external: { email: true } }, { [key]: 'google_pilot' }).ok, false);
  }
});

test('password runner checks live Auth mode before administrative lookup or synthetic creation', () => {
  const source = readFileSync(new URL('../readiness/validate-staging-auth.mjs', import.meta.url), 'utf8');
  const guard = source.indexOf('validatePasswordRunnerMode(await publicProbe.json(), process.env)');
  assert.ok(guard > 0);
  assert.ok(guard < source.indexOf('admin.auth.admin.listUsers'));
  assert.ok(guard < source.indexOf("measuredPhase('SYNTHETIC_USERS'"));
  assert.match(source.slice(guard, source.indexOf('admin.auth.admin.listUsers')), /if \(!passwordMode.ok\)[\s\S]*process.exit\(2\)/);
});

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

test('browser child receives only access for the exact staging Preview origin', () => {
  const share = `${valid.ORKTO_STAGING_PREVIEW_URL}/?_vercel_share=synthetic-access`;
  assert.deepEqual(stagingPreviewAccessForBrowser({ ...valid, ORKTO_STAGING_PREVIEW_ACCESS_URL: share }), {
    ok: true, values: { ORKTO_STAGING_PREVIEW_ACCESS_URL: share },
  });
  assert.deepEqual(stagingPreviewAccessForBrowser({ ...valid, ORKTO_STAGING_E2E_BYPASS_SECRET: 'synthetic-bypass' }), {
    ok: true, values: { ORKTO_STAGING_E2E_BYPASS_SECRET: 'synthetic-bypass' },
  });
  assert.deepEqual(stagingPreviewAccessForBrowser(valid), {
    ok: false, code: 'STAGING_PREVIEW_ACCESS_REQUIRED',
  });
  for (const unsafe of [
    `${valid.ORKTO_STAGING_PREVIEW_URL}/?_vercel_share=synthetic-access#fragment`,
    'https://orkto.co/?_vercel_share=synthetic-access',
    `${valid.ORKTO_STAGING_PREVIEW_URL}/?token=synthetic-access`,
  ]) {
    assert.equal(stagingPreviewAccessForBrowser({ ...valid, ORKTO_STAGING_PREVIEW_ACCESS_URL: unsafe }).ok, false);
  }
  assert.equal(stagingPreviewAccessForBrowser({ ...valid,
    ORKTO_STAGING_PREVIEW_ACCESS_URL: share,
    ORKTO_STAGING_E2E_BYPASS_SECRET: 'synthetic-bypass',
  }).code, 'STAGING_PREVIEW_ACCESS_AMBIGUOUS');
});

test('OIDC access accepts a live token in memory and rejects expired or ambiguous access', () => {
  const jwt = claims => `synthetic.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
  const token = jwt({ exp: Math.floor(Date.now() / 1000) + 600 });
  const selected = stagingPreviewAccessForBrowser({ ...valid, VERCEL_OIDC_TOKEN: token,
    ORKTO_STAGING_SUPABASE_ADMIN_KEY: 'synthetic-admin-never-forwarded' });
  assert.deepEqual(selected, { ok: true, values: { VERCEL_OIDC_TOKEN: token } });
  assert.equal(stagingPreviewAccessForBrowser({ ...valid, VERCEL_OIDC_TOKEN: jwt({ exp: 1 }) }).code,
    'STAGING_OIDC_TOKEN_INVALID_OR_EXPIRED');
  assert.equal(stagingPreviewAccessForBrowser({ ...valid, VERCEL_OIDC_TOKEN: 'malformed' }).ok, false);
  assert.equal(stagingPreviewAccessForBrowser({ ...valid, VERCEL_OIDC_TOKEN: token,
    ORKTO_STAGING_E2E_BYPASS_SECRET: 'synthetic-bypass' }).code, 'STAGING_PREVIEW_ACCESS_AMBIGUOUS');
});
