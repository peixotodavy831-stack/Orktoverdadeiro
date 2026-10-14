import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

const fixtureModule = build({ entryPoints: ['tests/e2e/staging-fixtures.ts'], bundle: true, platform: 'node', format: 'esm', write: false })
  .then(result => import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')));

test('public proposal fixture preserves catalog identity and exact price required by the publication contract', async () => {
  const { catalogBackedQuoteInput } = await fixtureModule;
  const catalog = { id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', name: 'Synthetic catalog service', unitPrice: 1 };
  const quote = catalogBackedQuoteInput(catalog, 'Synthetic release customer');
  assert.deepEqual(quote.items, [{ catalogItemId: catalog.id, name: catalog.name, quantity: 1, unitPrice: catalog.unitPrice, discount: 0 }]);
  assert.equal(quote.clientName, 'Synthetic release customer');
  for (const invalid of [{ ...catalog, id: '' }, { ...catalog, name: '' }, { ...catalog, unitPrice: NaN }, { ...catalog, unitPrice: -1 }]) {
    assert.throws(() => catalogBackedQuoteInput(invalid, 'Synthetic release customer'), /INVALID_SYNTHETIC_CATALOG_FIXTURE/);
  }
});

test('contact verification stays unique before and after real reload despite repeated role labels', async () => {
  const { contactRowByCreatedName } = await fixtureModule;
  const html = '<section role="dialog" aria-label="Synthetic client details"><ul><li>Old synthetic contact <span>Decisor</span></li><li>New synthetic contact unique-123 <span>Decisor</span></li></ul></section>';
  const server = createServer((_request, response) => { response.setHeader('Content-Type', 'text/html'); response.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    for (let attempt = 0; attempt < 2; attempt++) {
      const dialog = page.getByRole('dialog', { name: 'Synthetic client details' });
      assert.equal(await dialog.getByText(/Decisor/).count(), 2, 'the original unscoped query is ambiguous');
      const row = contactRowByCreatedName(dialog, 'New synthetic contact unique-123');
      await expect(row).toHaveCount(1);
      await expect(row.getByText(/Decisor/)).toBeVisible();
      if (!attempt) await page.reload();
    }
  } finally {
    await browser?.close();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
