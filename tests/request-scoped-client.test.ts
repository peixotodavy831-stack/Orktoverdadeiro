import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestScopedClient } from '../backend/tenancy/request-scoped-client.js';

type FakeClient = { identity(): string };
const fake = (id: string): FakeClient => ({ identity() { return id; } });

test('request-scoped client uses public identity until a verified client is bound', async () => {
  const scoped = createRequestScopedClient(fake('anon'));
  assert.equal(scoped.client.identity(), 'anon');
  assert.throws(() => scoped.useAuthenticatedClient(fake('A')));
  await scoped.run(async () => {
    assert.equal(scoped.client.identity(), 'anon');
    scoped.useAuthenticatedClient(fake('A'));
    assert.equal(scoped.client.identity(), 'A');
  });
  assert.equal(scoped.client.identity(), 'anon');
});

test('parallel requests never inherit another user JWT client', async () => {
  const scoped = createRequestScopedClient(fake('anon'));
  let openGate!: () => void;
  const gate = new Promise<void>(resolve => { openGate = resolve; });
  const first = scoped.run(async () => {
    scoped.useAuthenticatedClient(fake('A'));
    await gate;
    return scoped.client.identity();
  });
  const second = scoped.run(async () => {
    scoped.useAuthenticatedClient(fake('B'));
    openGate();
    await Promise.resolve();
    return scoped.client.identity();
  });
  assert.deepEqual(await Promise.all([first, second]), ['A', 'B']);
  assert.equal(scoped.client.identity(), 'anon');
});
