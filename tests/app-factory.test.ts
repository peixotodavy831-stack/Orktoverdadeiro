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

async function request(app: Express, path: string): Promise<Response> {
  const server = createServer(app);
  servers.add(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}${path}`);
}

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
    /forbidden in production runtimes/,
  );
  assert.throws(
    () => shouldEnableMockRoutes({ VERCEL: '1', ORKTO_ENABLE_MOCK_ROUTES: 'true' }),
    /forbidden in production runtimes/,
  );
});
