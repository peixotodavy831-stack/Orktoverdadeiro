import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

test('Auth UI harness: recovery, partial failure, confirmation, provider visibility and reset errors', async () => {
  // This harness bundles the real components with a test-only Auth adapter.
  // No Supabase/Vercel credentials, emails or remote operations are involved.
  const root = await mkdtemp(resolve('.tmp-auth-ui-'));
  let server, browser;
  try {
    await writeFile(join(root, 'auth-stub.ts'), `
const calls = []; window.__authCalls = calls;
export const supabase = { auth: {
  getUser: async () => { calls.push('getUser'); return { data: { user: location.search.includes('expired') ? null : { id: 'synthetic' } }, error: null }; },
  updateUser: async () => { calls.push('updateUser'); return {error:null}; },
  signOut: async () => { calls.push('signOut'); return {error: location.search.includes('partial') && calls.filter(x=>x==='signOut').length===1 ? {status:503} : null}; },
  resetPasswordForEmail: async () => { calls.push('reset'); return {error:{status:503}}; },
  signInWithOAuth: async () => { throw new Error('disabled provider must never be invoked'); }
}};`);
    await writeFile(join(root, 'entry.tsx'), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import Recovery from '../src/components/PasswordRecovery'; import {SignInPage} from '../src/components/ui/sign-in-flow-1';
window.__signedIn = false;
const done=()=>{document.body.dataset.complete='true';};
createRoot(document.getElementById('root')).render(location.search.includes('signin') ?
  <SignInPage onSignInSuccess={()=>{window.__signedIn=true;}} onSignUp={async()=>({confirmationRequired:true})} /> : <Recovery onComplete={done}/>);`);
    await build({ entryPoints: [join(root, 'entry.tsx')], outfile: join(root, 'app.js'), bundle: true, platform: 'browser', format: 'esm', jsx: 'automatic',
      define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://auth.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('synthetic-public-configuration'), 'import.meta.env.DEV': 'false', 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'test-only-auth', setup(builder) {
        builder.onResolve({ filter: /(?:\/lib\/supabase|^\.\.\/lib\/supabase)$/ }, () => ({ path: join(root, 'auth-stub.ts') }));
        builder.onResolve({ filter: /canvas-reveal-effect/ }, () => ({ path: 'canvas', namespace: 'test-stub' }));
        builder.onLoad({ filter: /.*/, namespace: 'test-stub' }, () => ({ contents: 'export function CanvasRevealEffect(){return null;}' }));
      } }], logLevel: 'silent' });
    const js = await readFile(join(root, 'app.js'));
    server = createServer((req, res) => {
      res.setHeader('content-type', req.url === '/app.js' ? 'text/javascript' : 'text/html');
      res.end(req.url === '/app.js' ? js : '<html lang="pt-BR"><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
    });
    await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
    browser = await chromium.launch(); const context = await browser.newContext({ ignoreHTTPSErrors: false });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const blocked = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.origin === 'https://auth.invalid' && url.pathname === '/auth/v1/settings') return route.fulfill({ json: { external: { google: false } } });
      blocked.push('UNEXPECTED_EXTERNAL_REQUEST'); return route.abort();
    });
    const page = await context.newPage();
    await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
    const expect = (await import('@playwright/test')).expect;
    const fill = async () => { await page.getByLabel('Nova senha', {exact:true}).fill('Synthetic-New-Password-1!'); await page.getByLabel('Confirmar nova senha').fill('Synthetic-New-Password-1!'); };
    await page.goto(origin + '/?expired'); await fill(); await page.getByRole('button', {name:'Salvar nova senha'}).click();
    await expect(page.getByRole('alert')).toContainText('O link expirou');
    assert.deepEqual(await page.evaluate(() => window.__authCalls), ['getUser']);
    await page.goto(origin + '/?partial'); await fill(); await page.getByRole('button', {name:'Salvar nova senha'}).click();
    await expect(page.getByRole('alert')).toContainText('Senha atualizada');
    await page.getByRole('button', {name:'Encerrar sessões',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Entre novamente');
    assert.deepEqual(await page.evaluate(() => window.__authCalls), ['getUser','updateUser','signOut','signOut']);
    await expect(page.getByLabel('Nova senha',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Voltar para entrar'}).click();
    await expect(page.locator('body')).toHaveAttribute('data-complete','true');
    await page.goto(origin + '/?signin');
    await expect(page.getByRole('button', {name:'Entrar com Google'})).toHaveCount(0);
    await page.getByRole('button',{name:'Criar Conta',exact:true}).click();
    await page.getByPlaceholder('Seu nome completo').fill('Synthetic operator');
    await page.getByPlaceholder('seu@email.com').fill('operator@staging.synthetic');
    await page.getByLabel('Senha para criar conta').fill('Synthetic-New-Password-1!');
    await page.getByRole('button',{name:'Criar Conta',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('e-mail de confirmação');
    assert.equal(await page.evaluate(()=>window.__signedIn),false);
    await expect(page.getByLabel('Senha para criar conta')).toHaveValue('');
    await page.goto(origin + '/?signin'); await page.getByRole('button',{name:'Esqueci minha senha / código de acesso'}).click();
    await page.getByLabel('E-mail para recuperação').fill('operator@staging.synthetic');
    await page.getByRole('button',{name:'Enviar Link de Acesso'}).click();
    await expect(page.getByRole('alert')).toContainText('Não foi possível enviar');
    await expect(page.getByRole('button',{name:'Enviar Link de Acesso'})).toBeEnabled();
    assert.deepEqual(blocked, []);
    await context.close();
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(done => server.close(done));
    await rm(root, { recursive: true, force: true });
  }
});
