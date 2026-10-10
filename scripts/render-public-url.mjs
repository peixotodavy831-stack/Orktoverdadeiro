import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const legacyUrl = 'https://orktoverdadeiro-production.up.railway.app';
const publicOriginToken = '__ORKTO_PUBLIC_ORIGIN__';
const stagingProjectId = 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc';
const productionHosts = /(?:^|\.)(?:orkto\.vercel\.app|orkto\.co|orkto\.com\.br|orktoverdadeiro-production\.up\.railway\.app)$/i;

function validOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && url.pathname === '/' && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}

export function resolvePublicSiteBuild(env) {
  const staging = env.APP_ENV === 'staging' || env.VITE_APP_ENV === 'staging';
  if (staging) {
    if (env.APP_ENV !== 'staging' || env.VITE_APP_ENV !== 'staging') {
      throw new Error('STAGING_ENVIRONMENT_MISMATCH: both staging markers are required.');
    }
    if (env.VERCEL === '1') {
      if (env.VERCEL_ENV !== 'preview' || env.VERCEL_PROJECT_ID !== stagingProjectId
        || env.ORKTO_STAGING_VERCEL_PROJECT_ID !== stagingProjectId
        || !/^orkto-staging-[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL || '')) {
        throw new Error('STAGING_ENVIRONMENT_MISMATCH: immutable staging Preview origin is required.');
      }
      return { origin: `https://${env.VERCEL_URL}`, staging: true };
    }
    const isolated = env.ORKTO_READINESS_ISOLATED_BUILD === '1';
    const origin = validOrigin(env.PUBLIC_SITE_URL || '');
    if (!isolated || !origin || !/staging/i.test(new URL(origin).hostname)
      || productionHosts.test(new URL(origin).hostname)) {
      throw new Error('STAGING_ENVIRONMENT_MISMATCH: isolated staging URL is required.');
    }
    return { origin, staging: true };
  }

  const configured = env.PUBLIC_SITE_URL || env.APP_URL;
  const origin = validOrigin(configured || '');
  if (!origin || origin === legacyUrl) {
    throw new Error('PUBLIC_SITE_URL_REQUIRED: configure the canonical HTTPS origin before publishing.');
  }
  return { origin, staging: false };
}

export async function renderPublicFiles(directory, env = process.env) {
  const { origin, staging } = resolvePublicSiteBuild(env);
  async function render(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) { await render(filePath); continue; }
      if (!/\.(?:html|xml|txt)$/.test(entry.name)) continue;
      let updated = (await readFile(filePath, 'utf8'))
        .replaceAll(publicOriginToken, origin).replaceAll(legacyUrl, origin);
      if (staging && entry.name.endsWith('.html')) {
        updated = updated
          .replace(/(<meta\s+name="robots"\s+content=")[^"]*("\s*\/?>)/i, '$1noindex, nofollow, noarchive$2')
          .replace(/(<meta\s+name="googlebot"\s+content=")[^"]*("\s*\/?>)/i, '$1noindex, nofollow, noarchive$2')
          .replace(/\s*<script\b[^>]*\bsrc="https:\/\/cloud\.umami\.is\/script\.js"[^>]*><\/script>/gi, '')
          .replace(/\s*<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');
        if (!/<meta\s+name="robots"/i.test(updated)) {
          updated = updated.replace(/<head>/i, '<head><meta name="robots" content="noindex, nofollow, noarchive">');
        }
      }
      if (staging && entry.name === 'robots.txt') updated = 'User-agent: *\nDisallow: /\n';
      await writeFile(filePath, updated, 'utf8');
    }
  }
  await render(directory);
  return { origin, staging };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await renderPublicFiles(path.resolve(process.argv[2] || 'dist'));
  console.log(`[ORKTO] Public metadata rendered for ${result.staging ? 'staging Preview' : 'configured public origin'}.`);
}
