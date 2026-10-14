import { test, checkpoint } from '../../readiness/staging-safe-test';
import { observeRequest } from '../../readiness/staging-observed-request';
import { expect } from '@playwright/test';

test('response event has its own action timeout', async ({ page }) => {
  checkpoint('A_NAVIGATION');
  await page.waitForResponse(() => false, { timeout: 75 });
});

test('whole test has a distinct budget timeout', async ({ page }) => {
  void page;
  test.setTimeout(150);
  checkpoint('A_NAVIGATION');
  await new Promise(resolve => setTimeout(resolve, 2000));
});

test('API request has its own timeout and safe failure metadata', async ({ request }) => {
  checkpoint('AUTH_A_REFRESH');
  await observeRequest(request).get(process.env.ORKTO_TEST_HANG_URL!, { timeout: 75,
    headers: { Authorization: `Bearer ${process.env.ORKTO_TEST_ACCESS_TOKEN}`, 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN! } });
});

test('seeded and created contact display names cause strict-mode ambiguity, not timeout', async ({ page }) => {
  checkpoint('A_CLIENT_CONTACT');
  await page.setContent('<div role="dialog" aria-label="Client"><p>Contact A Synthetic</p><p>Contact A Synthetic</p><p>Contact A Synthetic</p></div>');
  await expect(page.getByRole('dialog').getByText('Contact A Synthetic', { exact: true })).toBeVisible({ timeout: 15000 });
});

test('unique per-operation name selects the created contact and its edit control', async ({ page }) => {
  checkpoint('A_CLIENT_CONTACT');
  const createdContactName = `Contact A Synthetic ${crypto.randomUUID()}`;
  await page.setContent(`<div role="dialog"><ul><li>Contact A Synthetic<p>Decisor</p></li><li>Contact A Synthetic<p>Decisor</p></li><li><p>${createdContactName}</p><p>Decisor</p><button aria-label="Editar contato ${createdContactName}">Edit</button></li></ul></div>`);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(createdContactName, { exact: true })).toHaveCount(1);
  await expect(dialog.getByText(createdContactName, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: `Editar contato ${createdContactName}`, exact: true }).click();
  const edited = dialog.getByRole('listitem').filter({ hasText: createdContactName });
  await expect(edited).toHaveCount(1);
  await expect(edited.getByText('Decisor', { exact: true })).toBeVisible();
});
