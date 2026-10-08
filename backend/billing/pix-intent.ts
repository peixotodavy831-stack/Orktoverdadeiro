import { createHash } from 'node:crypto';

export type PixIntentRequest = {
  workspaceId: string;
  quoteId: string;
  amountCents: number;
  currency: 'BRL';
  idempotencyKey: string;
};

type ClaimDecision = 'RESERVED' | 'IN_PROGRESS' | 'IDEMPOTENCY_CONFLICT' | 'REQUEST_ACCEPTED'
  | 'RECONCILIATION_REQUIRED' | 'REPLAY_SUCCEEDED' | 'TERMINAL';

export type PixIntentClaim = {
  decision: ClaimDecision;
  intentId: string;
  claimToken: string | null;
  providerReference: string | null;
};

export type PixIntentRepository = {
  claim(input: PixIntentRequest & { provider: string; fingerprint: string }): Promise<PixIntentClaim>;
  finish(input: {
    intentId: string;
    claimToken: string;
    status: 'request_accepted' | 'reconciliation_required' | 'failed';
    providerReference?: string;
    errorCategory?: string;
  }): Promise<boolean>;
};

type PaymentRpc = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown | null }>;
};

export type PixProviderEventInput = {
  provider: string;
  providerReference: string;
  eventId: string;
  requestFingerprint: string;
  claimToken: string;
  occurredAt: string;
  targetStatus: 'succeeded' | 'failed' | 'observed';
  providerStatus: string;
  amountCents: number;
  currency: string;
};
export type PixProviderEventResult = {
  decision: 'APPLIED' | 'OBSERVED' | 'ALREADY_TERMINAL' | 'TERMINAL_CONFLICT' | 'STALE'
    | 'NOT_FOUND' | 'EVENT_NOT_CLAIMED' | 'AMOUNT_OR_CURRENCY_MISMATCH' | 'NOT_READY';
  intentId: string | null;
  workspaceId: string | null;
  quoteId: string | null;
  intentStatus: string | null;
};

/** Applies a provider event only after the webhook event itself was durably claimed. */
export async function applyPixIntentProviderEvent(db: PaymentRpc, input: PixProviderEventInput): Promise<PixProviderEventResult> {
  if (!input.provider.trim() || input.provider.length > 80 || !input.providerReference.trim() || input.providerReference.length > 240
    || !input.eventId.trim() || input.eventId.length > 240 || !/^[a-f0-9]{64}$/.test(input.requestFingerprint)
    || !/^[0-9a-f-]{36}$/i.test(input.claimToken)
    || !Number.isFinite(Date.parse(input.occurredAt)) || !Number.isSafeInteger(input.amountCents) || input.amountCents <= 0
    || !/^[A-Z]{3}$/.test(input.currency) || !input.providerStatus.trim() || input.providerStatus.length > 120) {
    throw new Error('VALIDATION_FAILED');
  }
  const { data, error } = await db.rpc('orkto_apply_payment_intent_provider_event', {
    p_provider: input.provider, p_provider_reference: input.providerReference, p_provider_event_id: input.eventId,
    p_request_fingerprint: input.requestFingerprint, p_claim_token: input.claimToken, p_occurred_at: input.occurredAt,
    p_target_status: input.targetStatus, p_provider_status: input.providerStatus,
    p_amount_cents: input.amountCents, p_currency: input.currency,
  });
  if (error) throw new Error('PERSISTENCE_UNAVAILABLE');
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  const decisions = new Set<PixProviderEventResult['decision']>([
    'APPLIED', 'OBSERVED', 'ALREADY_TERMINAL', 'TERMINAL_CONFLICT', 'STALE', 'NOT_FOUND',
    'EVENT_NOT_CLAIMED', 'AMOUNT_OR_CURRENCY_MISMATCH', 'NOT_READY',
  ]);
  if (!row || typeof row.decision !== 'string' || !decisions.has(row.decision as PixProviderEventResult['decision'])) {
    throw new Error('PERSISTENCE_UNAVAILABLE');
  }
  return {
    decision: row.decision as PixProviderEventResult['decision'],
    intentId: typeof row.intent_id === 'string' ? row.intent_id : null,
    workspaceId: typeof row.workspace_id === 'string' ? row.workspace_id : null,
    quoteId: typeof row.quote_id === 'string' ? row.quote_id : null,
    intentStatus: typeof row.intent_status === 'string' ? row.intent_status : null,
  };
}

