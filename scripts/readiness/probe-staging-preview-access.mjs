import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

// Read-only access probe. Never retain tokens, response bodies, browser storage,
// traces, or screenshots; attach the token only to this immutable Preview origin.
const projectId = 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc';
const origin = 'https://orkto-staging-fgfh3m49v-peixoto-s-projects1.vercel.app';
const linked = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
if (linked.projectId !== projectId || linked.projectName !== 'orkto-staging') {
  console.error('STAGING_PROJECT_BOUNDARY_MISMATCH');
  process.exit(2);
}
const token = process.env.VERCEL_OIDC_TOKEN;
console.log(JSON.stringify({ test: 'OIDC_PROCESS_INJECTION', token_present: Boolean(token) }));
if (!token) process.exit(2);
try {
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  if (!Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) throw new Error();
} catch {
  console.error('OIDC_TOKEN_INVALID_OR_EXPIRED');
  process.exit(2);
}
const headers = { 'x-vercel-trusted-oidc-idp-token': token };
let indexHtml;
for (const path of ['/', '/api/health', '/api/ready']) {
  const response = await fetch(`${origin}${path}`, { headers, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
  const body = await response.text();
  if (path === '/' && response.status === 200) indexHtml = body;
  const protectedPage = /Authentication Required|Vercel Authentication|TRUSTED_SOURCES_ENVIRONMENT_MISMATCH/.test(body);
  const code = body.includes('TRUSTED_SOURCES_ENVIRONMENT_MISMATCH')
    ? 'TRUSTED_SOURCES_ENVIRONMENT_MISMATCH' : protectedPage ? 'VERCEL_PROTECTION' : 'APPLICATION_RESPONSE';
  console.log(JSON.stringify({ test: 'OIDC_HTTP', path, status: response.status, code }));
  if (response.status !== 200 || protectedPage) process.exitCode = 2;
}
// Inspect only public JavaScript for the compiled Supabase target, then verify
// that its public credential is accepted by staging Auth. No key is retained.
const scripts = [...String(indexHtml || '').matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map(match => match[1]);
const refs = new Set();
let publicKey;
let privilegedPublicCredential = false;
for (const script of scripts.slice(0, 5)) {
  const asset = new URL(script, origin);
  if (asset.origin !== origin || !asset.pathname.startsWith('/assets/')) continue;
  const response = await fetch(asset, { headers, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) continue;
  const source = await response.text();
  for (const match of source.matchAll(/https:\/\/([a-z]{20})\.supabase\.co/g)) refs.add(match[1]);
  for (const match of source.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try {
      const claims = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString('utf8'));
      if (claims.role === 'service_role') privilegedPublicCredential = true;
      if (claims.ref === 'ghrjongiodziasupakrk' && claims.role === 'anon') publicKey = match[0];
    } catch { /* non-JWT public string */ }
  }
  publicKey ||= source.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
}
const targetVerified = refs.size === 1 && refs.has('ghrjongiodziasupakrk') && !privilegedPublicCredential;
console.log(JSON.stringify({ test: 'PREVIEW_PUBLIC_SUPABASE_CONFIG', staging_target: targetVerified,
  privileged_credential_found: privilegedPublicCredential, public_key_present: Boolean(publicKey) }));
if (!targetVerified) process.exitCode = 2;
if (targetVerified && publicKey) {
  const response = await fetch('https://ghrjongiodziasupakrk.supabase.co/auth/v1/settings', {
    headers: { apikey: publicKey }, redirect: 'manual', signal: AbortSignal.timeout(30_000),
  });
  console.log(JSON.stringify({ test: 'STAGING_PUBLIC_AUTH_KEY', status: response.status }));
  if (response.status !== 200) process.exitCode = 2;
}
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  await context.route('**/*', async route => {
    const request = route.request();
    const original = { ...request.headers() };
    delete original['x-vercel-trusted-oidc-idp-token'];
    await route.continue({ headers: new URL(request.url()).origin === origin ? { ...original, ...headers } : original });
  });
  const page = await context.newPage();
  const response = await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  const application = new URL(page.url()).origin === origin
    && await page.getByRole('button', { name: 'Entrar', exact: true }).count() > 0;
  console.log(JSON.stringify({ test: 'OIDC_PLAYWRIGHT', status: response?.status(), application_login_visible: application }));
  if (!application) process.exitCode = 2;
} finally {
  await browser.close();
}
