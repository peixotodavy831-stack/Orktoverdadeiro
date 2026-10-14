import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { errorClass } from './staging-browser-security.mjs';

const origin = process.argv.find(arg => arg.startsWith('--url='))?.slice(6).replace(/\/$/, '') || 'https://orkto-staging-fgfh3m49v-peixoto-s-projects1.vercel.app';
const sha = process.argv.find(arg => arg.startsWith('--sha='))?.slice(6) || '65d5f8ac8284e495bd95d742172da11f6a25b782';
if (!/^https:\/\/orkto-staging-[a-z0-9-]+\.vercel\.app$/.test(origin) || !/^[a-f0-9]{40}$/.test(sha)) throw new Error('EXACT_STAGING_CANDIDATE_REQUIRED');
const link = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
if (link.projectId !== 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc' || link.projectName !== 'orkto-staging') throw new Error('STAGING_TARGET_MISMATCH');
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('INSECURE_TLS_OVERRIDE_REJECTED');
const token = process.env.VERCEL_OIDC_TOKEN;
const claims = token && JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
if (!claims || claims.exp <= Date.now() / 1000) throw new Error('FRESH_OIDC_REQUIRED');
const headers = { 'x-vercel-trusted-oidc-idp-token': token };
const records = [];
const record = (test, pass, evidence) => { records.push({ test, status: pass ? 'PASS' : 'FAIL', ...evidence }); };
async function run() {
  for (const route of ['/api/health', '/api/ready']) {
    const id = crypto.randomUUID();
    const response = await fetch(origin + route, { headers: { ...headers, 'x-request-id': id }, redirect: 'manual', signal: AbortSignal.timeout(30000) });
    const data = await response.json();
    record(route === '/api/health' ? 'HEALTH' : 'READINESS', response.status === 200 && (data.status === 'ok' || data.status === 'ready'), { http_status: response.status, environment: data.environment });
    record('REQUEST_CORRELATION_HEADER', response.headers.get('x-request-id') === id, {});
    record('SECURITY_HEADERS', response.headers.get('x-content-type-options') === 'nosniff' && Boolean(response.headers.get('strict-transport-security')), {});
  }
  const denied = await fetch(origin + '/api/clients', { headers, redirect: 'manual', signal: AbortSignal.timeout(30000) });
  record('ANONYMOUS_PRIVATE_ROUTE_DENIED', denied.status === 401, { http_status: denied.status });
  const corsId = crypto.randomUUID();
  const cors = await fetch(origin + '/api/clients', { headers: { ...headers, Origin: 'https://attacker.invalid', 'x-request-id': corsId }, redirect: 'manual', signal: AbortSignal.timeout(30000) });
  record('FOREIGN_ORIGIN_NOT_ALLOWED', cors.status === 403 && cors.headers.get('access-control-allow-origin') !== 'https://attacker.invalid' && cors.headers.get('access-control-allow-origin') !== '*', { http_status: cors.status, request_id: corsId });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: false });
    await context.route('**/*', async route => {
      const request = route.request(); const clean = { ...request.headers() };
      delete clean['x-vercel-trusted-oidc-idp-token'];
      await route.continue({ headers: new URL(request.url()).origin === origin ? { ...clean, ...headers } : clean });
    });
    const page = await context.newPage();
    const pageErrors = []; page.on('pageerror', () => pageErrors.push('APPLICATION_ERROR'));
    await page.goto(origin, { waitUntil: 'networkidle' });
    const metadata = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      robots: document.querySelector('meta[name="robots"]')?.getAttribute('content'),
      productionReference: /qneqljlphgkptebsaonb|orktoverdadeiro-production\.up\.railway\.app/.test(document.documentElement.outerHTML),
      timing: performance.getEntriesByType('navigation').map(item => ({ response_ms: item.responseEnd, dom_ms: (item).domContentLoadedEventEnd, transfer_bytes: item.transferSize })),
      assets: performance.getEntriesByType('resource').filter(item => item.name.endsWith('.js')).map(item => ({ bytes: item.transferSize, duration_ms: Math.round(item.duration) })),
      unnamed: Array.from(document.querySelectorAll('button,a[href],input:not([type="hidden"])')).filter(element => {
        if (!element.getClientRects().length) return false;
        return !(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.textContent?.trim() || element.getAttribute('placeholder') || element.getAttribute('title') || element.querySelector('img[alt]'));
      }).length,
    }));
    record('STAGING_HTML_METADATA', metadata.lang === 'pt-BR' && metadata.canonical?.startsWith(origin) && metadata.robots?.includes('noindex') && !metadata.productionReference, {});
    record('PUBLIC_ACCESSIBLE_NAMES', metadata.unnamed === 0, { unnamed_controls: metadata.unnamed });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      record('PUBLIC_RESPONSIVE', !overflow, { width });
    }
    await page.keyboard.press('Tab');
    record('KEYBOARD_FOCUS', await page.evaluate(() => document.activeElement !== document.body), {});
    record('PUBLIC_CONSOLE', pageErrors.length === 0, { errors: pageErrors.length });
    records.push({ test: 'PUBLIC_PERFORMANCE_BASELINE', status: 'MEASURED', ...metadata.timing[0], javascript_requests: metadata.assets.length,
      javascript_duration_ms: metadata.assets.reduce((sum, item) => sum + item.duration_ms, 0) });
    await context.close();
  } finally { await browser.close(); }
}
try { await run(); }
catch (error) { records.push({ test: 'TECHNICAL_PROBE', status: 'FAIL', error_class: errorClass(error) }); }
const directory = fileURLToPath(new URL(`../../test-results/technical-gates-${sha.slice(0,7)}/`, import.meta.url));
mkdirSync(directory, { recursive: true });
writeFileSync(directory + 'public-preview.json', JSON.stringify({ candidate_sha: sha, records }, null, 2));
for (const row of records) console.log(JSON.stringify(row));
if (records.some(row => row.status === 'FAIL')) process.exitCode = 1;