/** Server-only adapter for migration 18's claim/fencing RPCs. */
export function createPixIntentRepository(db: PaymentRpc): PixIntentRepository {
  return {
    async claim(input) {
      const { data, error } = await db.rpc('orkto_claim_payment_intent', {
        p_workspace_id: input.workspaceId, p_quote_id: input.quoteId, p_provider: input.provider,
        p_idempotency_key: input.idempotencyKey, p_request_fingerprint: input.fingerprint,
        p_amount_cents: input.amountCents, p_currency: input.currency,
      });
      if (error) throw new Error('PERSISTENCE_UNAVAILABLE');
      const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
      if (!row || typeof row.decision !== 'string' || typeof row.intent_id !== 'string') throw new Error('PERSISTENCE_UNAVAILABLE');
      return {
        decision: row.decision as ClaimDecision, intentId: row.intent_id,
        claimToken: typeof row.claim_token === 'string' ? row.claim_token : null,
        providerReference: typeof row.provider_reference === 'string' ? row.provider_reference : null,
      };
    },
    async finish(input) {
      const { data, error } = await db.rpc('orkto_finish_payment_intent', {
        p_intent_id: input.intentId, p_claim_token: input.claimToken, p_target_status: input.status,
        p_provider_reference: input.providerReference || null, p_provider_status: null,
        p_error_category: input.errorCategory || null,
      });
      if (error) throw new Error('PERSISTENCE_UNAVAILABLE');
      return data === true;
    },
  };
}

export type PixProviderAdapter = {
  readonly provider: string;
  /** Must make duplicate create requests safe at the provider. No adapter means no charge. */
  create(input: PixIntentRequest): Promise<{ reference: string }>;
  /** Must return null only for a confirmed miss; unknown outcomes must throw. */
  findByIdempotencyKey(input: PixIntentRequest): Promise<{ reference: string } | null>;
};

export type PixIntentResult =
  | { status: 'REQUEST_ACCEPTED'; intentId: string; providerReference: string; replay: boolean }
  | { status: 'IN_PROGRESS' | 'RECONCILIATION_REQUIRED'; intentId: string }
  | { status: 'IDEMPOTENCY_CONFLICT' | 'TERMINAL' | 'CONFIGURATION_REQUIRED' | 'PERSISTENCE_UNAVAILABLE'; intentId?: string };

function validRequest(input: PixIntentRequest): boolean {
  return /^[0-9a-f-]{36}$/i.test(input.workspaceId) && /^[0-9a-f-]{36}$/i.test(input.quoteId)
    && Number.isSafeInteger(input.amountCents) && input.amountCents > 0
    && input.currency === 'BRL' && input.idempotencyKey.trim().length >= 8 && input.idempotencyKey.length <= 200;
}

/** No network call occurs until a durable, quote-scoped claim has been acquired. */
export async function preparePixIntent(
  request: PixIntentRequest,
  repository: PixIntentRepository,
  adapter?: PixProviderAdapter,
): Promise<PixIntentResult> {
  if (!validRequest(request)) throw new Error('VALIDATION_FAILED');
  if (!adapter) return { status: 'CONFIGURATION_REQUIRED' };
  const fingerprint = createHash('sha256').update(JSON.stringify({
    workspaceId: request.workspaceId, quoteId: request.quoteId,
    amountCents: request.amountCents, currency: request.currency,
  })).digest('hex');
  const claim = await repository.claim({ ...request, provider: adapter.provider, fingerprint });
  const intentId = claim.intentId;
  if (claim.decision === 'IDEMPOTENCY_CONFLICT' || claim.decision === 'TERMINAL') return { status: claim.decision, intentId };
  if (claim.decision === 'IN_PROGRESS') return { status: 'IN_PROGRESS', intentId };
  if (claim.decision === 'RECONCILIATION_REQUIRED') return { status: 'RECONCILIATION_REQUIRED', intentId };
  if (claim.decision === 'REQUEST_ACCEPTED' || claim.decision === 'REPLAY_SUCCEEDED') {
    return claim.providerReference
      ? { status: 'REQUEST_ACCEPTED', intentId, providerReference: claim.providerReference, replay: true }
      : { status: 'RECONCILIATION_REQUIRED', intentId };
  }
  if (claim.decision !== 'RESERVED' || !claim.claimToken) return { status: 'PERSISTENCE_UNAVAILABLE', intentId };

  let reference: string | null = null;
  try {
    reference = (await adapter.create(request)).reference;
    if (!reference?.trim()) throw new Error('PROVIDER_REFERENCE_MISSING');
  } catch {
    try {
      reference = (await adapter.findByIdempotencyKey(request))?.reference || null;
    } catch {
      // A timeout or uncertain lookup cannot safely be retried as a new charge.
    }
  }
  if (!reference) {
    const finished = await repository.finish({ intentId, claimToken: claim.claimToken,
      status: 'reconciliation_required', errorCategory: 'provider_outcome_unknown' });
    return finished ? { status: 'RECONCILIATION_REQUIRED', intentId } : { status: 'PERSISTENCE_UNAVAILABLE', intentId };
  }
  const finished = await repository.finish({ intentId, claimToken: claim.claimToken,
    status: 'request_accepted', providerReference: reference });
  return finished
    ? { status: 'REQUEST_ACCEPTED', intentId, providerReference: reference, replay: false }
    : { status: 'PERSISTENCE_UNAVAILABLE', intentId };
}
