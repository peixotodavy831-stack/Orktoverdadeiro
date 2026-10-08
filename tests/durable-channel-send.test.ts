import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChannelAdapter, ChannelAuditEvent } from '../backend/channels/channel-adapter.js';
import { createDurableChannelSendRepository, sendThroughDurableChannelAdapter,
  type DurableChannelSendRepository, type DurableSendStatus } from '../backend/channels/durable-send.js';

const request = { workspaceId: 'workspace-a', conversationId: 'conversation-a', channel: 'whatsapp',
  content: 'Mensagem sintética', idempotencyKey: 'durable-send-key-1' };
const acceptedAt = '2026-09-28T12:00:00.000Z';

function fixture() {
  let row: { requestId: string; fingerprint: string; status: DurableSendStatus; providerMessageId: string | null } | null = null;
  let nextId = 0;
  const marks: unknown[] = [];
  const repository: DurableChannelSendRepository = {
    async reserve(input) {
      if (!row) {
        row = { requestId: `send-${++nextId}`, fingerprint: input.requestFingerprint, status: 'PREPARED', providerMessageId: null };
        return { decision: 'RESERVED', requestId: row.requestId, currentStatus: row.status, providerMessageId: null };
      }
      if (row.fingerprint !== input.requestFingerprint) return { decision: 'IDEMPOTENCY_CONFLICT', requestId: row.requestId, currentStatus: row.status, providerMessageId: row.providerMessageId };
      if (row.status === 'UNKNOWN') return { decision: 'RECONCILIATION_REQUIRED', requestId: row.requestId, currentStatus: row.status, providerMessageId: row.providerMessageId };
      if (['PREPARED', 'QUEUED'].includes(row.status)) return { decision: 'IN_PROGRESS', requestId: row.requestId, currentStatus: row.status, providerMessageId: row.providerMessageId };
      return { decision: 'REPLAY', requestId: row.requestId, currentStatus: row.status, providerMessageId: row.providerMessageId };
    },
    async mark(input) {
      marks.push(input);
      if (!row || row.requestId !== input.requestId) return 'NOT_FOUND';
      row.status = input.status;
      row.providerMessageId = input.providerMessageId || row.providerMessageId;
      return 'APPLIED';
    },
  };
  return { repository, marks, get row() { return row; } };
}

function adapter(options: { send?: ChannelAdapter['send']; find?: ChannelAdapter['findByIdempotencyKey'] } = {}): ChannelAdapter {
  return {
    channel: 'whatsapp', provider: 'synthetic-provider',
    async send(input) { assert.equal(input.idempotencyKey, request.idempotencyKey); return options.send ? options.send(input) : { externalMessageId: 'provider-msg-1', acceptedAt }; },
    async findByIdempotencyKey(workspaceId, idempotencyKey) { return options.find ? options.find(workspaceId, idempotencyKey) : null; },
    parseDeliveryConfirmation() { return null; },
  };
}

test('a missing channel adapter is configuration-required and makes no durable send claim', async () => {
  let reservations = 0;
  const repository = { ...fixture().repository, async reserve() { reservations += 1; throw new Error('must not reserve'); } };
  const events: ChannelAuditEvent[] = [];
  const result = await sendThroughDurableChannelAdapter({ repository, adapter: null, request, audit: async event => { events.push(event); } });
  assert.deepEqual(result, { status: 'CONFIGURATION_REQUIRED', channel: 'whatsapp' });
  assert.equal(reservations, 0);
  assert.equal(events[0]?.status, 'CONFIGURATION_REQUIRED');
});

test('durable reservation stores accepted, replays exactly once, and does not call it delivered', async () => {
  const state = fixture();
  const events: ChannelAuditEvent[] = [];
  let sends = 0;
  const channel = adapter({ async send() { sends += 1; return { externalMessageId: 'provider-msg-1', acceptedAt }; } });
  const send = () => sendThroughDurableChannelAdapter({ repository: state.repository, adapter: channel, request, audit: async event => { events.push(event); } });
  const first = await send();
  const replay = await send();
  assert.equal(first.status, 'REQUEST_ACCEPTED');
  assert.equal(replay.status, 'REQUEST_ACCEPTED');
  if (first.status === 'REQUEST_ACCEPTED') assert.equal(first.acceptedAt, acceptedAt);
  if (replay.status === 'REQUEST_ACCEPTED') assert.equal(replay.replay, true);
  assert.equal(state.row?.status, 'REQUEST_ACCEPTED');
  assert.equal(sends, 1);
  assert.equal(events.some(event => event.status === 'DELIVERED'), false);
});

