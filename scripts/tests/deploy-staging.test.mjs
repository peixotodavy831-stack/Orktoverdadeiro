import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  PRODUCTION_DEPLOY_TARGET,
  STAGING_DEPLOY_TARGET,
  parseStagingDeploymentUrl,
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

test('hard aborts when a service-role key or fingerprint could reach Preview', () => {
  for (const elevated of [
    { SUPABASE_SERVICE_ROLE_KEY: 'synthetic-elevated-key' },
    { STAGING_SERVICE_ROLE_KEY_SHA256: 'a'.repeat(64) },
  ]) {
    assert.deepEqual(validateStagingDeployBoundary({ projectLink, env: { ...env, ...elevated } }), {
      allowed: false, reason: 'ELEVATED_PREVIEW_KEY_BLOCKED',
    });
  }
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

test('extracts one staging URL from CLI progress and rejects ambiguous or production URLs', () => {
  const stage = 'https://orkto-staging-5ee92qdyr-peixoto-s-projects1.vercel.app';
  assert.equal(parseStagingDeploymentUrl(`Building...\n${stage}\n`)?.origin, stage);
  assert.equal(parseStagingDeploymentUrl(`Production: ${stage} [READY]`)?.origin, stage);
  assert.equal(parseStagingDeploymentUrl(`https://orkto-123.vercel.app\n${stage}`)?.origin, stage);
  assert.equal(parseStagingDeploymentUrl(`${stage}\nhttps://orkto-staging-other.vercel.app`), null);
  assert.equal(parseStagingDeploymentUrl('https://orkto-production.vercel.app'), null);
});

test('Vercel Git integration disables automatic deployments for every readiness branch', () => {
  const configPath = fileURLToPath(new URL('../../vercel.json', import.meta.url));
  const config = JSON.parse(readFileSync(path.resolve(configPath), 'utf8'));
  assert.equal(config.git?.deploymentEnabled?.['production-readiness/*'], false);
});

test('CLI Preview excludes local environment and synthetic runner material', () => {
  const ignorePath = fileURLToPath(new URL('../../.vercelignore', import.meta.url));
  const ignore = readFileSync(ignorePath, 'utf8');
  assert.match(ignore, /^\.env\s*$/m);
  assert.match(ignore, /^\.tmp-\*\s*$/m);
  assert.match(ignore, /^supabase\/\.temp\/\s*$/m);
  const runner = readFileSync(fileURLToPath(new URL('../readiness/deploy-staging.mjs', import.meta.url)), 'utf8');
  assert.doesNotMatch(runner, /--prod|--target=production/);
  assert.match(runner, /'--target=preview'/);
  assert.match(runner, /validateStagingPreviewDeployment/);
  const defaultConfig=JSON.parse(readFileSync(fileURLToPath(new URL('../../vercel.json',import.meta.url)),'utf8'));
  const stagingConfig=JSON.parse(readFileSync(fileURLToPath(new URL('../../vercel.staging.json',import.meta.url)),'utf8'));
  const productionConfig=JSON.parse(readFileSync(fileURLToPath(new URL('../../vercel.production.json',import.meta.url)),'utf8'));
  assert.deepEqual(defaultConfig,stagingConfig);
  assert.equal(stagingConfig.buildCommand,'vite build && node scripts/render-public-url.mjs');
  const {crons,...productionWithoutCrons}=productionConfig;
  assert.deepEqual(productionWithoutCrons,defaultConfig);
  assert.equal(defaultConfig.crons,undefined);
  assert.deepEqual(productionConfig.crons,[{path:'/api/cron/automation-dispatch',schedule:'15 * * * *'}]);
});
