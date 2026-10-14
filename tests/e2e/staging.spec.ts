import { expect, type Page, type Request } from '@playwright/test';
import { test, checkpoint } from '../../scripts/readiness/staging-safe-test';
import { syntheticIdentityGroup } from '../../scripts/readiness/staging-e2e-config.mjs';
import { observeRequest } from '../../scripts/readiness/staging-observed-request';
import { safeRoute } from '../../scripts/readiness/staging-diagnostics.mjs';
import { errorClass } from '../../scripts/readiness/staging-browser-security.mjs';
import { contactRowByCreatedName } from './staging-fixtures';

const productionHosts = new Set([
  'orkto.vercel.app', 'orkto.co', 'www.orkto.co', 'orkto.com.br',
  'orktoverdeiro-production.up.railway.app', 'qneqljlphgkptebsaonb.supabase.co',
]);

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`STAGING_E2E_CONFIG_REQUIRED:${name}`);
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function protectionHeaders(): Record<string, string> {
  const oidc = optional('VERCEL_OIDC_TOKEN');
  if (oidc) return { 'x-vercel-trusted-oidc-idp-token': oidc };
  const bypass = optional('ORKTO_STAGING_E2E_BYPASS_SECRET');
  return bypass ? { 'x-vercel-protection-bypass': bypass } : {};
}

async function establishPreviewAccess(page: Page): Promise<void> {
  const accessUrl = optional('ORKTO_STAGING_PREVIEW_ACCESS_URL');
  if (!accessUrl) return;
  const expected = new URL(required('ORKTO_STAGING_PREVIEW_URL'));
  const access = new URL(accessUrl);
  if (access.origin !== expected.origin || access.pathname !== '/'
    || [...access.searchParams.keys()].some(key => key !== '_vercel_share')
    || !access.searchParams.get('_vercel_share')) {
    throw new Error('STAGING_PREVIEW_ACCESS_URL_REQUIRED_OR_UNSAFE');
  }
  await page.goto(accessUrl);
}

function assertSyntheticIdentity(email: string, label: 'A' | 'B'): void {
  if (!syntheticIdentityGroup(email, label)) throw new Error(`STAGING_E2E_SYNTHETIC_IDENTITY_REQUIRED:${label}`);
}

async function signIn(page: Page, email: string, password: string, group: 'A' | 'B'): Promise<void> {
  checkpoint(`AUTH_${group}`);
  await test.step(`AUTH_${group}`, async () => {
  const previewOrigin = new URL(required('ORKTO_STAGING_PREVIEW_URL')).origin;
  const headers = protectionHeaders();
  await page.route('**/*', async route => {
    const original = { ...route.request().headers() };
    delete original['x-vercel-trusted-oidc-idp-token'];
    delete original['x-vercel-protection-bypass'];
    if (new URL(route.request().url()).origin === previewOrigin) {
      await route.continue({ headers:{ ...original, ...headers } });
    } else {
      await route.continue({ headers: original });
    }
  });
  await establishPreviewAccess(page);
  await page.goto('/');
  await page.getByRole('button', { name:'Entrar', exact:true }).click();
  await page.getByRole('textbox', { name: 'Seu e-mail' }).fill(email);
  await page.getByRole('button', { name: 'Continuar com e-mail' }).click();
  await page.getByPlaceholder('Sua senha').waitFor({ state: 'visible' });
  await page.getByPlaceholder('Sua senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  const onboarding = page.getByRole('heading', { name: 'Onboarding Inteligente' });
  const navigation = page.getByRole('navigation', { name: 'Módulos' });
  await onboarding.or(navigation).first().waitFor({ state:'visible', timeout:30_000 });
  if (await onboarding.isVisible()) {
    await page.getByPlaceholder('Ex: Roberto Mecânica Autocenter').fill(`Workspace ${group} Synthetic`);
    await page.getByPlaceholder('Ex: 11987654321').fill(group === 'A' ? '11999990001' : '11999990002');
    await page.getByRole('button', { name:'Avançar para Estilo & Tom' }).click();
    await page.getByRole('button', { name:/Salvar e Criar Primeiro Orçamento/ }).click();
    await page.getByRole('heading', { name:'Criar Primeiro Orçamento' }).waitFor({ state:'visible' });
    await page.getByPlaceholder('Ex: João Silva').fill(`Customer ${group} Synthetic`);
    await page.getByPlaceholder('Ex: 11999998888').fill(group === 'A' ? '11999990011' : '11999990022');
    await page.getByPlaceholder('Ex: Pintura de 3 cômodos').fill('Serviço sintético');
    await page.getByPlaceholder('Ex: 1200').fill('100');
    await page.getByRole('button', { name:/Criar Primeiro Orçamento/ }).click();
    await page.getByRole('button', { name:/Ir para o Painel/ }).click();
  }
  await navigation.waitFor({ state: 'visible' });
  await expect(navigation.getByRole('button', { name: 'Hoje', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite|Boa madrugada),/ })).toBeVisible();
  });
}

