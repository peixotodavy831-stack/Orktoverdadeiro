import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ChannelAdapterError,
  planChannelRetry,
  type ChannelAdapter,
  type ChannelAuditWriter,
  type ChannelFailureCategory,
  type ChannelSendRequest,
} from './channel-adapter.js';

export type DurableSendStatus = 'PREPARED' | 'QUEUED' | 'REQUEST_ACCEPTED' | 'PROVIDER_ACKNOWLEDGED' | 'DELIVERED' | 'FAILED' | 'UNKNOWN';
export type DurableReserveDecision = 'RESERVED' | 'IN_PROGRESS' | 'IDEMPOTENCY_CONFLICT' | 'RECONCILIATION_REQUIRED' | 'REPLAY';

export type DurableChannelSendRepository = {
  reserve(input: ChannelSendRequest & { provider: string; idempotencyKey: string; requestFingerprint: string }): Promise<{
    decision: DurableReserveDecision;
    requestId: string;
    currentStatus: DurableSendStatus;
    providerMessageId: string | null;
  }>;
  mark(input: {
    workspaceId: string;
    requestId: string;
    status: DurableSendStatus;
    providerMessageId?: string;
    failureCategory?: string;
    occurredAt?: string;
  }): Promise<'APPLIED' | 'STALE_IGNORED' | 'NOT_FOUND' | 'PROVIDER_REFERENCE_CONFLICT'>;
};

type RpcClient = Pick<SupabaseClient, 'rpc'>;

/** Uses migration 18's service-role-only RPCs; browser clients cannot execute these procedures. */
export function createDurableChannelSendRepository(db: RpcClient): DurableChannelSendRepository {
  return {
    async reserve(input) {
      const { data, error } = await db.rpc('orkto_reserve_channel_send', {
        p_workspace_id: input.workspaceId,
        p_conversation_id: input.conversationId,
        p_channel: input.channel,
        p_provider: input.provider,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
      });
      if (error) throw new Error('PERSISTENCE_UNAVAILABLE');
      const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
      const decisions = new Set<DurableReserveDecision>(['RESERVED', 'IN_PROGRESS', 'IDEMPOTENCY_CONFLICT', 'RECONCILIATION_REQUIRED', 'REPLAY']);
      const statuses = new Set<DurableSendStatus>(['PREPARED', 'QUEUED', 'REQUEST_ACCEPTED', 'PROVIDER_ACKNOWLEDGED', 'DELIVERED', 'FAILED', 'UNKNOWN']);
      if (!row || typeof row.decision !== 'string' || !decisions.has(row.decision as DurableReserveDecision)
        || typeof row.send_request_id !== 'string' || typeof row.send_status !== 'string'
        || !statuses.has(row.send_status as DurableSendStatus)) throw new Error('PERSISTENCE_UNAVAILABLE');
      return {
        decision: row.decision as DurableReserveDecision,
        requestId: row.send_request_id,
        currentStatus: row.send_status as DurableSendStatus,
        providerMessageId: typeof row.provider_message_id === 'string' ? row.provider_message_id : null,
      };
    },
    async mark(input) {
      const { data, error } = await db.rpc('orkto_mark_channel_send', {
        p_workspace_id: input.workspaceId,
        p_send_request_id: input.requestId,
        p_target_status: input.status,
        p_provider_message_id: input.providerMessageId || null,
        p_failure_category: input.failureCategory || null,
        p_occurred_at: input.occurredAt || new Date().toISOString(),
      });
      if (error) throw new Error('PERSISTENCE_UNAVAILABLE');
      if (data === 'APPLIED' || data === 'STALE_IGNORED' || data === 'NOT_FOUND' || data === 'PROVIDER_REFERENCE_CONFLICT') return data;
      throw new Error('PERSISTENCE_UNAVAILABLE');
    },
  };
}

export type DurableChannelSendOutcome =
  | { status: 'CONFIGURATION_REQUIRED'; channel: string }
  | { status: 'REQUEST_ACCEPTED' | 'PROVIDER_ACKNOWLEDGED' | 'DELIVERED'; requestId: string; provider: string; externalMessageId: string; acceptedAt: string | null; replay: boolean }
  | { status: 'IN_PROGRESS' | 'RECONCILIATION_REQUIRED' | 'PERSISTENCE_UNAVAILABLE' | 'IDEMPOTENCY_CONFLICT' | 'FAILED'; requestId?: string; category?: string; retryAt?: string | null };

