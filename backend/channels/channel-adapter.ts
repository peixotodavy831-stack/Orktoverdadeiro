export type ChannelDeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed';
export type ChannelFailureCategory = 'rate_limit' | 'timeout' | 'authentication' | 'invalid_request' | 'provider_transient' | 'outcome_unknown';

export interface ChannelSendRequest {
  workspaceId: string;
  conversationId: string;
  channel: string;
  content: string;
  /** Required by configured adapters; optional only while returning CONFIGURATION_REQUIRED. */
  idempotencyKey?: string;
}

export interface ChannelDeliveryConfirmation {
  eventId: string;
  externalMessageId: string;
  channel: string;
  status: ChannelDeliveryStatus;
  occurredAt: string;
  failure?: { category: ChannelFailureCategory; code?: string };
}

export interface ChannelAdapter {
  readonly channel: string;
  readonly provider: string;
  /** Adapter implementations must pass the idempotency key through to the provider where supported. */
  send(request: ChannelSendRequest & { idempotencyKey: string }): Promise<{
    externalMessageId: string;
    acceptedAt: string;
  }>;
  /** Resolve ambiguous network outcomes before any retry to prevent duplicate messages. */
  findByIdempotencyKey(workspaceId: string, idempotencyKey: string): Promise<{
    externalMessageId: string;
    acceptedAt: string;
  } | null | 'unknown'>;
  /** Provider webhook/poll payloads must be normalized and validated before they reach domain code. */
  parseDeliveryConfirmation(payload: unknown): ChannelDeliveryConfirmation | null;
}

export type ChannelAuditEvent = {
  eventType:
    | 'channel.send.configuration_required'
    | 'channel.send.requested'
    | 'channel.send.accepted'
    | 'channel.send.failed'
    | 'channel.send.reconciled'
    | 'channel.delivery.confirmed'
    | 'channel.send.retry_planned';
  workspaceId: string;
  conversationId: string;
  channel: string;
  provider?: string;
  externalMessageId?: string;
  idempotencyKey?: string;
  status?: string;
  attempt?: number;
  failureCategory?: ChannelFailureCategory;
  retryAt?: string;
};

export type ChannelAuditWriter = (event: ChannelAuditEvent) => Promise<void>;
export type ChannelDeliveryPersistenceResult = 'APPLIED' | 'DUPLICATE' | 'STALE_IGNORED' | 'NOT_FOUND' | 'PROVIDER_REFERENCE_CONFLICT' | 'EVENT_CONFLICT';
export type ChannelDeliveryWriter = (input: {
  workspaceId: string;
  conversationId: string;
  provider: string;
  receipt: ChannelDeliveryConfirmation;
}) => Promise<ChannelDeliveryPersistenceResult>;

export type ChannelSendOutcome =
  | { status: 'CONFIGURATION_REQUIRED'; channel: string }
  | { status: 'accepted'; provider: string; externalMessageId: string; acceptedAt: string; idempotentReplay: boolean }
  | { status: 'failed'; category: ChannelFailureCategory; retryAt: string | null; reconciliationRequired: boolean };

export class ChannelAdapterError extends Error {
  constructor(
    message: string,
    readonly category: ChannelFailureCategory,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ChannelAdapterError';
  }
}

const RETRYABLE_FAILURES = new Set<ChannelFailureCategory>(['rate_limit', 'timeout', 'provider_transient']);
const DELIVERY_STATUSES = new Set<ChannelDeliveryStatus>(['sent', 'delivered', 'read', 'failed']);
const FAILURE_CATEGORIES = new Set<ChannelFailureCategory>(['rate_limit', 'timeout', 'authentication', 'invalid_request', 'provider_transient', 'outcome_unknown']);

