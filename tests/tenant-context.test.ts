import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { createApiApp } from '../api/app-factory.js';
import {
  TenantContextError,
  createOwnerTenantContext,
  requireTenantContext,
  resolveWebhookTenantContext,
  scopeQueryToTenant,
} from '../api/tenancy/tenant-context.js';

type Row = { id: string; user_id: string; value: string };

class FakeServiceRoleQuery {
  private readonly filters: Array<(row: Row) => boolean> = [];
  private patch: Partial<Row> | null = null;

  constructor(private readonly rows: Row[]) {}

  eq(column: string, value: string): this {
    this.filters.push(row => row[column as keyof Row] === value);
    return this;
  }

  update(patch: Partial<Row>): this {
    this.patch = patch;
    return this;
  }

  execute(): Row[] {
    const selected = this.rows.filter(row => this.filters.every(filter => filter(row)));
    if (this.patch) selected.forEach(row => Object.assign(row, this.patch));
    return selected;
  }
}

const servers = new Set<ReturnType<typeof createServer>>();

afterEach(async () => {
  await Promise.all([...servers].map(server => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  })));
  servers.clear();
});

async function request(app: Express, path: string, init?: RequestInit): Promise<Response> {
  const server = createServer(app);
  servers.add(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}${path}`, init);
}

test('missing tenant context is denied', () => {
  assert.throws(() => requireTenantContext({}), TenantContextError);
  assert.throws(() => createOwnerTenantContext('invalid-user-id'), TenantContextError);
});

test('tenant scope prevents cross-tenant reads even with a service-role-like query', () => {
  const tenantAId = '11111111-1111-4111-8111-111111111111';
  const tenantBId = '22222222-2222-4222-8222-222222222222';
  const tenantA = createOwnerTenantContext(tenantAId);
  const rows: Row[] = [
    { id: '1', user_id: tenantAId, value: 'A' },
    { id: '2', user_id: tenantBId, value: 'B' },
  ];

  const selected = scopeQueryToTenant(new FakeServiceRoleQuery(rows), tenantA).execute();
  assert.deepEqual(selected.map(row => row.id), ['1']);
});

test('tenant scope prevents cross-tenant updates', () => {
  const tenantAId = '11111111-1111-4111-8111-111111111111';
  const tenantBId = '22222222-2222-4222-8222-222222222222';
  const tenantA = createOwnerTenantContext(tenantAId);
  const rows: Row[] = [
    { id: '1', user_id: tenantAId, value: 'original-a' },
    { id: '2', user_id: tenantBId, value: 'original-b' },
  ];

  scopeQueryToTenant(new FakeServiceRoleQuery(rows).update({ value: 'changed' }), tenantA).execute();
  assert.equal(rows[0].value, 'changed');
  assert.equal(rows[1].value, 'original-b');
});

test('webhook tenant resolution rejects absent and invalid bindings', () => {
  assert.equal(resolveWebhookTenantContext({}), null);
  assert.equal(resolveWebhookTenantContext({ WHATSAPP_TENANT_ID: 'demo-user' }), null);
  assert.deepEqual(
    resolveWebhookTenantContext({ WHATSAPP_TENANT_ID: '11111111-1111-4111-8111-111111111111' }),
    {
      userId: '11111111-1111-4111-8111-111111111111',
      tenantId: '11111111-1111-4111-8111-111111111111',
      role: 'channel',
    },
  );
});

test('webhook without a resolved tenant creates no state', async () => {
  const previousSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  const previousTenant = process.env.WHATSAPP_TENANT_ID;
  process.env.WHATSAPP_WEBHOOK_SECRET = 'test-secret';
  delete process.env.WHATSAPP_TENANT_ID;

  try {
    const response = await request(createApiApp({ env: {} }), '/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-orkto-webhook-secret': 'test-secret' },
      body: JSON.stringify({ from: '+5500000000000', message: 'teste' }),
    });
    assert.equal(response.status, 503);
    assert.match(await response.text(), /sem tenant configurado/);
  } finally {
    if (previousSecret === undefined) delete process.env.WHATSAPP_WEBHOOK_SECRET;
    else process.env.WHATSAPP_WEBHOOK_SECRET = previousSecret;
    if (previousTenant === undefined) delete process.env.WHATSAPP_TENANT_ID;
    else process.env.WHATSAPP_TENANT_ID = previousTenant;
  }
});
