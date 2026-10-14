import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { createApiApp, shouldEnableMockRoutes } from '../backend/app-factory.js';

const servers = new Set<ReturnType<typeof createServer>>();

afterEach(async () => {
  await Promise.all([...servers].map(server => new Promise<void>((resolve, reject) => {
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

test('public health and readiness responses retain API security headers', async () => {
  const app = createApiApp({ env: {} });
  for (const path of ['/api/health', '/api/ready', '/api/hermes/health']) {
    const response = await request(app, path);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(response.headers.get('strict-transport-security'));
    assert.ok(response.headers.get('x-request-id'));
  }
});

test('untrusted CORS origin is denied explicitly without a server error or disclosure', async () => {
  const response = await request(createApiApp({ env: {} }), '/api/clients', { headers: { Origin: 'https://attacker.invalid' } });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  const body = await response.json();
  assert.equal(body.category, 'origin_not_allowed');
  assert.equal('stack' in body, false);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('mock routes are disabled when the explicit flag is absent', async () => {
  const app = createApiApp({ env: {} });

  assert.equal((await request(app, '/api/health')).status, 200);
  assert.equal((await request(app, '/api/swarm/health')).status, 404);
  assert.equal((await request(app, '/api/orkto/inbox')).status, 404);
});

test('mock routes can be enabled explicitly in local development', async () => {
  const app = createApiApp({ env: { ORKTO_ENABLE_MOCK_ROUTES: 'true' } });

  assert.equal((await request(app, '/api/swarm/health')).status, 200);
  assert.equal((await request(app, '/api/orkto/inbox')).status, 200);
});

test('production rejects an attempt to enable mock routes', () => {
  assert.throws(
    () => shouldEnableMockRoutes({ NODE_ENV: 'production', ORKTO_ENABLE_MOCK_ROUTES: 'true' }),
    /forbidden outside local development/,
  );
  assert.throws(
    () => shouldEnableMockRoutes({ VERCEL: '1', ORKTO_ENABLE_MOCK_ROUTES: 'true' }),
    /forbidden outside local development/,
  );
  assert.throws(
    () => shouldEnableMockRoutes({ APP_ENV: 'staging', ORKTO_ENABLE_MOCK_ROUTES: 'true' }),
    /forbidden outside local development/,
  );
  assert.throws(
    () => shouldEnableMockRoutes({ VERCEL_ENV: 'preview', ORKTO_ENABLE_MOCK_ROUTES: 'true' }),
    /forbidden outside local development/,
  );
});
