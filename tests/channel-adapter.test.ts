import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ChannelAdapterError, planChannelRetry, recordChannelDeliveryConfirmation, sendThroughChannelAdapter, type ChannelAdapter, type ChannelAuditEvent } from '../backend/channels/channel-adapter.js';
import { persistChannelDeliveryToSupabase } from '../backend/channels/delivery-ledger.js';

const request = { workspaceId: 'workspace-a', conversationId: 'conversation-a', channel: 'whatsapp', content: 'Olá', idempotencyKey: 'message-key-1' };

test('missing external channel returns CONFIGURATION_REQUIRED and emits an audit event without claiming delivery', async () => {
  const events: ChannelAuditEvent[] = [];
  const result = await sendThroughChannelAdapter({ adapter: null, request, audit: async event => { events.push(event); } });
  assert.deepEqual(result, { status: 'CONFIGURATION_REQUIRED', channel: 'whatsapp' });
  assert.equal(events[0]?.eventType, 'channel.send.configuration_required');
  assert.equal(events[0]?.status, 'CONFIGURATION_REQUIRED');
});

test('configured adapter uses provider idempotency and recovers an accepted message without sending twice', async () => {
  const events: ChannelAuditEvent[] = [];
  let providerMessage: { externalMessageId: string; acceptedAt: string } | null = null;
  let sendCount = 0;
  const adapter: ChannelAdapter = {
    channel: 'whatsapp', provider: 'test-adapter',
    async findByIdempotencyKey() { return providerMessage; },
    async send(input) {
      sendCount += 1;
      assert.equal(input.idempotencyKey, request.idempotencyKey);
      providerMessage = { externalMessageId: 'external-123', acceptedAt: '2026-09-27T10:00:00.000Z' };
      return providerMessage;
    },
    parseDeliveryConfirmation() { return null; },
  };
  const send = async () => sendThroughChannelAdapter({ adapter, request, audit: async event => { events.push(event); }, now: Date.parse('2026-09-27T10:00:00.000Z') });
  const first = await send();
  const retry = await send();
  assert.equal(first.status, 'accepted');
  assert.equal(retry.status, 'accepted');
  if (first.status === 'accepted' && retry.status === 'accepted') {
    assert.equal(first.externalMessageId, 'external-123');
    assert.equal(first.idempotentReplay, false);
    assert.equal(retry.idempotentReplay, true);
  }
  assert.equal(sendCount, 1);
  assert.ok(events.some(event => event.eventType === 'channel.send.accepted' && event.externalMessageId === 'external-123'));
  assert.ok(events.some(event => event.eventType === 'channel.send.reconciled'));
});

test('retry policy is bounded and does not retry auth failures or uncertain delivery outcomes', () => {
  const retry = planChannelRetry({ category: 'rate_limit', attempt: 2, now: 1_000, retryAfterMs: 30_000 });
  assert.equal(retry.retryAt, new Date(31_000).toISOString());
  assert.equal(planChannelRetry({ category: 'authentication', attempt: 1, now: 1_000 }).retryAt, null);
  assert.deepEqual(planChannelRetry({ category: 'outcome_unknown', attempt: 1, now: 1_000 }), { retryAt: null, requiresReconciliation: true });
  assert.equal(planChannelRetry({ category: 'timeout', attempt: 6, now: 1_000 }).retryAt, null);
});

test('ambiguous provider failure is reconciled before returning retry and records no false success', async () => {
  const events: ChannelAuditEvent[] = [];
  const adapter: ChannelAdapter = {
    channel: 'whatsapp', provider: 'test-adapter',
    async findByIdempotencyKey() { return 'unknown'; },
    async send() { throw new ChannelAdapterError('timeout', 'outcome_unknown'); },
    parseDeliveryConfirmation() { return null; },
  };
  const result = await sendThroughChannelAdapter({ adapter, request, audit: async event => { events.push(event); } });
  assert.deepEqual(result, { status: 'failed', category: 'outcome_unknown', retryAt: null, reconciliationRequired: true });
  assert.ok(events.some(event => event.eventType === 'channel.send.failed' && event.status === 'reconciliation_required'));
  assert.equal(events.some(event => event.eventType === 'channel.send.accepted'), false);
});

test('invalid idempotency lookup fails closed instead of risking a duplicate provider message', async () => {
  const events: ChannelAuditEvent[] = [];
  let sendCount = 0;
  const adapter: ChannelAdapter = {
    channel: 'whatsapp', provider: 'test-adapter',
    async findByIdempotencyKey() { return { externalMessageId: '', acceptedAt: 'not-a-date' } as any; },
    async send() { sendCount += 1; return { externalMessageId: 'unexpected', acceptedAt: new Date().toISOString() }; },
    parseDeliveryConfirmation() { return null; },
  };
  const result = await sendThroughChannelAdapter({ adapter, request, audit: async event => { events.push(event); } });
  assert.deepEqual(result, { status: 'failed', category: 'outcome_unknown', retryAt: null, reconciliationRequired: true });
  assert.equal(sendCount, 0);
  assert.ok(events.some(event => event.status === 'reconciliation_required'));
});

