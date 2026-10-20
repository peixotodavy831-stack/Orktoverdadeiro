import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyPilotSession as backendPolicy } from '../supabase/functions/orkto-core-mutations/_shared/pilot-access.mjs';
import { verifyPilotSession as edgePolicy } from '../supabase/functions/orkto-core-mutations/_shared/pilot-access.ts';

test('Vercel and Supabase Edge use the same pilot access policy module', () => {
  assert.equal(backendPolicy, edgePolicy);
});

test('pilot access fails closed for denied, unavailable, and thrown RPC results', async () => {
  assert.equal(await backendPolicy({ rpc: async () => ({ data: true, error: null }) }), 'allowed');
  assert.equal(await backendPolicy({ rpc: async () => ({ data: false, error: null }) }), 'denied');
  assert.equal(await backendPolicy({ rpc: async () => ({ data: true, error: new Error('database unavailable') }) }), 'unavailable');
  assert.equal(await backendPolicy({ rpc: async () => { throw new Error('network unavailable'); } }), 'unavailable');
});
