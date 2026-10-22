import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWiaActions } from '../src/product/adapters/wia-actions.js';

test('WIA first view and approvals load one HTTP resource; history preserves all five existing status queries', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  const signal = new AbortController().signal;
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.signal, signal);
    assert.equal((init?.headers as Record<string,string>).Authorization, 'Bearer fixture-session');
    assert.equal(init?.body, undefined);
    calls.push(String(input));
    return new Response(JSON.stringify({data:[{id:String(input),status:String(input).split('=').at(-1),created_at:'2026-10-22T10:00:00Z'}]}));
  };
  try {
    for (const section of ['request','approvals'] as const) {
      calls.length = 0;
      assert.equal((await loadWiaActions(section,'fixture-session',signal)).length,1);
      assert.deepEqual(calls,['/api/wia/actions?status=awaiting_approval']);
    }
    calls.length = 0;
    assert.equal((await loadWiaActions('history','fixture-session',signal)).length,5);
    assert.equal(calls.length,5);
    assert.equal(new Set(calls).size,5);
    calls.length = 0;
    await assert.rejects(loadWiaActions('request',null,signal),/sessão expirou/);
    assert.equal(calls.length,0);
  } finally { globalThis.fetch = original; }
});

test('WIA history fails visibly on a failed status query instead of returning a partial success', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async input => String(input).endsWith('failed')
    ? new Response(JSON.stringify({error:'Fixture unavailable'}),{status:503})
    : new Response(JSON.stringify({data:[]}));
  try { await assert.rejects(loadWiaActions('history','fixture-session'),/Fixture unavailable/); }
  finally { globalThis.fetch = original; }
});