test('same idempotency key with changed message is rejected before provider side effect', async () => {
  const state = fixture();
  await sendThroughDurableChannelAdapter({ repository: state.repository, adapter: adapter(), request, audit: async () => undefined });
  let sends = 0;
  const result = await sendThroughDurableChannelAdapter({ repository: state.repository, adapter: adapter({ async send() { sends += 1; return { externalMessageId: 'unexpected', acceptedAt }; } }),
    request: { ...request, content: 'Outra mensagem' }, audit: async () => undefined });
  assert.equal(result.status, 'IDEMPOTENCY_CONFLICT');
  assert.equal(sends, 0);
});

test('concurrent same-key request cannot call the provider twice', async () => {
  const state = fixture();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let sends = 0;
  const channel = adapter({ async send() { sends += 1; await gate; return { externalMessageId: 'provider-msg-1', acceptedAt }; } });
  const first = sendThroughDurableChannelAdapter({ repository: state.repository, adapter: channel, request, audit: async () => undefined });
  const second = await sendThroughDurableChannelAdapter({ repository: state.repository, adapter: channel, request, audit: async () => undefined });
  assert.equal(second.status, 'IN_PROGRESS');
  release();
  assert.equal((await first).status, 'REQUEST_ACCEPTED');
  assert.equal(sends, 1);
});

test('uncertain provider outcome is durably marked UNKNOWN and never resent automatically', async () => {
  const state = fixture();
  let sends = 0;
  const channel = adapter({
    async send() { sends += 1; throw new Error('timeout'); },
    async find() { return 'unknown'; },
  });
  const send = () => sendThroughDurableChannelAdapter({ repository: state.repository, adapter: channel, request, audit: async () => undefined });
  assert.equal((await send()).status, 'RECONCILIATION_REQUIRED');
  assert.equal((await send()).status, 'RECONCILIATION_REQUIRED');
  assert.equal(state.row?.status, 'UNKNOWN');
  assert.equal(sends, 1);
});

test('provider-found after timeout is persisted as request accepted, not delivery', async () => {
  const state = fixture();
  const channel = adapter({ async send() { throw new Error('timeout'); }, async find() { return { externalMessageId: 'provider-reconciled', acceptedAt }; } });
  const result = await sendThroughDurableChannelAdapter({ repository: state.repository, adapter: channel, request, audit: async () => undefined });
  assert.equal(result.status, 'REQUEST_ACCEPTED');
  assert.equal(state.row?.status, 'REQUEST_ACCEPTED');
  if (result.status === 'REQUEST_ACCEPTED') assert.equal(result.externalMessageId, 'provider-reconciled');
});

test('Supabase durable repository uses only migration 18 reservation and status RPCs', async () => {
  const calls: { name: string; params: Record<string, unknown> }[] = [];
  const db = {
    async rpc(name: string, params: Record<string, unknown>) {
      calls.push({ name, params });
      if (name === 'orkto_reserve_channel_send') return { data: [{ decision: 'RESERVED', send_request_id: 'send-id', send_status: 'PREPARED', provider_message_id: null }], error: null };
      return { data: 'APPLIED', error: null };
    },
  } as unknown as SupabaseClient;
  const repository = createDurableChannelSendRepository(db);
  const reservation = await repository.reserve({ ...request, provider: 'synthetic-provider', idempotencyKey: request.idempotencyKey, requestFingerprint: 'a'.repeat(64) });
  const status = await repository.mark({ workspaceId: request.workspaceId, requestId: reservation.requestId, status: 'REQUEST_ACCEPTED', providerMessageId: 'provider-msg-1', occurredAt: acceptedAt });
  assert.equal(reservation.decision, 'RESERVED');
  assert.equal(status, 'APPLIED');
  assert.deepEqual(calls.map(call => call.name), ['orkto_reserve_channel_send', 'orkto_mark_channel_send']);
  assert.equal(calls[0]?.params.p_request_fingerprint, 'a'.repeat(64));
  assert.equal(calls[1]?.params.p_target_status, 'REQUEST_ACCEPTED');
});
