import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStagingPreviewDeployment } from './staging-e2e-config.mjs';

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

export function parseStagingDeploymentUrl(output) {
  const candidates = [...new Set([...String(output || '').matchAll(/https:\/\/orkto-staging-[a-z0-9-]+\.vercel\.app/gi)]
    .map(match => match[0]))];
  if (candidates.length !== 1) return null;
  const url = new URL(candidates[0]);
  return url.hostname.startsWith('orkto-staging-') && url.hostname.endsWith('.vercel.app') ? url : null;
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

  if (hasText(env.SUPABASE_SERVICE_ROLE_KEY) || hasText(env.STAGING_SERVICE_ROLE_KEY_SHA256)) {
    return { allowed: false, reason: 'ELEVATED_PREVIEW_KEY_BLOCKED' };
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
  const defaultConfig = JSON.parse(readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8'));
  const stagingConfig = JSON.parse(readFileSync(path.join(repoRoot, 'vercel.staging.json'), 'utf8'));
  const productionConfig = JSON.parse(readFileSync(path.join(repoRoot, 'vercel.production.json'), 'utf8'));
  const { crons, ...withoutCrons } = productionConfig;
  if (!Array.isArray(crons) || crons.length !== 1
    || defaultConfig.buildCommand !== 'vite build && node scripts/render-public-url.mjs'
    || JSON.stringify(defaultConfig) !== JSON.stringify(withoutCrons)
    || JSON.stringify(stagingConfig) !== JSON.stringify(defaultConfig)) {
    process.stderr.write('STAGING_DEPLOY_ABORT: STAGING_CONFIG_DRIFT\n');
    process.exitCode = 2;
    return;
  }
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
    '--target=preview',
    '--scope', STAGING_DEPLOY_TARGET.orgId,
    '--local-config', 'vercel.staging.json',
    '--build-env',
    `APP_ENV=staging`,
    '--build-env',
    `VITE_APP_ENV=staging`,
    '--build-env',
    `VITE_SUPABASE_URL=${STAGING_DEPLOY_TARGET.supabaseUrl}`,
    '--build-env',
    `ORKTO_STAGING_SUPABASE_REF=${STAGING_DEPLOY_TARGET.supabaseRef}`,
  ];
  const childEnv = { ...process.env };
  // Pin the same project whose local link was verified. Vercel documents
  // these variables for non-interactive deploys; never inherit another target.
  childEnv.VERCEL_PROJECT_ID = STAGING_DEPLOY_TARGET.projectId;
  childEnv.VERCEL_ORG_ID = STAGING_DEPLOY_TARGET.orgId;
  const resultFromCli = spawnSync(command, deployArgs, {
    cwd: repoRoot,
    env: childEnv,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Discard CLI output: build logs can contain deployment configuration.
  if (resultFromCli.error || resultFromCli.status !== 0) {
    const diagnostic = String(resultFromCli.stderr || '');
    const reason = /target|environment/i.test(diagnostic) ? 'TARGET_OR_ENVIRONMENT'
      : /project|link/i.test(diagnostic) ? 'PROJECT_LINK'
      : /permission|forbidden|unauthorized|login/i.test(diagnostic) ? 'AUTHORIZATION'
      : /build/i.test(diagnostic) ? 'BUILD'
      : /upload|file count|size limit/i.test(diagnostic) ? 'UPLOAD'
      : /network|fetch|certificate|econn|timed out/i.test(diagnostic) ? 'NETWORK'
      : 'UNKNOWN';
    const allowedWords = new Set(['project','link','linked','git','branch','repository','scope','team','permission','deploy','deployment','build','file','source','target','production','preview','require','required','ignored','root','quota','limit','access','name','domain','invalid','missing','not','found','unauthorized','forbidden','failed','upload','environment','setting','settings','please','run','first','no','cannot','could','directory','command','existing','already','current','selected','create','unable','vercel','a','an','the','to','of','for','in','on','with','is','are','has','have','was','were','be','by','from','this','that','it','you','your','try','again','if','or','and','at','local','linking','select','organization','configured','requires','account','without','using','same','one']);
    const words = (diagnostic.toLowerCase().match(/[a-z]+/g) || []).filter(word => allowedWords.has(word)).slice(0, 30);
    const errorAt = diagnostic.toLowerCase().search(/error:/);
    const template = (errorAt >= 0 ? diagnostic.slice(errorAt) : diagnostic).toLowerCase().replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/https?:\/\/\S+/g, '[redacted]')
      .replace(/\b(?:prj|team|dpl)_[a-z0-9]+\b/g, '[redacted]')
      .replace(/[a-z0-9_./\\:-]{16,}/g, '[redacted]')
      .replace(/\d+/g, '#')
      .replace(/[a-z]+/g, word => allowedWords.has(word) ? word : `*${word.length}`).slice(0, 320);
    const safeSentence = (errorAt >= 0 ? diagnostic.slice(errorAt) : diagnostic)
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/https?:\/\/\S+|\S+@\S+|[A-Za-z]:\\\S+/g, '[redacted]')
      .replace(/["'`][^"'`\r\n]+["'`]/g, '[redacted]')
      .replace(/\b[A-Za-z0-9_./\\:-]{12,}\b/g, '[redacted]')
      .replace(/\d+/g, '#').slice(0, 320);
    process.stderr.write(`STAGING_DEPLOY_FAILED: ${reason}; diagnostic_words=${words.join(',')}; template=${template}; safe_sentence=${safeSentence}; inspect Vercel privately.\n`);
    process.exitCode = typeof resultFromCli.status === 'number' ? resultFromCli.status || 1 : 1;
    return;
  }
  const deployedUrl = parseStagingDeploymentUrl(`${resultFromCli.stdout}\n${resultFromCli.stderr}`);
  if (!deployedUrl) {
    process.stderr.write('STAGING_DEPLOY_UNVERIFIED: DEPLOYMENT_URL_INVALID\n');
    process.exitCode = 1;
    return;
  }
  const inspect = spawnSync(command,['inspect',deployedUrl.hostname,'--format=json'],{
    cwd:repoRoot,env:childEnv,encoding:'utf8',shell:process.platform === 'win32',stdio:['ignore','pipe','pipe'],
  });
  const list = spawnSync(command,['list',STAGING_DEPLOY_TARGET.projectId,'--format=json','--limit','20'],{
    cwd:repoRoot,env:childEnv,encoding:'utf8',shell:process.platform === 'win32',stdio:['ignore','pipe','pipe'],
  });
  let identity;
  try {
    if (inspect.status !== 0 || list.status !== 0) throw new Error('Deployment inspection failed');
    identity = validateStagingPreviewDeployment(deployedUrl.origin,
      JSON.parse(inspect.stdout),JSON.parse(list.stdout).deployments);
  } catch {
    identity = {ok:false};
  }
  if (!identity.ok) {
    process.stderr.write('STAGING_DEPLOY_UNVERIFIED: PROJECT_OR_TARGET_MISMATCH\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`STAGING_PREVIEW=READY url=${deployedUrl.origin} project=orkto-staging supabase=ghrjongiodziasupakrk\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
