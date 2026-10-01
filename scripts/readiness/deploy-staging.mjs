import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STAGING_DEPLOY_TARGET = Object.freeze({
  projectId: 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc',
  projectName: 'orkto-staging',
  orgId: 'team_7mNnmcZNv9miOp7pl7otO6wE',
  supabaseRef: 'ghrjongiodziasupakrk',
  supabaseUrl: 'https://ghrjongiodziasupakrk.supabase.co',
});

export const PRODUCTION_DEPLOY_TARGET = Object.freeze({
  projectId: 'prj_XiwDjfbGC8sq8L8zb59lcZA4HUny',
  projectName: 'orkto',
  supabaseRef: 'qneqljlphgkptebsaonb',
});

const TARGET_ENV_NAMES = [
  'VITE_SUPABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'ORKTO_STAGING_SUPABASE_URL',
  'SUPABASE_PROJECT_REF',
  'SUPABASE_PROJECT_ID',
  'ORKTO_STAGING_SUPABASE_REF',
  'ORKTO_STAGING_SUPABASE_PROJECT_REF',
  'DATABASE_URL',
  'DIRECT_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'PGHOST',
  'PGDATABASE',
];

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function matchesStagingTarget(name, value) {
  const normalized = value.trim().replace(/\/$/, '');
  if (name.endsWith('_URL') && name.includes('SUPABASE')) {
    return normalized === STAGING_DEPLOY_TARGET.supabaseUrl;
  }
  return normalized === STAGING_DEPLOY_TARGET.supabaseRef
    || normalized.includes(STAGING_DEPLOY_TARGET.supabaseRef);
}

export function validateStagingDeployBoundary({ projectLink, env, args = [] }) {
  if (!Array.isArray(args) || args.some((arg) => arg !== '--guard-only')) {
    return { allowed: false, reason: 'UNSUPPORTED_DEPLOY_ARGUMENT' };
  }

  if (!projectLink || typeof projectLink !== 'object') {
    return { allowed: false, reason: 'VERCEL_PROJECT_LINK_INVALID' };
  }
  if (projectLink.projectId === PRODUCTION_DEPLOY_TARGET.projectId
    || projectLink.projectName === PRODUCTION_DEPLOY_TARGET.projectName) {
    return { allowed: false, reason: 'PRODUCTION_VERCEL_PROJECT_BLOCKED' };
  }
  if (projectLink.projectId !== STAGING_DEPLOY_TARGET.projectId
    || projectLink.projectName !== STAGING_DEPLOY_TARGET.projectName
    || projectLink.orgId !== STAGING_DEPLOY_TARGET.orgId) {
    return { allowed: false, reason: 'UNEXPECTED_VERCEL_PROJECT' };
  }

  if (env.VERCEL_ENV === 'production') {
    return { allowed: false, reason: 'PRODUCTION_VERCEL_ENV_BLOCKED' };
  }
  if (hasText(env.VERCEL_PROJECT_ID) && env.VERCEL_PROJECT_ID !== STAGING_DEPLOY_TARGET.projectId) {
    return {
      allowed: false,
      reason: env.VERCEL_PROJECT_ID === PRODUCTION_DEPLOY_TARGET.projectId
        ? 'PRODUCTION_VERCEL_PROJECT_BLOCKED'
        : 'UNEXPECTED_VERCEL_PROJECT',
    };
  }
  if (hasText(env.VERCEL_PROJECT_NAME) && env.VERCEL_PROJECT_NAME !== STAGING_DEPLOY_TARGET.projectName) {
    return {
      allowed: false,
      reason: env.VERCEL_PROJECT_NAME === PRODUCTION_DEPLOY_TARGET.projectName
        ? 'PRODUCTION_VERCEL_PROJECT_BLOCKED'
        : 'UNEXPECTED_VERCEL_PROJECT',
    };
  }
  if (hasText(env.VERCEL_ORG_ID) && env.VERCEL_ORG_ID !== STAGING_DEPLOY_TARGET.orgId) {
    return { allowed: false, reason: 'UNEXPECTED_VERCEL_ORG' };
  }
  if (hasText(env.ORKTO_STAGING_VERCEL_PROJECT_ID)
    && env.ORKTO_STAGING_VERCEL_PROJECT_ID !== STAGING_DEPLOY_TARGET.projectId) {
    return { allowed: false, reason: 'UNEXPECTED_VERCEL_PROJECT' };
  }

  if (env.ORKTO_STAGING_SUPABASE_REF !== STAGING_DEPLOY_TARGET.supabaseRef
    || env.VITE_SUPABASE_URL !== STAGING_DEPLOY_TARGET.supabaseUrl) {
    return { allowed: false, reason: 'STAGING_SUPABASE_TARGET_NOT_CONFIRMED' };
  }

  for (const name of TARGET_ENV_NAMES) {
    const value = env[name];
    if (!hasText(value)) continue;
    if (value.includes(PRODUCTION_DEPLOY_TARGET.supabaseRef)) {
      return { allowed: false, reason: 'PRODUCTION_SUPABASE_TARGET_BLOCKED' };
    }
    if (!matchesStagingTarget(name, value)) {
      return { allowed: false, reason: 'UNVERIFIED_DATABASE_TARGET' };
    }
  }

  return { allowed: true, reason: 'STAGING_TARGET_CONFIRMED' };
}

function loadProjectLink(repoRoot) {
  try {
    return JSON.parse(readFileSync(path.join(repoRoot, '.vercel', 'project.json'), 'utf8'));
  } catch {
    return undefined;
  }
}

function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const args = process.argv.slice(2);
  const result = validateStagingDeployBoundary({
    projectLink: loadProjectLink(repoRoot),
    env: process.env,
    args,
  });

  if (!result.allowed) {
    process.stderr.write(`STAGING_DEPLOY_ABORT: ${result.reason}\n`);
    process.exitCode = 2;
    return;
  }

  if (args.includes('--guard-only')) {
    process.stdout.write('STAGING_DEPLOY_GUARD=PASS project=orkto-staging supabase=ghrjongiodziasupakrk\n');
    return;
  }

  const command = process.platform === 'win32' ? 'vercel.cmd' : 'vercel';
  const deployArgs = [
    'deploy',
    '--yes',
    '--build-env',
    `APP_ENV=staging`,
    '--build-env',
    `VITE_APP_ENV=staging`,
    '--build-env',
    `VITE_SUPABASE_URL=${STAGING_DEPLOY_TARGET.supabaseUrl}`,
    '--build-env',
    `ORKTO_STAGING_SUPABASE_REF=${STAGING_DEPLOY_TARGET.supabaseRef}`,
  ];
  const childEnv = {
    ...process.env,
    VERCEL_PROJECT_ID: STAGING_DEPLOY_TARGET.projectId,
    VERCEL_ORG_ID: STAGING_DEPLOY_TARGET.orgId,
  };
  const resultFromCli = spawnSync(command, deployArgs, {
    cwd: repoRoot,
    env: childEnv,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Discard CLI output: build logs can contain deployment configuration.
  if (resultFromCli.error || resultFromCli.status !== 0) {
    process.stderr.write('STAGING_DEPLOY_FAILED: inspect the authenticated Vercel CLI session privately.\n');
    process.exitCode = typeof resultFromCli.status === 'number' ? resultFromCli.status || 1 : 1;
    return;
  }
  process.stdout.write('STAGING_DEPLOY=SUBMITTED project=orkto-staging supabase=ghrjongiodziasupakrk\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
