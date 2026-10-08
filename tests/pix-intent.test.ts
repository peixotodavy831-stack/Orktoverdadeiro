import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPixIntentProviderEvent, createPixIntentRepository, preparePixIntent, type PixIntentClaim,
  type PixIntentRepository, type PixIntentRequest, type PixProviderAdapter } from '../backend/billing/pix-intent.js';

const request: PixIntentRequest = {
  workspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  quoteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  amountCents: 19900, currency: 'BRL', idempotencyKey: 'pix:synthetic:quote-1',
};

function fixture() {
  let claim: PixIntentClaim = { decision: 'RESERVED', intentId: 'intent-1', claimToken: 'claim-1', providerReference: null };
  const finishCalls: unknown[] = [];
  const repository: PixIntentRepository = {
    async claim(input) {
      if (input.amountCents !== request.amountCents || input.quoteId !== request.quoteId) return { ...claim, decision: 'IDEMPOTENCY_CONFLICT' };
      const current = claim;
      if (claim.decision === 'RESERVED') claim = { ...claim, decision: 'IN_PROGRESS' };
      return current;
    },
    async finish(input) {
      finishCalls.push(input);
      if (input.claimToken !== 'claim-1') return false;
      claim = { ...claim, decision: input.status === 'request_accepted' ? 'REQUEST_ACCEPTED' : 'RECONCILIATION_REQUIRED',
        providerReference: input.providerReference || null };
      return true;
    },
  };
  return { repository, finishCalls };
}

test('PIX requires a configured adapter and never claims a DB intent without it', async () => {
  const { repository } = fixture();
  assert.deepEqual(await preparePixIntent(request, repository), { status: 'CONFIGURATION_REQUIRED' });
});

test('same key and payload return the same accepted provider reference without a second charge', async () => {
  const { repository, finishCalls } = fixture();
  let creates = 0;
  const adapter: PixProviderAdapter = { provider: 'fake-sandbox',
    async create() { creates += 1; return { reference: 'provider-1' }; },
    async findByIdempotencyKey() { return null; },
  };
  assert.deepEqual(await preparePixIntent(request, repository, adapter),
    { status: 'REQUEST_ACCEPTED', intentId: 'intent-1', providerReference: 'provider-1', replay: false });
  assert.deepEqual(await preparePixIntent(request, repository, adapter),
    { status: 'REQUEST_ACCEPTED', intentId: 'intent-1', providerReference: 'provider-1', replay: true });
  assert.equal(creates, 1);
  assert.equal(finishCalls.length, 1);
});

test('same key with a changed quote amount fails closed before invoking provider', async () => {
  const { repository } = fixture();
  let creates = 0;
  const adapter: PixProviderAdapter = { provider: 'fake-sandbox',
    async create() { creates += 1; return { reference: 'provider-1' }; },
    async findByIdempotencyKey() { return null; },
  };
  assert.deepEqual(await preparePixIntent({ ...request, amountCents: 20000 }, repository, adapter),
    { status: 'IDEMPOTENCY_CONFLICT', intentId: 'intent-1' });
  assert.equal(creates, 0);
});

test('simultaneous same-key calls allow one provider create and fence the other', async () => {
  const { repository } = fixture();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let creates = 0;
  const adapter: PixProviderAdapter = { provider: 'fake-sandbox',
    async create() { creates += 1; await gate; return { reference: 'provider-1' }; },
    async findByIdempotencyKey() { return null; },
  };
  const first = preparePixIntent(request, repository, adapter);
  const second = await preparePixIntent(request, repository, adapter);
  assert.deepEqual(second, { status: 'IN_PROGRESS', intentId: 'intent-1' });
  release();
  assert.equal((await first).status, 'REQUEST_ACCEPTED');
  assert.equal(creates, 1);
});

test('timeout reconciles a known provider reference; an unknown outcome never retries create', async () => {
  const known = fixture();
  let creates = 0;
  const adapter: PixProviderAdapter = { provider: 'fake-sandbox',
    async create() { creates += 1; throw new Error('timeout'); },
    async findByIdempotencyKey() { return { reference: 'provider-found' }; },
  };
  assert.deepEqual(await preparePixIntent(request, known.repository, adapter),
    { status: 'REQUEST_ACCEPTED', intentId: 'intent-1', providerReference: 'provider-found', replay: false });
  const unknown = fixture();
  assert.deepEqual(await preparePixIntent(request, unknown.repository, { ...adapter,
    async findByIdempotencyKey() { throw new Error('provider 5xx'); },
  }), { status: 'RECONCILIATION_REQUIRED', intentId: 'intent-1' });
  assert.deepEqual(await preparePixIntent(request, unknown.repository, adapter),
    { status: 'RECONCILIATION_REQUIRED', intentId: 'intent-1' });
  assert.equal(creates, 2);
});

test('Supabase repository sends only claim/finish RPCs and rejects lost fencing claims', async () => {
  const calls: string[] = [];
  const repository = createPixIntentRepository({
    async rpc(name) {
      calls.push(name);
      if (name === 'orkto_claim_payment_intent') return { data: [{ decision: 'RESERVED', intent_id: 'intent-1', claim_token: 'claim-1', provider_reference: null }], error: null };
      return { data: false, error: null };
    },
  });
  const result = await preparePixIntent(request, repository, { provider: 'fake-sandbox',
    async create() { return { reference: 'provider-1' }; },
    async findByIdempotencyKey() { return null; },
  });
  assert.deepEqual(result, { status: 'PERSISTENCE_UNAVAILABLE', intentId: 'intent-1' });
  assert.deepEqual(calls, ['orkto_claim_payment_intent', 'orkto_finish_payment_intent']);
});

test('provider-event repository binds terminal state changes to the claimed event RPC', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const result = await applyPixIntentProviderEvent({
    async rpc(name, args) {
      calls.push({ name, args: args as Record<string, unknown> });
      return { data: [{ decision: 'APPLIED', intent_id: 'intent-1', workspace_id: request.workspaceId,
        quote_id: request.quoteId, intent_status: 'succeeded' }], error: null };
    },
  }, {
    provider: 'fake-sandbox', providerReference: 'provider-1', eventId: 'event-1', requestFingerprint: 'a'.repeat(64),
    claimToken: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    occurredAt: '2026-09-28T12:00:00.000Z', targetStatus: 'succeeded', providerStatus: 'PAYMENT_RECEIVED',
    amountCents: request.amountCents, currency: 'BRL',
  });
  assert.deepEqual(result, { decision: 'APPLIED', intentId: 'intent-1', workspaceId: request.workspaceId,
    quoteId: request.quoteId, intentStatus: 'succeeded' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'orkto_apply_payment_intent_provider_event');
  assert.equal(calls[0].args.p_provider_event_id, 'event-1');
  assert.equal(calls[0].args.p_amount_cents, request.amountCents);
});

test('provider-event repository rejects malformed event data before persistence', async () => {
  let calls = 0;
  await assert.rejects(() => applyPixIntentProviderEvent({
    async rpc() { calls += 1; return { data: [], error: null }; },
  }, {
    provider: 'fake-sandbox', providerReference: 'provider-1', eventId: 'event-1', requestFingerprint: 'bad',
    claimToken: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    occurredAt: 'not-a-date', targetStatus: 'succeeded', providerStatus: 'PAYMENT_RECEIVED',
    amountCents: request.amountCents, currency: 'BRL',
  }), /VALIDATION_FAILED/);
  assert.equal(calls, 0);
});