/** Retry is a scheduling recommendation only; callers must persist the job and re-check the idempotency key. */
export function planChannelRetry(input: { category: ChannelFailureCategory; attempt: number; now?: number; retryAfterMs?: number }): { retryAt: string | null; requiresReconciliation: boolean } {
  if (input.category === 'outcome_unknown') return { retryAt: null, requiresReconciliation: true };
  if (!RETRYABLE_FAILURES.has(input.category) || !Number.isInteger(input.attempt) || input.attempt < 1 || input.attempt >= 6) {
    return { retryAt: null, requiresReconciliation: false };
  }
  const backoffMs = Math.min(15 * 60_000, 15_000 * (2 ** (input.attempt - 1)));
  const delayMs = Math.max(backoffMs, Math.min(60 * 60_000, Math.max(0, input.retryAfterMs || 0)));
  return { retryAt: new Date((input.now ?? Date.now()) + delayMs).toISOString(), requiresReconciliation: false };
}

function validProviderSend(value: { externalMessageId: string; acceptedAt: string }): boolean {
  return typeof value?.externalMessageId === 'string'
    && Boolean(value.externalMessageId.trim())
    && typeof value.acceptedAt === 'string'
    && Number.isFinite(Date.parse(value.acceptedAt));
}

/** One gateway contract for all channels. A missing adapter is an explicit non-delivery, never a mock success. */
export async function sendThroughChannelAdapter(input: {
  adapter: ChannelAdapter | null;
  request: ChannelSendRequest;
  audit: ChannelAuditWriter;
  attempt?: number;
  now?: number;
}): Promise<ChannelSendOutcome> {
  const { adapter, request, audit } = input;
  if (!adapter) {
    await audit({
      eventType: 'channel.send.configuration_required',
      workspaceId: request.workspaceId,
      conversationId: request.conversationId,
      channel: request.channel,
      status: 'CONFIGURATION_REQUIRED',
    });
    return { status: 'CONFIGURATION_REQUIRED', channel: request.channel };
  }

  const idempotencyKey = request.idempotencyKey?.trim();
  if (!idempotencyKey) throw new Error('idempotency_key_required');
  if (adapter.channel !== request.channel) throw new Error('channel_adapter_mismatch');

  await audit({ eventType: 'channel.send.requested', workspaceId: request.workspaceId, conversationId: request.conversationId, channel: request.channel, provider: adapter.provider, idempotencyKey, attempt: input.attempt ?? 1 });

  let prior: Awaited<ReturnType<ChannelAdapter['findByIdempotencyKey']>>;
  try {
    prior = await adapter.findByIdempotencyKey(request.workspaceId, idempotencyKey);
  } catch {
    prior = 'unknown';
  }
  if (prior === 'unknown') {
    const retry = planChannelRetry({ category: 'outcome_unknown', attempt: input.attempt ?? 1, now: input.now });
    await audit({ eventType: 'channel.send.failed', workspaceId: request.workspaceId, conversationId: request.conversationId, channel: request.channel, provider: adapter.provider, idempotencyKey, status: 'reconciliation_required', failureCategory: 'outcome_unknown' });
    return { status: 'failed', category: 'outcome_unknown', retryAt: retry.retryAt, reconciliationRequired: true };
  }
  if (prior !== null) {
    if (validProviderSend(prior)) {
      await audit({ eventType: 'channel.send.reconciled', workspaceId: request.workspaceId, conversationId: request.conversationId, channel: request.channel, provider: adapter.provider, externalMessageId: prior.externalMessageId, idempotencyKey, status: 'accepted' });
      return { status: 'accepted', provider: adapter.provider, externalMessageId: prior.externalMessageId, acceptedAt: prior.acceptedAt, idempotentReplay: true };
    }
    await audit({ eventType: 'channel.send.failed', workspaceId: request.workspaceId, conversationId: request.conversationId, channel: request.channel, provider: adapter.provider, idempotencyKey, status: 'reconciliation_required', failureCategory: 'outcome_unknown' });
    return { status: 'failed', category: 'outcome_unknown', retryAt: null, reconciliationRequired: true };
  }

  try {
    const sent = await adapter.send({ ...request, idempotencyKey });
    if (!validProviderSend(sent)) throw new ChannelAdapterError('provider returned no durable message reference', 'outcome_unknown');
    await audit({ eventType: 'channel.send.accepted', workspaceId: request.workspaceId, conversationId: request.conversationId, channel: request.channel, provider: adapter.provider, externalMessageId: sent.externalMessageId, idempotencyKey, status: 'accepted' });
    return { status: 'accepted', provider: adapter.provider, externalMessageId: sent.externalMessageId, acceptedAt: sent.acceptedAt, idempotentReplay: false };
  } catch (error) {
    const failure = error instanceof ChannelAdapterError
      ? error
      : new ChannelAdapterError('provider request failed with an unknown outcome', 'outcome_unknown');
    const resolution = failure.category === 'outcome_unknown'
      ? await adapter.findByIdempotencyKey(request.workspaceId, idempotencyKey).catch(() => 'unknown' as const)
      : null;
    if (resolution && resolution !== 'unknown' && validProviderSend(resolution)) {
      await audit({ eventType: 'channel.send.reconciled', workspaceId: request.workspaceId, conversationId: request.conversationId, channel: request.channel, provider: adapter.provider, externalMessageId: resolution.externalMessageId, idempotencyKey, status: 'accepted' });
      return { status: 'accepted', provider: adapter.provider, externalMessageId: resolution.externalMessageId, acceptedAt: resolution.acceptedAt, idempotentReplay: true };
    }
    const category: ChannelFailureCategory = resolution === 'unknown' ? 'outcome_unknown' : failure.category;
    const retry = planChannelRetry({ category, attempt: input.attempt ?? 1, now: input.now, retryAfterMs: failure.retryAfterMs });
    await audit({ eventType: 'channel.send.failed', workspaceId: request.workspaceId, conversationId: request.conversationId, channel: request.channel, provider: adapter.provider, idempotencyKey, status: retry.retryAt ? 'retryable_failure' : retry.requiresReconciliation ? 'reconciliation_required' : 'failed', attempt: input.attempt ?? 1, failureCategory: category });
    if (retry.retryAt) await audit({ eventType: 'channel.send.retry_planned', workspaceId: request.workspaceId, conversationId: request.conversationId, channel: request.channel, provider: adapter.provider, idempotencyKey, status: 'scheduled_by_caller', attempt: input.attempt ?? 1, failureCategory: category, retryAt: retry.retryAt });
    return { status: 'failed', category, retryAt: retry.retryAt, reconciliationRequired: retry.requiresReconciliation };
  }
}

