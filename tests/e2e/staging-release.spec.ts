import { expect, type Page } from '@playwright/test';
import { test, checkpoint } from '../../scripts/readiness/staging-safe-test';
import { observeRequest } from '../../scripts/readiness/staging-observed-request';

const authOrigin = 'https://ghrjongiodziasupakrk.supabase.co';
function required(name: string) { const value = process.env[name]; if (!value) throw new Error('STAGING_RELEASE_INPUT_REQUIRED'); return value; }
function accessHeaders() {
  return { 'x-vercel-trusted-oidc-idp-token': required('VERCEL_OIDC_TOKEN') };
}
function fixture(name: string) { const value = required(`ORKTO_STAGING_FIXTURE_${name}`); expect(value).toMatch(/^[a-f0-9-]{36}$/i); return value; }
async function loginBrowser(page: Page, label: 'A' | 'B') {
  checkpoint(`AUTH_${label}`);
  const origin = new URL(required('ORKTO_STAGING_PREVIEW_URL')).origin;
  await page.route('**/*', async route => {
    const headers = { ...route.request().headers() }; delete headers['x-vercel-trusted-oidc-idp-token'];
    await route.continue({ headers: new URL(route.request().url()).origin === origin ? { ...headers, ...accessHeaders() } : headers });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Seu e-mail' }).fill(required(`ORKTO_STAGING_E2E_USER_${label}_EMAIL`));
  await page.getByRole('button', { name: 'Continuar com e-mail' }).click();
  await page.getByPlaceholder('Sua senha').fill(required(`ORKTO_STAGING_E2E_USER_${label}_PASSWORD`));
  const loggedIn = page.waitForResponse(response => response.url().startsWith(authOrigin + '/auth/v1/token') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const response = await loggedIn; expect(response.status()).toBe(200);
  const session = await response.json();
  await expect(page.getByRole('navigation', { name: 'Módulos' })).toBeVisible();
  expect(Boolean(session.access_token && session.refresh_token)).toBe(true);
  process.env.ORKTO_TEST_RELEASE_REFRESH_TOKEN = session.refresh_token;
  return { bearer: `Bearer ${session.access_token}`, refresh: session.refresh_token as string, publicKey: response.request().headers().apikey, userId: session.user.id as string };
}

test('browser logout confirms server response, clears local session and rejects refresh reuse', async ({ page }) => {
  const session = await loginBrowser(page, 'A');
  checkpoint('LOGOUT_REVOCATION');
  const loggedOut = page.waitForResponse(response => response.url().startsWith(authOrigin + '/auth/v1/logout') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  const response = await loggedOut;
  expect(response.status(), 'Auth must acknowledge logout before subsequent navigation').toBe(204);
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sb-ghrjongiodziasupakrk-auth-token') === null)).toBe(true);
  const refresh = await observeRequest(page.request).post(authOrigin + '/auth/v1/token?grant_type=refresh_token', {
    headers: { apikey: session.publicKey }, data: { refresh_token: session.refresh }, maxRedirects: 0,
  });
  expect(refresh.status(), 'the revoked refresh token cannot create another session').toBeGreaterThanOrEqual(400);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
});

test('WIA browser approval/rejection, provenance, replay and Inbox decisions stay tenant-scoped', async ({ page }) => {
  const session = await loginBrowser(page, 'A');
  const api = observeRequest(page.request);
  const bResponse = await api.post(authOrigin + '/auth/v1/token?grant_type=password', {
    headers: { apikey: session.publicKey }, data: { email: required('ORKTO_STAGING_E2E_USER_B_EMAIL'), password: required('ORKTO_STAGING_E2E_USER_B_PASSWORD') }, maxRedirects: 0,
  });
  expect(bResponse.status()).toBe(200);
  const bSession = await bResponse.json();
  const headersA = { ...accessHeaders(), Authorization: session.bearer, 'x-idempotency-key': crypto.randomUUID() };
  const headersB = { ...accessHeaders(), Authorization: `Bearer ${bSession.access_token}`, 'x-idempotency-key': crypto.randomUUID() };
  const actionA = fixture('A_ACTION_ID'), rejectA = fixture('A_REJECT_ID'), actionB = fixture('B_ACTION_ID');
  checkpoint('WIA_APPROVAL_REJECTION');
  expect((await api.post(`/api/wia/actions/${actionA}/approve`, { headers: headersB, data: { confirm: true } })).status()).toBe(404);
  expect((await api.post(`/api/wia/actions/${actionB}/approve`, { headers: headersA, data: { confirm: true } })).status()).toBe(404);
  expect((await api.post(`/api/wia/actions/${actionA}/approve`, { headers: headersA, data: { confirm: false } })).status()).toBe(400);
  await page.getByRole('button', { name: 'WIA', exact: true }).click();
  const marker = `orkto-staging-auth-ab-v03:A:${required('ORKTO_STAGING_FIXTURE_RUN_ID')}`;
  const approvalCard = page.getByRole('article').filter({ hasText: marker + ':approve' });
  await expect(approvalCard).toHaveCount(1);
  const approved = page.waitForResponse(response => new URL(response.url()).pathname === `/api/wia/actions/${actionA}/approve` && response.request().method() === 'POST');
  await approvalCard.getByRole('button', { name: 'Aprovar e criar tarefa interna', exact: true }).click();
  const approvalResponse = await approved; expect(approvalResponse.status()).toBe(200);
  const approvedBody = await approvalResponse.json();
  expect(approvedBody.data.status).toBe('executed');
  expect(approvedBody.data.result.execution).toBe('internal_task_created');
  expect(approvedBody.externalDelivery).toBe('not_sent_channel_not_configured');
  const replay = await api.post(`/api/wia/actions/${actionA}/approve`, { headers: headersA, data: { confirm: true } });
  expect(replay.status()).toBe(200); const replayBody = await replay.json();
  expect(replayBody.idempotentReplay).toBe(true); expect(replayBody.data.result.taskId).toBe(approvedBody.data.result.taskId);
  const rejectionCard = page.getByRole('article').filter({ hasText: marker + ':reject' });
  await expect(rejectionCard).toHaveCount(1);
  const rejected = page.waitForResponse(response => new URL(response.url()).pathname === `/api/wia/actions/${rejectA}/reject` && response.request().method() === 'POST');
  await rejectionCard.getByRole('button', { name: 'Rejeitar', exact: true }).click();
  const rejectionResponse = await rejected; expect(rejectionResponse.status()).toBe(200);
  expect((await rejectionResponse.json()).data.status).toBe('rejected');
  expect((await api.post(`/api/wia/actions/${rejectA}/approve`, { headers: headersA, data: { confirm: true } })).status()).toBe(409);

  checkpoint('WIA_TRUSTED_PROVENANCE');
  const prepareHeaders = { ...headersA, 'x-idempotency-key': crypto.randomUUID() };
  const prepared = await api.post('/api/wia/route-agent', { headers: prepareHeaders, data: { message: 'Quais orçamentos estão abertos?' } });
  expect(prepared.status()).toBe(200); const result = await prepared.json();
  expect(result.path).toBe('t0'); expect(result.usage.provider).toBe('none');
  expect(result.toolExecutions.some((tool: { toolName: string }) => tool.toolName === 'get_open_quotes')).toBe(true);
  const repeated = await api.post('/api/wia/route-agent', { headers: prepareHeaders, data: { message: 'Quais orçamentos estão abertos?' } });
  expect(repeated.status()).toBe(200); const repeatedBody = await repeated.json();
  expect(repeatedBody.replayed).toBe(true); expect(repeatedBody.runId).toBe(result.runId);
  const history = await api.get(`/api/wia/history?runId=${result.runId}`, { headers: headersA });
  expect(history.status()).toBe(200); const historyBody = await history.json();
  expect(historyBody.data).toHaveLength(1); expect(historyBody.data[0].actorUserId).toBe(session.userId);
  const foreignHistory = await api.get(`/api/wia/history?runId=${result.runId}`, { headers: headersB });
  expect(foreignHistory.status()).toBe(200); expect((await foreignHistory.json()).data).toHaveLength(0);

  checkpoint('INBOX_DRAFT_DECISIONS');
  const approvalA = fixture('A_APPROVAL_ID'), approvalB = fixture('B_APPROVAL_ID');
  expect((await api.post(`/api/approval-tasks/${approvalA}/approve`, { headers: headersB, data: {} })).status()).toBe(404);
  const accepted = await api.post(`/api/approval-tasks/${approvalA}/approve`, { headers: headersA, data: {} });
  expect(accepted.status()).toBe(200); const acceptedBody = await accepted.json();
  expect(acceptedBody.deliveryStatus).toBe('CONFIGURATION_REQUIRED');
  const acceptedAgain = await api.post(`/api/approval-tasks/${approvalA}/approve`, { headers: headersA, data: {} });
  expect(acceptedAgain.status()).toBe(200); expect((await acceptedAgain.json()).idempotentReplay).toBe(true);
  const denied = await api.post(`/api/approval-tasks/${approvalB}/reject`, { headers: headersB, data: { reason: 'Synthetic release check' } });
  expect(denied.status()).toBe(200); expect((await denied.json()).task.status).toBe('rejected');
});