test('delivery confirmations must be normalized and are audited with the provider message ID', async () => {
  const events: ChannelAuditEvent[] = [];
  const persisted: string[] = [];
  const adapter: ChannelAdapter = {
    channel: 'whatsapp', provider: 'test-adapter',
    async findByIdempotencyKey() { return null; },
    async send() { return { externalMessageId: 'x', acceptedAt: '2026-09-27T10:00:00Z' }; },
    parseDeliveryConfirmation(payload) { return payload as any; },
  };
  const receipt = { eventId: 'evt-1', externalMessageId: 'external-123', channel: 'whatsapp', status: 'delivered', occurredAt: '2026-09-27T10:01:00.000Z' } as const;
  const write = async () => { persisted.push('written'); return 'APPLIED' as const; };
  assert.deepEqual(await recordChannelDeliveryConfirmation({ adapter, workspaceId: 'workspace-a', conversationId: 'conversation-a', payload: receipt, persist: write, audit: async event => { assert.equal(persisted.length, 1); events.push(event); } }), receipt);
  assert.equal(await recordChannelDeliveryConfirmation({ adapter, workspaceId: 'workspace-a', conversationId: 'conversation-a', payload: { ...receipt, externalMessageId: '' }, persist: write, audit: async event => { events.push(event); } }), null);
  assert.equal(await recordChannelDeliveryConfirmation({ adapter, workspaceId: 'workspace-a', conversationId: 'conversation-a', payload: { ...receipt, status: 'pretend_delivered' }, persist: write, audit: async event => { events.push(event); } }), null);
  assert.equal(await recordChannelDeliveryConfirmation({ adapter, workspaceId: 'workspace-a', conversationId: 'conversation-a', payload: { ...receipt, eventId: undefined }, persist: write, audit: async event => { events.push(event); } }), null);
  assert.ok(events.some(event => event.eventType === 'channel.delivery.confirmed' && event.externalMessageId === 'external-123'));
  assert.equal(persisted.length, 1);
});

test('delivery receipt is never audited as delivered when durable persistence fails', async () => {
  const events: ChannelAuditEvent[] = [];
  const adapter: ChannelAdapter = {
    channel: 'whatsapp', provider: 'test-adapter',
    async findByIdempotencyKey() { return null; },
    async send() { return { externalMessageId: 'external-1', acceptedAt: new Date().toISOString() }; },
    parseDeliveryConfirmation(payload) { return payload as any; },
  };
  const receipt = { eventId: 'evt-2', externalMessageId: 'external-1', channel: 'whatsapp', status: 'delivered', occurredAt: new Date().toISOString() };
  await assert.rejects(() => recordChannelDeliveryConfirmation({
    adapter, workspaceId: 'workspace-a', conversationId: 'conversation-a', payload: receipt,
    persist: async () => 'NOT_FOUND', audit: async event => { events.push(event); },
  }), /provider receipt could not be reconciled/);
  assert.equal(events.length, 0);
});

test('delivery persistence binds the receipt to one workspace and stored provider message', async () => {
  const filters: [string, string][] = [];
  let rpcArgs: Record<string, unknown> | null = null;
  const query = {
    select() { return this; },
    eq(column: string, value: string) { filters.push([column, value]); return this; },
    async maybeSingle() { return { data: { id: 'stored-send-id' }, error: null }; },
  };
  const db = {
    from(table: string) { assert.equal(table, 'orkto_channel_send_requests'); return query; },
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, 'orkto_record_channel_delivery_event');
      rpcArgs = args;
      return { data: 'APPLIED', error: null };
    },
  } as unknown as SupabaseClient;
  const receipt = { eventId: 'evt-3', externalMessageId: 'provider-msg-3', channel: 'whatsapp', status: 'read', occurredAt: '2026-09-28T10:00:00.000Z' } as const;
  const result = await persistChannelDeliveryToSupabase(db, {
    workspaceId: 'workspace-a', conversationId: 'conversation-a', provider: 'test-provider', receipt,
  });
  assert.equal(result, 'APPLIED');
  assert.deepEqual(filters, [
    ['workspace_id', 'workspace-a'], ['conversation_id', 'conversation-a'],
    ['provider', 'test-provider'], ['provider_message_id', 'provider-msg-3'],
  ]);
  assert.equal(rpcArgs?.p_send_request_id, 'stored-send-id');
  assert.equal(rpcArgs?.p_workspace_id, 'workspace-a');
  assert.equal(rpcArgs?.p_status, 'DELIVERED');
  assert.match(String(rpcArgs?.p_payload_fingerprint), /^[a-f0-9]{64}$/);
});
