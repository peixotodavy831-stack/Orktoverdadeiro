import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mountProductionAssets } from '../backend/static-assets.js';

test('production serves app assets but never server source/maps, including encoded paths', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'orkto-static-test-'));
  await Promise.all(['index.html','server.cjs','server.cjs.map','bundle.js'].map(name => writeFile(path.join(directory,name), name)));
  const app = express();
  mountProductionAssets(app, directory);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  try {
    for (const url of ['/server.cjs','/server.cjs.map','/%73erver.cjs','/server%2ecjs','/.env','/nested/server.cjs']) {
      assert.equal((await fetch(`http://127.0.0.1:${address.port}${url}`)).status, 404, url);
    }
    for (const url of ['/','/inbox','/bundle.js']) {
      assert.equal((await fetch(`http://127.0.0.1:${address.port}${url}`)).status, 200, url);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true });
  }
});
