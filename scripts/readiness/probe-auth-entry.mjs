import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { errorClass } from './staging-browser-security.mjs';

const origin = process.argv.find(arg => arg.startsWith('--url='))?.slice(6).replace(/\/$/, '');
const sha = process.argv.find(arg => arg.startsWith('--sha='))?.slice(6);
const link = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
if (!/^https:\/\/orkto-staging-[a-z0-9-]+\.vercel\.app$/.test(origin || '') || !/^[a-f0-9]{40}$/.test(sha || '')
  || link.projectId !== 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc' || link.projectName !== 'orkto-staging') throw new Error('EXACT_STAGING_CANDIDATE_REQUIRED');
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('INSECURE_TLS_OVERRIDE_REJECTED');
const token = process.env.VERCEL_OIDC_TOKEN;
const claims = token && JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
if (!claims || claims.exp <= Date.now() / 1000) throw new Error('FRESH_OIDC_REQUIRED');
const directory = fileURLToPath(new URL(`../../test-results/technical-gates-${sha.slice(0, 7)}/`, import.meta.url));
mkdirSync(directory, { recursive: true });
const records = [];
const record = (test, status, extra = {}) => records.push({ test, status, ...extra });
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: false });
  await context.route('**/*', async route => {
    const request = route.request(); const headers = { ...request.headers() };
    delete headers['x-vercel-trusted-oidc-idp-token'];
    if (new URL(request.url()).origin === origin) headers['x-vercel-trusted-oidc-idp-token'] = token;
    await route.continue({ headers });
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', () => errors.push('APPLICATION_ERROR'));
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continuar com e-mail' })).toBeVisible();
  record('LOGIN_ENTRY', 'PASS');
  await expect(page.getByRole('button', { name: 'Entrar com Google' })).toHaveCount(0);
  record('DISABLED_OAUTH_HIDDEN', 'PASS');
  await page.getByRole('button', { name: 'Criar Conta', exact: true }).click();
  await expect(page.getByLabel('Senha para criar conta')).toHaveAttribute('minlength', '12');
  await expect(page.getByLabel('Senha para criar conta')).toHaveAttribute('autocomplete', 'new-password');
  record('SIGNUP_PASSWORD_SEMANTICS', 'PASS');
  // No signup, recovery email or password mutation is submitted to the provider.
  await page.goto(origin + '/?readiness=recovery#type=recovery', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Definir nova senha', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nova senha', { exact: true })).toHaveAttribute('minlength', '12');
  await expect(page.getByLabel('Confirmar nova senha', { exact: true })).toBeVisible();
  record('RECOVERY_SCREEN_ROUTING', 'PASS');
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (overflow) throw new Error('RECOVERY_OVERFLOW');
    await page.screenshot({ path: directory + `recovery-${width}.png`, fullPage: true });
    record('RECOVERY_RESPONSIVE', 'PASS', { width });
  }
  await page.keyboard.press('Tab');
  if (!await page.evaluate(() => document.activeElement !== document.body)) throw new Error('FOCUS_MISSING');
  record('RECOVERY_KEYBOARD', 'PASS');
  if (errors.length) throw new Error('PUBLIC_APPLICATION_ERROR');
  record('PUBLIC_APPLICATION_ERRORS', 'PASS', { count: errors.length });
  await context.close();
} catch (error) { record('AUTH_ENTRY_PROBE', 'FAIL', { error_class: errorClass(error) }); }
finally { await browser?.close(); }
writeFileSync(directory + 'auth-entry.json', JSON.stringify({ candidate_sha: sha, scope: 'PUBLIC_UI_ONLY_NO_EMAIL_OR_PASSWORD_WRITE', records }, null, 2));
for (const row of records) console.log(JSON.stringify(row));
if (records.some(row => row.status === 'FAIL')) process.exitCode = 1;
