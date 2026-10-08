import { expect, test, type Page } from '@playwright/test';
import { syntheticIdentityGroup } from '../../scripts/readiness/staging-e2e-config.mjs';

const productionHosts = new Set([
  'orkto.vercel.app', 'orkto.co', 'www.orkto.co', 'orkto.com.br',
  'orktoverdeiro-production.up.railway.app', 'qneqljlphgkptebsaonb.supabase.co',
]);

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`STAGING_E2E_CONFIG_REQUIRED:${name}`);
  return value;
}

function assertSyntheticIdentity(email: string, label: 'A' | 'B'): void {
  if (!syntheticIdentityGroup(email, label)) throw new Error(`STAGING_E2E_SYNTHETIC_IDENTITY_REQUIRED:${label}`);
}

async function signIn(page: Page, email: string, password: string, group: 'A' | 'B'): Promise<void> {
  const previewOrigin = new URL(required('ORKTO_STAGING_PREVIEW_URL')).origin;
  const bypass = required('ORKTO_STAGING_E2E_BYPASS_SECRET');
  await page.route('**/*', async route => {
    if (new URL(route.request().url()).origin === previewOrigin) {
      await route.continue({ headers:{ ...route.request().headers(), 'x-vercel-protection-bypass':bypass } });
    } else {
      await route.continue();
    }
  });
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
}

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: test.info().outputPath(name), fullPage: true, animations: 'disabled' });
}

async function ensureSyntheticClient(page: Page, group: 'A' | 'B'): Promise<void> {
  const name = `Customer ${group} Synthetic`;
  // The app loads Clients after navigation. Wait for the known synthetic seed
  // before deciding whether this retry needs to create another record.
  await expect(page.getByRole('table').getByRole('row').nth(1)).toBeVisible();
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
  const headers={ 'x-vercel-protection-bypass':required('ORKTO_STAGING_E2E_BYPASS_SECRET') };
  const health = await request.get('/api/health',{headers});
  expect(health.ok()).toBeTruthy();
  expect((await health.json()).status).toBe('ok');

  const ready = await request.get('/api/ready',{headers});
  expect(ready.status()).toBe(200);
  const body = await ready.json();
  expect(body.status).toBe('ready');
  expect(body.environment).toBe('staging');
  expect(JSON.stringify(body)).not.toMatch(/service_role|refresh_token|access_token|secret/i);
});