async function capture(page: Page, name: string): Promise<void> {
  // Screenshots are withheld until a reviewed visual-redaction pipeline exists.
  void page; void name;
}

async function ensureSyntheticClient(page: Page, group: 'A' | 'B'): Promise<void> {
  const name = `Customer ${group} Synthetic`;
  // Wait for the loaded collection or the valid empty state. A workspace can
  // also contain clients other than this test's synthetic record.
  await expect(page.getByRole('table').first()
    .or(page.getByText('Sem Clientes Cadastrados', { exact: true })).first()).toBeVisible();
  if (await page.getByRole('row', { name: new RegExp(name) }).count()) return;
  await page.getByRole('button', { name: 'Novo Cliente' }).click();
  await page.getByPlaceholder('Ex: Pedro Alves Silva').fill(name);
  await page.getByPlaceholder('Ex: (11) 99999-9999').fill(group === 'A' ? '+5511999990011' : '+5511999990022');
  const [save] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/clients' && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Salvar Registro' }).click(),
  ]);
  const saveBody: unknown = await save.json().catch(() => null);
  const category = saveBody && typeof saveBody === 'object' && 'category' in saveBody
    ? String(saveBody.category).slice(0, 80) : 'no_structured_category';
  expect(save.status(), `browser CREATE_CLIENT returned HTTP ${save.status()}, ${category}`).toBe(201);
  await expect(page.getByRole('row', { name: new RegExp(name) }).first()).toBeVisible();
}

test('health and readiness confirm the deployed app is staging and its database is ready', async ({ request }) => {
  const api = observeRequest(request);
  const accessUrl = optional('ORKTO_STAGING_PREVIEW_ACCESS_URL');
  if (accessUrl) await api.get(accessUrl);
  const headers=protectionHeaders();
  const health = await api.get('/api/health',{ maxRedirects: 0,headers});
  expect(health.ok()).toBeTruthy();
  expect((await health.json()).status).toBe('ok');

  const ready = await api.get('/api/ready',{ maxRedirects: 0,headers});
  expect(ready.status()).toBe(200);
  const body = await ready.json();
  expect(body.status).toBe('ready');
  expect(body.environment).toBe('staging');
  expect(JSON.stringify(body)).not.toMatch(/service_role|refresh_token|access_token|secret/i);
});

