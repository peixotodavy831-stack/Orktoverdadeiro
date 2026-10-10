import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { renderPublicFiles, resolvePublicSiteBuild } from '../render-public-url.mjs';

const stagingBuild = {
  APP_ENV: 'staging', VITE_APP_ENV: 'staging', VERCEL: '1', VERCEL_ENV: 'preview',
  VERCEL_PROJECT_ID: 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc',
  ORKTO_STAGING_VERCEL_PROJECT_ID: 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc',
  VERCEL_URL: 'orkto-staging-example-peixoto-s-projects1.vercel.app',
};

test('public metadata requires the pinned staging Preview project and host', () => {
  assert.deepEqual(resolvePublicSiteBuild(stagingBuild), {
    origin: 'https://orkto-staging-example-peixoto-s-projects1.vercel.app', staging: true,
  });
  for (const change of [
    { VERCEL_PROJECT_ID: 'prj_XiwDjfbGC8sq8L8zb59lcZA4HUny' },
    { VERCEL_ENV: 'production' },
    { VERCEL_URL: 'orkto.vercel.app' },
    { VERCEL_URL: 'orkto-staging-example.vercel.app.evil.invalid' },
  ]) {
    assert.throws(() => resolvePublicSiteBuild({ ...stagingBuild, ...change }), /STAGING_ENVIRONMENT_MISMATCH/);
  }
  assert.throws(() => resolvePublicSiteBuild({ APP_ENV: 'production' }), /PUBLIC_SITE_URL_REQUIRED/);
});

test('staging metadata rewrites legacy origins, disables indexing and removes analytics', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'orkto-public-metadata-'));
  try {
    await mkdir(path.join(directory, 'guias'));
    await writeFile(path.join(directory, 'index.html'), '<html><head><meta name="robots" content="index, follow" /><link rel="canonical" href="https://orktoverdadeiro-production.up.railway.app/"><script defer src="https://cloud.umami.is/script.js" data-website-id="public-id"></script><script type="application/ld+json">{"url":"https://orktoverdadeiro-production.up.railway.app/"}</script></head></html>');
    await writeFile(path.join(directory, 'guias', 'one.html'), '<html><head><meta name="robots" content="index,follow"><link rel="canonical" href="__ORKTO_PUBLIC_ORIGIN__/guias/one.html"></head></html>');
    await writeFile(path.join(directory, 'robots.txt'), 'User-agent: *\nAllow: /\n');
    await writeFile(path.join(directory, 'sitemap.xml'), '<loc>https://orktoverdadeiro-production.up.railway.app/</loc>');
    await renderPublicFiles(directory, stagingBuild);
    const index = await readFile(path.join(directory, 'index.html'), 'utf8');
    const guide = await readFile(path.join(directory, 'guias', 'one.html'), 'utf8');
    const sitemap = await readFile(path.join(directory, 'sitemap.xml'), 'utf8');
    assert.match(index, /noindex, nofollow, noarchive/);
    assert.match(guide, /noindex, nofollow, noarchive/);
    assert.doesNotMatch(index, /cloud\.umami\.is|application\/ld\+json|railway\.app/);
    assert.doesNotMatch(guide, /railway\.app|index,follow/);
    assert.doesNotMatch(guide, /__ORKTO_PUBLIC_ORIGIN__/);
    assert.doesNotMatch(sitemap, /railway\.app/);
    assert.equal(await readFile(path.join(directory, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
