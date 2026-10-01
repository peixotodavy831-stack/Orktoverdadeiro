import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCTION_DEPLOY_TARGET,
  STAGING_DEPLOY_TARGET,
  validateStagingDeployBoundary,
} from '../readiness/deploy-staging.mjs';

const projectLink = {
  projectId: STAGING_DEPLOY_TARGET.projectId,
  projectName: STAGING_DEPLOY_TARGET.projectName,
  orgId: STAGING_DEPLOY_TARGET.orgId,
};

const env = {
  ORKTO_STAGING_SUPABASE_REF: STAGING_DEPLOY_TARGET.supabaseRef,
  VITE_SUPABASE_URL: STAGING_DEPLOY_TARGET.supabaseUrl,
};

test('allows only the verified staging project and Supabase target', () => {
  assert.deepEqual(validateStagingDeployBoundary({ projectLink, env }), {
    allowed: true,
    reason: 'STAGING_TARGET_CONFIRMED',
  });
});

test('hard aborts when the linked project is production', () => {
  const result = validateStagingDeployBoundary({
    projectLink: {
      ...projectLink,
      projectId: PRODUCTION_DEPLOY_TARGET.projectId,
      projectName: PRODUCTION_DEPLOY_TARGET.projectName,
    },
    env,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'PRODUCTION_VERCEL_PROJECT_BLOCKED');
});

test('hard aborts when any supplied Supabase target names production', () => {
  const result = validateStagingDeployBoundary({
    projectLink,
    env: { ...env, SUPABASE_URL: `https://${PRODUCTION_DEPLOY_TARGET.supabaseRef}.supabase.co` },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'PRODUCTION_SUPABASE_TARGET_BLOCKED');
});

test('fails closed when required staging ref or URL is missing or unknown', () => {
  for (const unsafeEnv of [
    { VITE_SUPABASE_URL: STAGING_DEPLOY_TARGET.supabaseUrl },
    { ...env, ORKTO_STAGING_SUPABASE_REF: 'unknown-ref' },
    { ...env, VITE_SUPABASE_URL: 'https://unknown.supabase.co' },
  ]) {
    const result = validateStagingDeployBoundary({ projectLink, env: unsafeEnv });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'STAGING_SUPABASE_TARGET_NOT_CONFIRMED');
  }
});

test('rejects an unexpected Vercel project and a production deployment mode', () => {
  assert.equal(validateStagingDeployBoundary({
    projectLink,
    env: { ...env, VERCEL_PROJECT_ID: PRODUCTION_DEPLOY_TARGET.projectId },
  }).reason, 'PRODUCTION_VERCEL_PROJECT_BLOCKED');
  assert.equal(validateStagingDeployBoundary({
    projectLink,
    env: { ...env, VERCEL_ENV: 'production' },
  }).reason, 'PRODUCTION_VERCEL_ENV_BLOCKED');
});

test('rejects deploy flags and permits guard-only without invoking Vercel', () => {
  assert.equal(validateStagingDeployBoundary({ projectLink, env, args: ['--prod'] }).reason,
    'UNSUPPORTED_DEPLOY_ARGUMENT');
  assert.equal(validateStagingDeployBoundary({ projectLink, env, args: ['--guard-only'] }).allowed,
    true);
});