function fingerprint(request: ChannelSendRequest): string {
  return createHash('sha256').update(JSON.stringify({
    workspaceId: request.workspaceId,
    conversationId: request.conversationId,
    channel: request.channel,
    content: request.content,
  })).digest('hex');
}

function persistedOutcome(input: {
  status: DurableSendStatus;
  requestId: string;
  provider: string;
  externalMessageId: string | null;
  acceptedAt: string | null;
  replay: boolean;
}): DurableChannelSendOutcome {
  if (input.status === 'REQUEST_ACCEPTED' || input.status === 'PROVIDER_ACKNOWLEDGED' || input.status === 'DELIVERED') {
    if (!input.externalMessageId) return { status: 'RECONCILIATION_REQUIRED', requestId: input.requestId, category: 'provider_reference_missing' };
    return {
      status: input.status,
      requestId: input.requestId,
      provider: input.provider,
      externalMessageId: input.externalMessageId,
      acceptedAt: input.acceptedAt,
      replay: input.replay,
    };
  }
  if (input.status === 'UNKNOWN') return { status: 'RECONCILIATION_REQUIRED', requestId: input.requestId, category: 'outcome_unknown' };
  if (input.status === 'FAILED') return { status: 'FAILED', requestId: input.requestId, category: 'provider_error' };
  return { status: 'IN_PROGRESS', requestId: input.requestId };
}

