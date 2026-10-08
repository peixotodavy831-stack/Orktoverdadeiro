import assert from 'node:assert/strict';
import test from 'node:test';
import { AccountingAdapterRegistry, type AccountingSaleExport } from '../backend/accounting/accounting-adapter.js';

const sale: AccountingSaleExport = {
  workspaceId: '11111111-1111-4111-8111-111111111111', saleRef: 'quote-1', customer: { name: 'Cliente' },
  items: [{ product: 'Serviço', quantity: 1, unitPriceCents: 12500 }], amountCents: 12500,
  saleDate: '2026-09-27T12:00:00.000Z', paymentMethod: null, paymentStatus: 'unknown',
};

test('sem provider escolhido, export contábil fica CONFIGURATION_REQUIRED sem sucesso falso', async () => {
  const registry = new AccountingAdapterRegistry();
  assert.deepEqual(await registry.exportSale(null, sale, 'export-idempotency-1'), {
    status: 'configuration_required', providerId: null, errorCategory: 'accounting_provider_not_configured',
  });
});

test('provider escolhido sem adapter instalado continua CONFIGURATION_REQUIRED', async () => {
  const registry = new AccountingAdapterRegistry();
  const result = await registry.exportSale('provider-x', sale, 'export-idempotency-2');
  assert.equal(result.status, 'configuration_required');
  assert.equal(result.providerId, 'provider-x');
  if (result.status === 'configuration_required') assert.equal(result.errorCategory, 'accounting_adapter_unavailable');
});

test('adapter recebe payload estruturado e chave de idempotência e retorna referência real', async () => {
  const registry = new AccountingAdapterRegistry();
  const observed: string[] = [];
  registry.register({
    providerId: 'provider-x',
    async exportSale(receivedSale, options) {
      observed.push(receivedSale.saleRef, options.idempotencyKey);
      return { externalRef: 'invoice-42' };
    },
  });
  const result = await registry.exportSale('PROVIDER-X', sale, 'export-idempotency-3');
  assert.deepEqual(result, { status: 'sent', providerId: 'provider-x', externalRef: 'invoice-42' });
  assert.deepEqual(observed, ['quote-1', 'export-idempotency-3']);
});

test('falha do adapter é classificada sem vazar mensagem ou fingir exportação', async () => {
  const registry = new AccountingAdapterRegistry().register({
    providerId: 'provider-x',
    async exportSale() { throw new Error('secret provider response'); },
  });
  assert.deepEqual(await registry.exportSale('provider-x', sale, 'export-idempotency-4'), {
    status: 'failed', providerId: 'provider-x', errorCategory: 'accounting_provider_error',
  });
});