/** A delivery label is returned only after a verified receipt was durably persisted. */
export async function recordChannelDeliveryConfirmation(input: {
  adapter: ChannelAdapter;
  workspaceId: string;
  conversationId: string;
  payload: unknown;
  persist: ChannelDeliveryWriter;
  audit: ChannelAuditWriter;
}): Promise<ChannelDeliveryConfirmation | null> {
  let receipt: ChannelDeliveryConfirmation | null;
  try { receipt = input.adapter.parseDeliveryConfirmation(input.payload); } catch { return null; }
  if (!receipt
    || receipt.channel !== input.adapter.channel
    || typeof receipt.eventId !== 'string' || !receipt.eventId.trim()
    || typeof receipt.externalMessageId !== 'string' || !receipt.externalMessageId.trim()
    || !DELIVERY_STATUSES.has(receipt.status)
    || typeof receipt.occurredAt !== 'string' || !Number.isFinite(Date.parse(receipt.occurredAt))) return null;
  if (receipt.failure && !FAILURE_CATEGORIES.has(receipt.failure.category)) return null;
  if (receipt.status === 'failed' && !receipt.failure) return null;
  const saved = await input.persist({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    provider: input.adapter.provider,
    receipt,
  });
  if (saved === 'STALE_IGNORED') return null;
  if (saved !== 'APPLIED' && saved !== 'DUPLICATE') {
    throw new ChannelAdapterError('provider receipt could not be reconciled to a stored send request', 'outcome_unknown');
  }
  if (saved === 'DUPLICATE') return receipt;
  await input.audit({
    eventType: 'channel.delivery.confirmed',
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    channel: receipt.channel,
    provider: input.adapter.provider,
    externalMessageId: receipt.externalMessageId,
    status: receipt.status,
    failureCategory: receipt.failure?.category,
  });
  return receipt;
}