/** A provider is never called before a durable reservation; acceptance is distinct from receipt-backed delivery. */
export async function sendThroughDurableChannelAdapter(input: {
  repository: DurableChannelSendRepository | null;
  adapter: ChannelAdapter | null;
  request: ChannelSendRequest;
  audit: ChannelAuditWriter;
  now?: number;
}): Promise<DurableChannelSendOutcome> {
  const { repository, adapter, request, audit } = input;
  if (!adapter) {
    await audit({ eventType: 'channel.send.configuration_required', workspaceId: request.workspaceId,
      conversationId: request.conversationId, channel: request.channel, status: 'CONFIGURATION_REQUIRED' });
    return { status: 'CONFIGURATION_REQUIRED', channel: request.channel };
  }
  if (!repository) return { status: 'PERSISTENCE_UNAVAILABLE', category: 'durable_idempotency_unavailable' };
  const idempotencyKey = request.idempotencyKey?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200 || !request.content.trim()) {
    return { status: 'FAILED', category: 'validation_failed' };
  }
  if (adapter.channel !== request.channel) return { status: 'FAILED', category: 'channel_adapter_mismatch' };

  let claim: Awaited<ReturnType<DurableChannelSendRepository['reserve']>>;
  try {
    claim = await repository.reserve({ ...request, idempotencyKey, provider: adapter.provider, requestFingerprint: fingerprint(request) });
  } catch {
    return { status: 'PERSISTENCE_UNAVAILABLE', category: 'durable_idempotency_unavailable' };
  }
  if (claim.decision === 'IDEMPOTENCY_CONFLICT') return { status: 'IDEMPOTENCY_CONFLICT', requestId: claim.requestId };
  if (claim.decision === 'IN_PROGRESS') return { status: 'IN_PROGRESS', requestId: claim.requestId };
  if (claim.decision === 'RECONCILIATION_REQUIRED') return { status: 'RECONCILIATION_REQUIRED', requestId: claim.requestId, category: 'outcome_unknown' };
  if (claim.decision === 'REPLAY') return persistedOutcome({ status: claim.currentStatus, requestId: claim.requestId,
    provider: adapter.provider, externalMessageId: claim.providerMessageId, acceptedAt: null, replay: true });

  try {
    await audit({ eventType: 'channel.send.requested', workspaceId: request.workspaceId, conversationId: request.conversationId,
      channel: request.channel, provider: adapter.provider, idempotencyKey, status: 'PREPARED' });
  } catch {
    await repository.mark({ workspaceId: request.workspaceId, requestId: claim.requestId, status: 'FAILED', failureCategory: 'audit_unavailable' }).catch(() => undefined);
    return { status: 'PERSISTENCE_UNAVAILABLE', requestId: claim.requestId, category: 'audit_unavailable' };
  }

  let accepted: { externalMessageId: string; acceptedAt: string };
  try {
    accepted = await adapter.send({ ...request, idempotencyKey });
    if (!accepted?.externalMessageId?.trim() || !Number.isFinite(Date.parse(accepted.acceptedAt))) {
      throw new ChannelAdapterError('provider returned an invalid acceptance reference', 'outcome_unknown');
    }
  } catch (error) {
    const failure = error instanceof ChannelAdapterError ? error : new ChannelAdapterError('provider outcome is uncertain', 'outcome_unknown');
    let confirmedNoSend = failure.category !== 'outcome_unknown';
    if (!confirmedNoSend) {
      try {
        const resolved = await adapter.findByIdempotencyKey(request.workspaceId, idempotencyKey);
        if (resolved && resolved !== 'unknown' && resolved.externalMessageId?.trim() && Number.isFinite(Date.parse(resolved.acceptedAt))) {
          const persisted = await repository.mark({ workspaceId: request.workspaceId, requestId: claim.requestId,
            status: 'REQUEST_ACCEPTED', providerMessageId: resolved.externalMessageId, occurredAt: resolved.acceptedAt });
          if (persisted === 'APPLIED') {
            await audit({ eventType: 'channel.send.reconciled', workspaceId: request.workspaceId, conversationId: request.conversationId,
              channel: request.channel, provider: adapter.provider, externalMessageId: resolved.externalMessageId,
              idempotencyKey, status: 'REQUEST_ACCEPTED' });
            return { status: 'REQUEST_ACCEPTED', requestId: claim.requestId, provider: adapter.provider,
              externalMessageId: resolved.externalMessageId, acceptedAt: resolved.acceptedAt, replay: true };
          }
        }
        confirmedNoSend = resolved === null;
      } catch { /* Uncertain lookup remains fail-closed. */ }
    }
    if (confirmedNoSend) {
      const retry = planChannelRetry({ category: failure.category, attempt: 1, now: input.now, retryAfterMs: failure.retryAfterMs });
      const marked = await repository.mark({ workspaceId: request.workspaceId, requestId: claim.requestId,
        status: 'FAILED', failureCategory: failure.category });
      if (marked !== 'APPLIED') return { status: 'PERSISTENCE_UNAVAILABLE', requestId: claim.requestId, category: 'failure_state_not_persisted' };
      await audit({ eventType: 'channel.send.failed', workspaceId: request.workspaceId, conversationId: request.conversationId,
        channel: request.channel, provider: adapter.provider, idempotencyKey, status: 'FAILED', failureCategory: failure.category });
      return { status: 'FAILED', requestId: claim.requestId, category: failure.category, retryAt: retry.retryAt };
    }
    await repository.mark({ workspaceId: request.workspaceId, requestId: claim.requestId, status: 'UNKNOWN', failureCategory: 'outcome_unknown' }).catch(() => undefined);
    await audit({ eventType: 'channel.send.failed', workspaceId: request.workspaceId, conversationId: request.conversationId,
      channel: request.channel, provider: adapter.provider, idempotencyKey, status: 'UNKNOWN', failureCategory: 'outcome_unknown' }).catch(() => undefined);
    return { status: 'RECONCILIATION_REQUIRED', requestId: claim.requestId, category: 'outcome_unknown' };
  }

  let persisted: 'APPLIED' | 'STALE_IGNORED' | 'NOT_FOUND' | 'PROVIDER_REFERENCE_CONFLICT';
  try {
    persisted = await repository.mark({ workspaceId: request.workspaceId, requestId: claim.requestId,
      status: 'REQUEST_ACCEPTED', providerMessageId: accepted.externalMessageId, occurredAt: accepted.acceptedAt });
  } catch {
    return { status: 'RECONCILIATION_REQUIRED', requestId: claim.requestId, category: 'acceptance_not_persisted' };
  }
  if (persisted !== 'APPLIED') return { status: 'RECONCILIATION_REQUIRED', requestId: claim.requestId, category: 'acceptance_not_persisted' };
  try {
    await audit({ eventType: 'channel.send.accepted', workspaceId: request.workspaceId, conversationId: request.conversationId,
      channel: request.channel, provider: adapter.provider, externalMessageId: accepted.externalMessageId,
      idempotencyKey, status: 'REQUEST_ACCEPTED' });
  } catch {
    return { status: 'REQUEST_ACCEPTED', requestId: claim.requestId, provider: adapter.provider,
      externalMessageId: accepted.externalMessageId, acceptedAt: accepted.acceptedAt, replay: false };
  }
  return { status: 'REQUEST_ACCEPTED', requestId: claim.requestId, provider: adapter.provider,
    externalMessageId: accepted.externalMessageId, acceptedAt: accepted.acceptedAt, replay: false };
}