test('real Auth A/B, tenant-visible records, navigation, refresh, logout and responsive shell', async ({ page }) => {
  const api = observeRequest(page.request);
  const emailA = required('ORKTO_STAGING_E2E_USER_A_EMAIL');
  const passwordA = required('ORKTO_STAGING_E2E_USER_A_PASSWORD');
  const emailB = required('ORKTO_STAGING_E2E_USER_B_EMAIL');
  const passwordB = required('ORKTO_STAGING_E2E_USER_B_PASSWORD');
  assertSyntheticIdentity(emailA, 'A');
  assertSyntheticIdentity(emailB, 'B');

  const observedHosts = new Set<string>();
  const pageErrors: string[] = [];
  const serverFailures: string[] = [];
  const networkFailures: string[] = [];
  const requestStarted = new WeakMap<Request, number>();
  const responseStatus = new WeakMap<Request, number>();
  const previewOrigin = new URL(required('ORKTO_STAGING_PREVIEW_URL')).origin;
  let publicKey: string | null = null;
  let appBearer: string | null = null;
  page.on('request', request => {
    requestStarted.set(request, performance.now());
    try {
      const url = new URL(request.url());
      observedHosts.add(url.hostname.toLowerCase());
      if (url.hostname === 'ghrjongiodziasupakrk.supabase.co') publicKey ||= request.headers().apikey || null;
      if (url.origin === previewOrigin && url.pathname.startsWith('/api/')) {
        const authorization = request.headers().authorization || '';
        if (authorization.startsWith('Bearer ')) appBearer = authorization;
      }
    } catch { /* ignored */ }
  });
  page.on('pageerror', () => pageErrors.push('uncaught_page_error'));
  page.on('requestfailed', request => {
    try {
      const url = new URL(request.url());
      const failure = request.failure()?.errorText || '';
      const classified = errorClass({ message: failure });
      console.log('ORKTO_SAFE_EVENT ' + JSON.stringify({ kind: 'request', ...safeRoute(request.url()), method: request.method(), status: responseStatus.get(request) || 0,
        transport_code: failure.match(/\b(ERR_ABORTED|ERR_FAILED|ERR_CONNECTION_RESET|ERR_CERT_AUTHORITY_INVALID|ERR_TIMED_OUT|ECONNRESET|ETIMEDOUT)\b/)?.[1],
        duration_ms: Math.round(performance.now() - (requestStarted.get(request) ?? performance.now())),
        failure: ['TIMEOUT', 'TLS_CERTIFICATE_ERROR'].includes(classified) ? classified : 'NETWORK_ERROR' }));
      if (url.origin === previewOrigin && !/ERR_ABORTED|cancelled/i.test(failure)) networkFailures.push(`${request.method()} ${url.pathname}`);
    } catch { networkFailures.push('unparseable_same_origin_request'); }
  });
  page.on('response', response => {
    responseStatus.set(response.request(), response.status());
    if (response.status() >= 500 && new URL(response.url()).origin === previewOrigin) {
      serverFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  page.on('requestfinished', async request => {
    try {
      const target = new URL(request.url());
      if (target.hostname !== 'ghrjongiodziasupakrk.supabase.co' && target.origin !== previewOrigin) return;
      const response = await request.response();
      if (!response) return;
      console.log('ORKTO_SAFE_EVENT ' + JSON.stringify({ kind: 'request', ...safeRoute(request.url()), method: request.method(), status: response.status(),
        duration_ms: Math.round(performance.now() - (requestStarted.get(request) ?? performance.now())), failure: response.status() >= 500 ? 'HTTP_ERROR' : 'NONE' }));
    } catch { /* diagnostics must not change the request or the test result */ }
  });

  await signIn(page, emailA, passwordA, 'A');
  checkpoint('A_WORKSPACE_INBOX');
  const bearerA = appBearer;
  expect(bearerA && publicKey, 'synthetic A auth and public configuration must be available in memory').toBeTruthy();
  const workspaceAResponse = await api.get('/api/operational/workspace', { maxRedirects: 0,
    headers: { Authorization: bearerA!, ...protectionHeaders() },
  });
  expect(workspaceAResponse.status()).toBe(200);
  const workspaceAPayload = await workspaceAResponse.json();
  const workspaceA = workspaceAPayload.workspace?.id as string;
  const ownerA = workspaceAPayload.members?.find((member: { role?: string }) => member.role === 'owner')?.user_id as string;
  expect(workspaceA).toMatch(/^[0-9a-f-]{36}$/i);
  expect(ownerA).toMatch(/^[0-9a-f-]{36}$/i);
  const conversationAResponse = await api.get('/api/conversations', { maxRedirects: 0,
    headers: { Authorization: bearerA!, ...protectionHeaders() },
  });
  expect(conversationAResponse.status()).toBe(200);
  const conversationA = (await conversationAResponse.json())?.[0]?.id as string;
  expect(conversationA).toMatch(/^[0-9a-f-]{36}$/i);
  const readKey = crypto.randomUUID();
  for (const replay of [false, true]) {
    const marked = await api.post(`/api/conversations/${conversationA}/read`, { maxRedirects: 0,
      headers: { Authorization: bearerA!, 'x-idempotency-key': readKey, ...protectionHeaders() },
    });
    expect(marked.status(), 'staging Inbox read must use the authorized gateway').toBe(200);
    expect((await marked.json()).idempotentReplay).toBe(replay);
  }
  const changed = await api.patch(`/api/conversations/${conversationA}`, { maxRedirects: 0,
    headers: { Authorization: bearerA!, 'x-idempotency-key': crypto.randomUUID(), ...protectionHeaders() },
    data: { status: 'active' },
  });
  expect(changed.status(), 'staging Inbox status must use the authorized gateway').toBe(200);
  expect((await changed.json()).data?.status).toBe('active');
  checkpoint('A_CLIENT_CONTACT');
  await expect(page.getByText('Workspace A Synthetic', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clientes' }).click();
  await expect(page.getByRole('heading', { name: 'Base de Clientes' })).toBeVisible();
  await ensureSyntheticClient(page, 'A');
  const clientRowA=page.getByRole('row', { name: /Customer A Synthetic/ }).first();
  await expect(clientRowA).toBeVisible();
  await expect(page.getByText('Customer B Synthetic', { exact: true })).toHaveCount(0);
  await clientRowA.getByRole('button',{name:'Histórico'}).click();
  const clientDialog=page.getByRole('dialog',{name:/Detalhes de Customer A Synthetic/});
  await expect(clientDialog).toBeVisible();
  // The seeded contact and prior runs have the same display name. Identify this
  // new operation uniquely; never choose an arbitrary first contact to edit.
  const createdContactName = `Contact A Synthetic ${crypto.randomUUID()}`;
  await clientDialog.getByRole('textbox',{name:'Nome do contato'}).fill(createdContactName);
  await clientDialog.getByRole('textbox',{name:'Telefone do contato'}).fill('+5511999990041');
  await clientDialog.getByRole('textbox',{name:'Cargo do contato'}).fill('Compras');
  const [createdContactResponse]=await Promise.all([
    page.waitForResponse(response=>new URL(response.url()).pathname==='/api/contacts'&&response.request().method()==='POST'),
    clientDialog.getByRole('button',{name:'Adicionar contato'}).click(),
  ]);
  const createdContactBody=await createdContactResponse.json();
  expect(createdContactResponse.status(),`browser CREATE_CONTACT returned ${createdContactResponse.status()}`).toBe(201);
  const contactA=createdContactBody?.data?.id as string;
  expect(contactA).toMatch(/^[0-9a-f-]{36}$/i);
  await expect(clientDialog.getByText(createdContactName,{exact:true})).toHaveCount(1);
  await expect(clientDialog.getByText(createdContactName,{exact:true})).toBeVisible();
  await clientDialog.getByRole('button',{name:`Editar contato ${createdContactName}`,exact:true}).click();
  await clientDialog.getByRole('textbox',{name:'Cargo do contato'}).fill('Decisor');
  const [updatedContactResponse]=await Promise.all([
    page.waitForResponse(response=>new URL(response.url()).pathname===`/api/contacts/${contactA}`&&response.request().method()==='PATCH'),
    clientDialog.getByRole('button',{name:'Salvar contato'}).click(),
  ]);
  expect(updatedContactResponse.status(),'browser UPDATE_CONTACT must use the gateway').toBe(200);
  const editedContactRow = contactRowByCreatedName(clientDialog, createdContactName);
  await expect(editedContactRow).toHaveCount(1);
  await expect(editedContactRow.getByText(/Decisor/)).toBeVisible();
  await clientDialog.getByRole('button',{name:'Fechar detalhes do cliente'}).click();
  await capture(page, 'a-clients-desktop-1440.png');
  await page.reload();
  await page.getByRole('button', { name: 'Clientes' }).waitFor({ state: 'visible' });
  await expect(page.getByText('Workspace A Synthetic', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clientes' }).click();
  const reloadedClientRowA=page.getByRole('row', { name: /Customer A Synthetic/ }).first();
  await expect(reloadedClientRowA).toBeVisible();
  await reloadedClientRowA.getByRole('button',{name:'Histórico'}).click();
  const reloadedContactRow = contactRowByCreatedName(page.getByRole('dialog',{name:/Detalhes de Customer A Synthetic/}), createdContactName);
  await expect(reloadedContactRow).toHaveCount(1);
  await expect(reloadedContactRow.getByText(/Decisor/)).toBeVisible();
  await page.getByRole('button',{name:'Fechar detalhes do cliente'}).click();

  checkpoint('A_NAVIGATION');
  await page.getByRole('button', { name: 'Negócios' }).click();
  await expect(page.getByRole('main')).toBeVisible();
  await capture(page, 'a-deals-desktop-1440.png');
  await page.getByRole('button', { name: 'Catálogo' }).click();
  await expect(page.getByRole('main')).toBeVisible();
  await capture(page, 'a-catalog-desktop-1440.png');
  await page.getByRole('button', { name: 'Propostas' }).click();
  await expect(page.getByRole('main')).toBeVisible();
  await capture(page, 'a-proposals-desktop-1440.png');
  const [inboxRead] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/priority/inbox' && response.request().method() === 'GET'),
    page.getByRole('button', { name: 'Inbox' }).click(),
  ]);
  expect(inboxRead.status(), 'Inbox must load from the authenticated staging API').toBe(200);
  const inboxPayload = await inboxRead.json();
  expect(Array.isArray(inboxPayload?.data), 'Inbox must return a persisted collection').toBe(true);
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();
  await capture(page, 'a-inbox-desktop-1440.png');
  const [wiaActionsRead] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/wia/actions' && new URL(response.url()).searchParams.get('status') === 'awaiting_approval' && response.request().method() === 'GET'),
    page.getByRole('button', { name: 'WIA' }).click(),
  ]);
  expect(wiaActionsRead.status(), 'WIA approval history must load from the authenticated staging API').toBe(200);
  const wiaActionsPayload = await wiaActionsRead.json();
  expect(Array.isArray(wiaActionsPayload?.data), 'WIA must return persisted approval actions').toBe(true);
  await expect(page.getByRole('heading', { name: 'WIA' })).toBeVisible();
  await capture(page, 'a-wia-desktop-1440.png');

  checkpoint('A_RESPONSIVE_LOGOUT');
  await page.getByRole('button', { name: 'Hoje', exact: true }).click();
  await page.getByRole('button', { name: 'Claro' }).click();
  await capture(page, 'a-today-light-1440.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, 'a-today-mobile-390.png');
  await expect(page.getByRole('navigation', { name: 'Navegação móvel principal' })).toBeVisible();
  await page.getByRole('button', { name: 'Inbox' }).click();
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();
  await capture(page, 'a-inbox-mobile-390.png');
  await page.setViewportSize({ width: 768, height: 1024 });
  await capture(page, 'a-inbox-tablet-768.png');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Hoje', exact: true }).click();
  await capture(page, 'a-today-desktop-1280.png');
  await page.getByRole('button', { name: 'Escuro' }).click();
  await capture(page, 'a-today-dark-1280.png');
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await signIn(page, emailB, passwordB, 'B');
  checkpoint('B_WORKSPACE_ISOLATION');
  const bearerB = appBearer;
  expect(bearerB && bearerB !== bearerA, 'synthetic users must have distinct live sessions').toBeTruthy();
  const workspaceBResponse = await api.get('/api/operational/workspace', { maxRedirects: 0,
    headers: { Authorization: bearerB!, ...protectionHeaders() },
  });
  expect(workspaceBResponse.status()).toBe(200);
  const workspaceBPayload = await workspaceBResponse.json();
  const workspaceB = workspaceBPayload.workspace?.id as string;
  const ownerB = workspaceBPayload.members?.find((member: { role?: string }) => member.role === 'owner')?.user_id as string;
  expect(workspaceB).toMatch(/^[0-9a-f-]{36}$/i);
  expect(ownerB).toMatch(/^[0-9a-f-]{36}$/i);
  expect(workspaceA).not.toBe(workspaceB);
  const foreignRead = await api.post(`/api/conversations/${conversationA}/read`, { maxRedirects: 0,
    headers: { Authorization: bearerB!, 'x-idempotency-key': crypto.randomUUID(), ...protectionHeaders() },
  });
  expect(foreignRead.status(), 'User B cannot mutate User A conversation').toBe(404);
  const foreignContactEdit=await api.patch(`/api/contacts/${contactA}`,{ maxRedirects: 0,
    headers:{Authorization:bearerB!,'x-idempotency-key':`e2e-contact-foreign-${crypto.randomUUID()}`,...protectionHeaders()},
    data:{role:'Foreign change'},
  });
  expect(foreignContactEdit.status(),'User B cannot mutate User A contact').toBe(404);
  const conversationBResponse = await api.get('/api/conversations', { maxRedirects: 0,
    headers: { Authorization: bearerB!, ...protectionHeaders() },
  });
  expect(conversationBResponse.status()).toBe(200);
  const conversationB = (await conversationBResponse.json())?.[0]?.id as string;
  expect(conversationB).toMatch(/^[0-9a-f-]{36}$/i);
  expect(conversationB).not.toBe(conversationA);
  const ownReadB = await api.post(`/api/conversations/${conversationB}/read`, { maxRedirects: 0,
    headers: { Authorization: bearerB!, 'x-idempotency-key': crypto.randomUUID(), ...protectionHeaders() },
  });
  expect(ownReadB.status(), 'User B can mutate its own conversation via the gateway').toBe(200);
  const directWrite = await api.patch(`https://ghrjongiodziasupakrk.supabase.co/rest/v1/orkto_conversations?id=eq.${conversationB}`, { maxRedirects: 0,
    headers: { apikey: publicKey!, Authorization: bearerB!, Prefer: 'return=representation',
      'Content-Type':'application/json' },
    data: { status: 'paused' },
  });
  expect(directWrite.status(), 'authenticated direct conversation UPDATE must remain denied').toBeGreaterThanOrEqual(400);
  const rpcOrigin = 'https://ghrjongiodziasupakrk.supabase.co';
  for (const [bearer, own, foreign, userId] of [[bearerA!, workspaceA, workspaceB, ownerA], [bearerB!, workspaceB, workspaceA, ownerB]]) {
    for (const functionName of ['orkto_is_workspace_member', 'orkto_is_workspace_admin']) {
      for (const [target, expected] of [[own, true], [foreign, false]] as const) {
        const rpc = await api.post(`${rpcOrigin}/rest/v1/rpc/${functionName}`, { maxRedirects: 0,
          headers: { apikey: publicKey!, Authorization: bearer, 'Content-Type':'application/json' },
          data: { target_workspace: target },
        });
        expect(rpc.status(), `${functionName} must remain callable only in the authenticated scope`).toBe(200);
        expect(await rpc.json(), `${functionName} must derive membership from the JWT`).toBe(expected);
      }
    }
    for (const [target, expected] of [[own, true], [foreign, false]] as const) {
      const rpc = await api.post(`${rpcOrigin}/rest/v1/rpc/orkto_legacy_owner_matches`, { maxRedirects: 0,
        headers: { apikey: publicKey!, Authorization: bearer, 'Content-Type':'application/json' },
        data: { target_workspace: target, legacy_user: userId },
      });
      expect(rpc.status()).toBe(200);
      expect(await rpc.json(), 'legacy owner helper must also require current workspace membership').toBe(expected);
    }
  }
  const anonymousHelper = await api.post(`${rpcOrigin}/rest/v1/rpc/orkto_is_workspace_member`, { maxRedirects: 0,
    headers: { apikey: publicKey!, 'Content-Type':'application/json' },
    data: { target_workspace: workspaceA },
  });
  expect(anonymousHelper.status(), 'anonymous callers must not invoke membership helpers').toBeGreaterThanOrEqual(400);
  checkpoint('B_CLIENTS');
  await expect(page.getByText('Workspace B Synthetic', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clientes' }).click();
  await expect(page.getByRole('heading', { name: 'Base de Clientes' })).toBeVisible();
  await ensureSyntheticClient(page, 'B');
  await expect(page.getByRole('row', { name: /Customer B Synthetic/ }).first()).toBeVisible();
  await expect(page.getByText('Customer A Synthetic', { exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Clientes' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Clientes' }).click();
  await expect(page.getByRole('row', { name: /Customer B Synthetic/ }).first()).toBeVisible();
  await capture(page, 'b-clients-desktop-1440.png');

  checkpoint('AUTH_A_REFRESH');
  const bypassHeaders = protectionHeaders();
  const refreshedA = await api.post('https://ghrjongiodziasupakrk.supabase.co/auth/v1/token?grant_type=password', { maxRedirects: 0,
    headers: { apikey: publicKey!, 'Content-Type':'application/json' },
    data: { email:emailA,password:passwordA },
  });
  expect(refreshedA.status(), 'A can establish a new synthetic Auth session after logout').toBe(200);
  const activeBearerA = `Bearer ${(await refreshedA.json()).access_token as string}`;
  const apiHeadersA = { Authorization: activeBearerA, ...bypassHeaders };
  const apiHeadersB = { Authorization: bearerB!, ...bypassHeaders };

  checkpoint('GATEWAY_ADVERSARIAL');
  for (const [path,data] of [
    ['/api/memories',{type:'fact',entityType:'customer',content:{note:'blocked'},provenance:{sourceRef:'e2e'},explicitlyConfirmed:true}],
    ['/api/purchases',{customerRef:crypto.randomUUID(),productName:'blocked',quantity:1,amountCents:1,purchasedAt:new Date().toISOString(),idempotencyKey:`blocked-${crypto.randomUUID()}`}],
    ['/api/imports/preview',{source:'blocked.csv',entityType:'customers',rows:[{name:'blocked'}],mapping:{name:'name'}}],
  ] as const) {
    const blocked=await api.post(path,{ maxRedirects: 0,headers:apiHeadersA,data});
    expect(blocked.status(),`${path} is feature-gated in staging`).toBe(423);
    expect((await blocked.json()).category).toBe('FEATURE_DISABLED');
  }

  const invalidToken = await api.get('/api/clients', { maxRedirects: 0,
    headers: { Authorization: 'Bearer invalid.synthetic.token', ...bypassHeaders },
  });
  expect(invalidToken.status(), 'invalid tokens fail closed').toBe(401);
  const spoofedWorkspace = await api.post('/api/clients', { maxRedirects: 0,
    headers: { ...apiHeadersA, 'x-idempotency-key': `e2e-spoof-${crypto.randomUUID()}` },
    data: { name:'Synthetic spoof attempt',phone:'+5500000088810',workspace_id:workspaceB },
  });
  expect(spoofedWorkspace.status(), 'workspace IDs supplied by the browser are rejected').toBe(400);

  const catalogCreated = await api.post('/api/catalog', { maxRedirects: 0,
    headers: { ...apiHeadersA, 'x-idempotency-key': `e2e-catalog-${crypto.randomUUID()}` },
    data: { name:'SYNTHETIC E2E SERVICE',description:'Readiness only',unitPrice:25,category:'Serviço' },
  });
  expect(catalogCreated.status(), 'A creates a catalog item through the gateway').toBe(201);
  const catalogId = (await catalogCreated.json())?.data?.id as string;
  expect(catalogId).toMatch(/^[0-9a-f-]{36}$/i);
  const foreignCatalogEdit = await api.patch(`/api/catalog/${catalogId}`, { maxRedirects: 0,
    headers: { ...apiHeadersB, 'x-idempotency-key': `e2e-catalog-foreign-${crypto.randomUUID()}` },
    data: { name:'Foreign change' },
  });
  expect(foreignCatalogEdit.status(), 'B cannot edit A catalog item').toBe(404);
  const ownCatalogEdit = await api.patch(`/api/catalog/${catalogId}`, { maxRedirects: 0,
    headers: { ...apiHeadersA, 'x-idempotency-key': `e2e-catalog-edit-${crypto.randomUUID()}` },
    data: { description:'Updated through Preview' },
  });
  expect(ownCatalogEdit.status(), 'A edits its catalog item through the gateway').toBe(200);

  const dealCreated = await api.post('/api/deals', { maxRedirects: 0,
    headers: { ...apiHeadersA, 'x-idempotency-key': `e2e-deal-${crypto.randomUUID()}` },
    data: { title:'SYNTHETIC E2E DEAL',valueCents:2500,stage:'new' },
  });
  expect(dealCreated.status(), 'A creates a deal through the gateway').toBe(201);
  const dealId = (await dealCreated.json())?.data?.id as string;
  expect(dealId).toMatch(/^[0-9a-f-]{36}$/i);
  const foreignDealEdit = await api.patch(`/api/deals/${dealId}`, { maxRedirects: 0,
    headers: { ...apiHeadersB, 'x-idempotency-key': `e2e-deal-foreign-${crypto.randomUUID()}` },
    data: { stage:'qualification' },
  });
  expect(foreignDealEdit.status(), 'B cannot mutate A deal').toBe(404);
  const terminalKey = `e2e-deal-terminal-${crypto.randomUUID()}`;
  for (const replay of [false, true]) {
    const closed = await api.patch(`/api/deals/${dealId}`, { maxRedirects: 0,
      headers: { ...apiHeadersA, 'x-idempotency-key': terminalKey }, data: { stage:'won' },
    });
    expect(closed.status(), 'A can close its deal through the terminal command').toBe(200);
    expect((await closed.json()).idempotentReplay).toBe(replay);
  }
  const conflictingTerminal = await api.patch(`/api/deals/${dealId}`, { maxRedirects: 0,
    headers: { ...apiHeadersA, 'x-idempotency-key': `e2e-deal-terminal-conflict-${crypto.randomUUID()}` },
    data: { stage:'lost',lostReason:'Conflicting terminal outcome' },
  });
  expect(conflictingTerminal.status(), 'a terminal deal cannot receive a second outcome').toBe(409);
  const unsupportedReopen = await api.patch(`/api/deals/${dealId}`, { maxRedirects: 0,
    headers: { ...apiHeadersA, 'x-idempotency-key': `e2e-deal-reopen-${crypto.randomUUID()}` },
    data: { stage:'qualification' },
  });
  expect([409,423]).toContain(unsupportedReopen.status());
  const archivedDeal = await api.delete(`/api/deals/${dealId}`, { maxRedirects: 0,
    headers: { ...apiHeadersA, 'x-idempotency-key': `e2e-deal-archive-${crypto.randomUUID()}` },
  });
  expect(archivedDeal.status(), 'owner can archive a terminal synthetic deal').toBe(200);

  const directTables = ['clients','orkto_contacts','services','orkto_deals','quotes','orkto_conversations','orkto_messages','orkto_wia_actions'];
  for (const table of directTables) {
    const endpoint = `https://ghrjongiodziasupakrk.supabase.co/rest/v1/${table}`;
    const directHeaders = { apikey:publicKey!,Authorization:activeBearerA,'Content-Type':'application/json',Prefer:'return=representation' };
    const directInsert = await api.post(endpoint, { maxRedirects: 0, headers:directHeaders,data:{ id:crypto.randomUUID() } });
    expect(directInsert.status(), `direct INSERT must remain denied for ${table}`).toBeGreaterThanOrEqual(400);
    const directUpdate = await api.patch(`${endpoint}?id=eq.${crypto.randomUUID()}`, { maxRedirects: 0, headers:directHeaders,data:{ id:crypto.randomUUID() } });
    expect(directUpdate.status(), `direct UPDATE must remain denied for ${table}`).toBeGreaterThanOrEqual(400);
    const directDelete = await api.delete(`${endpoint}?id=eq.${crypto.randomUUID()}`, { maxRedirects: 0, headers:directHeaders });
    expect(directDelete.status(), `direct DELETE must remain denied for ${table}`).toBeGreaterThanOrEqual(400);
  }

  const catalogArchived = await api.delete(`/api/catalog/${catalogId}`, { maxRedirects: 0,
    headers: { ...apiHeadersA, 'x-idempotency-key': `e2e-catalog-archive-${crypto.randomUUID()}` },
  });
  expect(catalogArchived.status(), 'owner archives the synthetic catalog item through the gateway').toBe(200);
  const quoteCreated = await api.post('/api/quotes', { maxRedirects: 0,
    headers: { Authorization: activeBearerA, 'x-idempotency-key': `e2e-quote-${crypto.randomUUID()}`, ...bypassHeaders },
    data: { clientName: 'SYNTHETIC PREVIEW ARCHIVE', clientPhone: '+5500000088891',
      items: [{ name:'Synthetic internal service',description:'',quantity:1,unitPrice:25,discount:0 }] },
  });
  const quoteCreateBody = await quoteCreated.json();
  expect(quoteCreated.status(), `A can create a synthetic Quote through the Preview gateway: ${quoteCreateBody.category || 'unknown'}`).toBe(201);
  const quoteId = quoteCreateBody?.id as string;
  expect(quoteId).toMatch(/^[0-9a-f-]{36}$/i);
  const foreignEdit = await api.put(`/api/quotes/${quoteId}`, { maxRedirects: 0,
    headers: { Authorization: bearerB!, 'x-idempotency-key': `e2e-edit-foreign-${crypto.randomUUID()}`, ...bypassHeaders },
    data: { notes:'Foreign edit denied' },
  });
  expect(foreignEdit.status(), 'B cannot edit A Quote').toBe(404);
  const ownEdit = await api.put(`/api/quotes/${quoteId}`, { maxRedirects: 0,
    headers: { Authorization: activeBearerA, 'x-idempotency-key': `e2e-edit-${crypto.randomUUID()}`, ...bypassHeaders },
    data: { notes:'Edited through Preview',total:0,status:'pending' },
  });
  expect(ownEdit.status(), 'A can edit its own Quote through the gateway').toBe(200);
  const editedQuote = await ownEdit.json();
  expect(editedQuote.notes).toBe('Edited through Preview');
  expect(Number(editedQuote.total), 'client-supplied total is ignored').toBe(25);
  const forgedStatus = await api.put(`/api/quotes/${quoteId}`, { maxRedirects: 0,
    headers: { Authorization: activeBearerA, 'x-idempotency-key': `e2e-edit-status-${crypto.randomUUID()}`, ...bypassHeaders },
    data: { notes:'Forbidden state',status:'approved' },
  });
  expect(forgedStatus.status(), 'generic edit cannot approve a Quote').toBe(423);
  const archiveKey = `e2e-archive-${crypto.randomUUID()}`;
  const foreignArchive = await api.delete(`/api/quotes/${quoteId}`, { maxRedirects: 0,
    headers: { Authorization: bearerB!, 'x-idempotency-key': archiveKey, ...bypassHeaders },
  });
  const foreignArchiveBody = await foreignArchive.json();
  expect(foreignArchive.status(), `B cannot archive A Quote through the Preview gateway: ${foreignArchiveBody.category || 'unknown'}`).toBe(404);
  const ownArchive = await api.delete(`/api/quotes/${quoteId}`, { maxRedirects: 0,
    headers: { Authorization: activeBearerA, 'x-idempotency-key': archiveKey, ...bypassHeaders },
  });
  expect(ownArchive.status(), 'A can archive its own synthetic Quote').toBe(200);
  const replayArchive = await api.delete(`/api/quotes/${quoteId}`, { maxRedirects: 0,
    headers: { Authorization: activeBearerA, 'x-idempotency-key': archiveKey, ...bypassHeaders },
  });
  expect(replayArchive.status(), 'same operation key replays without a second archive').toBe(200);
  const hiddenArchive = await api.get(`/api/quotes/detail/${quoteId}`, { maxRedirects: 0,
    headers: { Authorization: activeBearerA, ...bypassHeaders },
  });
  expect(hiddenArchive.status(), 'archived Quote is absent from active detail').toBe(404);

  checkpoint('FINAL_NETWORK_ASSERTIONS');
  for (const host of observedHosts) {
    expect(productionHosts.has(host), `request to forbidden production host ${host}`).toBe(false);
    if (host.endsWith('.supabase.co')) expect(host, 'only the approved staging Supabase project may receive browser traffic').toBe('ghrjongiodziasupakrk.supabase.co');
  }
  expect(pageErrors).toEqual([]);
  expect(serverFailures).toEqual([]);
  expect(networkFailures).toEqual([]);
});