test('real Auth A/B, tenant-visible records, navigation, refresh, logout and responsive shell', async ({ page }) => {
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
  const previewOrigin = new URL(required('ORKTO_STAGING_PREVIEW_URL')).origin;
  let publicKey: string | null = null;
  let appBearer: string | null = null;
  page.on('request', request => {
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
      if (url.origin === previewOrigin && !/ERR_ABORTED|cancelled/i.test(failure)) networkFailures.push(`${request.method()} ${url.pathname}`);
    } catch { networkFailures.push('unparseable_same_origin_request'); }
  });
  page.on('response', response => {
    if (response.status() >= 500 && new URL(response.url()).origin === previewOrigin) {
      serverFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });

  await signIn(page, emailA, passwordA, 'A');
  const bearerA = appBearer;
  expect(bearerA && publicKey, 'synthetic A auth and public configuration must be available in memory').toBeTruthy();
  const workspaceAResponse = await page.request.get('/api/operational/workspace', {
    headers: { Authorization: bearerA!, 'x-vercel-protection-bypass': required('ORKTO_STAGING_E2E_BYPASS_SECRET') },
  });
  expect(workspaceAResponse.status()).toBe(200);
  const workspaceAPayload = await workspaceAResponse.json();
  const workspaceA = workspaceAPayload.workspace?.id as string;
  const ownerA = workspaceAPayload.members?.find((member: { role?: string }) => member.role === 'owner')?.user_id as string;
  expect(workspaceA).toMatch(/^[0-9a-f-]{36}$/i);
  expect(ownerA).toMatch(/^[0-9a-f-]{36}$/i);
  const conversationAResponse = await page.request.get('/api/conversations', {
    headers: { Authorization: bearerA!, 'x-vercel-protection-bypass': required('ORKTO_STAGING_E2E_BYPASS_SECRET') },
  });
  expect(conversationAResponse.status()).toBe(200);
  const conversationA = (await conversationAResponse.json())?.[0]?.id as string;
  expect(conversationA).toMatch(/^[0-9a-f-]{36}$/i);
  const readKey = crypto.randomUUID();
  for (const replay of [false, true]) {
    const marked = await page.request.post(`/api/conversations/${conversationA}/read`, {
      headers: { Authorization: bearerA!, 'x-idempotency-key': readKey,
        'x-vercel-protection-bypass': required('ORKTO_STAGING_E2E_BYPASS_SECRET') },
    });
    expect(marked.status(), 'staging Inbox read must use the authorized gateway').toBe(200);
    expect((await marked.json()).idempotentReplay).toBe(replay);
  }
  const changed = await page.request.patch(`/api/conversations/${conversationA}`, {
    headers: { Authorization: bearerA!, 'x-idempotency-key': crypto.randomUUID(),
      'x-vercel-protection-bypass': required('ORKTO_STAGING_E2E_BYPASS_SECRET') },
    data: { status: 'active' },
  });
  expect(changed.status(), 'staging Inbox status must use the authorized gateway').toBe(200);
  expect((await changed.json()).data?.status).toBe('active');
  await expect(page.getByText('Workspace A Synthetic', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clientes' }).click();
  await expect(page.getByRole('heading', { name: 'Base de Clientes' })).toBeVisible();
  await ensureSyntheticClient(page, 'A');
  await expect(page.getByRole('row', { name: /Customer A Synthetic/ }).first()).toBeVisible();
  await expect(page.getByText('Customer B Synthetic', { exact: true })).toHaveCount(0);
  await capture(page, 'a-clients-desktop-1440.png');
  await page.reload();
  await page.getByRole('button', { name: 'Clientes' }).waitFor({ state: 'visible' });
  await expect(page.getByText('Workspace A Synthetic', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clientes' }).click();
  await expect(page.getByRole('row', { name: /Customer A Synthetic/ }).first()).toBeVisible();

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
  const bearerB = appBearer;
  expect(bearerB && bearerB !== bearerA, 'synthetic users must have distinct live sessions').toBeTruthy();
  const workspaceBResponse = await page.request.get('/api/operational/workspace', {
    headers: { Authorization: bearerB!, 'x-vercel-protection-bypass': required('ORKTO_STAGING_E2E_BYPASS_SECRET') },
  });
  expect(workspaceBResponse.status()).toBe(200);
  const workspaceBPayload = await workspaceBResponse.json();
  const workspaceB = workspaceBPayload.workspace?.id as string;
  const ownerB = workspaceBPayload.members?.find((member: { role?: string }) => member.role === 'owner')?.user_id as string;
  expect(workspaceB).toMatch(/^[0-9a-f-]{36}$/i);
  expect(ownerB).toMatch(/^[0-9a-f-]{36}$/i);
  expect(workspaceA).not.toBe(workspaceB);
  const foreignRead = await page.request.post(`/api/conversations/${conversationA}/read`, {
    headers: { Authorization: bearerB!, 'x-idempotency-key': crypto.randomUUID(),
      'x-vercel-protection-bypass': required('ORKTO_STAGING_E2E_BYPASS_SECRET') },
  });
  expect(foreignRead.status(), 'User B cannot mutate User A conversation').toBe(404);
  const conversationBResponse = await page.request.get('/api/conversations', {
    headers: { Authorization: bearerB!, 'x-vercel-protection-bypass': required('ORKTO_STAGING_E2E_BYPASS_SECRET') },
  });
  expect(conversationBResponse.status()).toBe(200);
  const conversationB = (await conversationBResponse.json())?.[0]?.id as string;
  expect(conversationB).toMatch(/^[0-9a-f-]{36}$/i);
  expect(conversationB).not.toBe(conversationA);
  const ownReadB = await page.request.post(`/api/conversations/${conversationB}/read`, {
    headers: { Authorization: bearerB!, 'x-idempotency-key': crypto.randomUUID(),
      'x-vercel-protection-bypass': required('ORKTO_STAGING_E2E_BYPASS_SECRET') },
  });
  expect(ownReadB.status(), 'User B can mutate its own conversation via the gateway').toBe(200);
  const directWrite = await page.request.patch(`https://ghrjongiodziasupakrk.supabase.co/rest/v1/orkto_conversations?id=eq.${conversationB}`, {
    headers: { apikey: publicKey!, Authorization: bearerB!, Prefer: 'return=representation',
      'Content-Type':'application/json' },
    data: { status: 'paused' },
  });
  expect(directWrite.status(), 'authenticated direct conversation UPDATE must remain denied').toBeGreaterThanOrEqual(400);
  const rpcOrigin = 'https://ghrjongiodziasupakrk.supabase.co';
  for (const [bearer, own, foreign, userId] of [[bearerA!, workspaceA, workspaceB, ownerA], [bearerB!, workspaceB, workspaceA, ownerB]]) {
    for (const functionName of ['orkto_is_workspace_member', 'orkto_is_workspace_admin']) {
      for (const [target, expected] of [[own, true], [foreign, false]] as const) {
        const rpc = await page.request.post(`${rpcOrigin}/rest/v1/rpc/${functionName}`, {
          headers: { apikey: publicKey!, Authorization: bearer, 'Content-Type':'application/json' },
          data: { target_workspace: target },
        });
        expect(rpc.status(), `${functionName} must remain callable only in the authenticated scope`).toBe(200);
        expect(await rpc.json(), `${functionName} must derive membership from the JWT`).toBe(expected);
      }
    }
    for (const [target, expected] of [[own, true], [foreign, false]] as const) {
      const rpc = await page.request.post(`${rpcOrigin}/rest/v1/rpc/orkto_legacy_owner_matches`, {
        headers: { apikey: publicKey!, Authorization: bearer, 'Content-Type':'application/json' },
        data: { target_workspace: target, legacy_user: userId },
      });
      expect(rpc.status()).toBe(200);
      expect(await rpc.json(), 'legacy owner helper must also require current workspace membership').toBe(expected);
    }
  }
  const anonymousHelper = await page.request.post(`${rpcOrigin}/rest/v1/rpc/orkto_is_workspace_member`, {
    headers: { apikey: publicKey!, 'Content-Type':'application/json' },
    data: { target_workspace: workspaceA },
  });
  expect(anonymousHelper.status(), 'anonymous callers must not invoke membership helpers').toBeGreaterThanOrEqual(400);
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

  const bypass = required('ORKTO_STAGING_E2E_BYPASS_SECRET');
  const refreshedA = await page.request.post('https://ghrjongiodziasupakrk.supabase.co/auth/v1/token?grant_type=password', {
    headers: { apikey: publicKey!, 'Content-Type':'application/json' },
    data: { email:emailA,password:passwordA },
  });
  expect(refreshedA.status(), 'A can establish a new synthetic Auth session after logout').toBe(200);
  const activeBearerA = `Bearer ${(await refreshedA.json()).access_token as string}`;
  const quoteCreated = await page.request.post('/api/quotes', {
    headers: { Authorization: activeBearerA, 'x-idempotency-key': `e2e-quote-${crypto.randomUUID()}`,
      'x-vercel-protection-bypass': bypass },
    data: { clientName: 'SYNTHETIC PREVIEW ARCHIVE', clientPhone: '+5500000088891',
      items: [{ name:'Synthetic internal service',description:'',quantity:1,unitPrice:25,discount:0 }] },
  });
  const quoteCreateBody = await quoteCreated.json();
  expect(quoteCreated.status(), `A can create a synthetic Quote through the Preview gateway: ${quoteCreateBody.category || 'unknown'}`).toBe(201);
  const quoteId = quoteCreateBody?.id as string;
  expect(quoteId).toMatch(/^[0-9a-f-]{36}$/i);
  const foreignEdit = await page.request.put(`/api/quotes/${quoteId}`, {
    headers: { Authorization: bearerB!, 'x-idempotency-key': `e2e-edit-foreign-${crypto.randomUUID()}`,
      'x-vercel-protection-bypass': bypass },
    data: { notes:'Foreign edit denied' },
  });
  expect(foreignEdit.status(), 'B cannot edit A Quote').toBe(404);
  const ownEdit = await page.request.put(`/api/quotes/${quoteId}`, {
    headers: { Authorization: activeBearerA, 'x-idempotency-key': `e2e-edit-${crypto.randomUUID()}`,
      'x-vercel-protection-bypass': bypass },
    data: { notes:'Edited through Preview',total:0,status:'pending' },
  });
  expect(ownEdit.status(), 'A can edit its own Quote through the gateway').toBe(200);
  const editedQuote = await ownEdit.json();
  expect(editedQuote.notes).toBe('Edited through Preview');
  expect(Number(editedQuote.total), 'client-supplied total is ignored').toBe(25);
  const forgedStatus = await page.request.put(`/api/quotes/${quoteId}`, {
    headers: { Authorization: activeBearerA, 'x-idempotency-key': `e2e-edit-status-${crypto.randomUUID()}`,
      'x-vercel-protection-bypass': bypass },
    data: { notes:'Forbidden state',status:'approved' },
  });
  expect(forgedStatus.status(), 'generic edit cannot approve a Quote').toBe(423);
  const archiveKey = `e2e-archive-${crypto.randomUUID()}`;
  const foreignArchive = await page.request.delete(`/api/quotes/${quoteId}`, {
    headers: { Authorization: bearerB!, 'x-idempotency-key': archiveKey,
      'x-vercel-protection-bypass': bypass },
  });
  const foreignArchiveBody = await foreignArchive.json();
  expect(foreignArchive.status(), `B cannot archive A Quote through the Preview gateway: ${foreignArchiveBody.category || 'unknown'}`).toBe(404);
  const ownArchive = await page.request.delete(`/api/quotes/${quoteId}`, {
    headers: { Authorization: activeBearerA, 'x-idempotency-key': archiveKey,
      'x-vercel-protection-bypass': bypass },
  });
  expect(ownArchive.status(), 'A can archive its own synthetic Quote').toBe(200);
  const replayArchive = await page.request.delete(`/api/quotes/${quoteId}`, {
    headers: { Authorization: activeBearerA, 'x-idempotency-key': archiveKey,
      'x-vercel-protection-bypass': bypass },
  });
  expect(replayArchive.status(), 'same operation key replays without a second archive').toBe(200);
  const hiddenArchive = await page.request.get(`/api/quotes/detail/${quoteId}`, {
    headers: { Authorization: activeBearerA, 'x-vercel-protection-bypass': bypass },
  });
  expect(hiddenArchive.status(), 'archived Quote is absent from active detail').toBe(404);

  for (const host of observedHosts) {
    expect(productionHosts.has(host), `request to forbidden production host ${host}`).toBe(false);
    if (host.endsWith('.supabase.co')) expect(host, 'only the approved staging Supabase project may receive browser traffic').toBe('ghrjongiodziasupakrk.supabase.co');
  }
  expect(pageErrors).toEqual([]);
  expect(serverFailures).toEqual([]);
  expect(networkFailures).toEqual([]);
});
