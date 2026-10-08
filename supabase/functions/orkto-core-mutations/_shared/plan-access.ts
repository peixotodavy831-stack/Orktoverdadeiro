export const ORKTO_PLAN_KEYS = [
  'starter', 'pro', 'business', 'scale', 'enterprise', 'founders', 'legacy_standard',
] as const;

export type OrktoPlanKey = typeof ORKTO_PLAN_KEYS[number];
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'configuration_required';

export interface PlanEntitlements {
  features?: Record<string, boolean>;
  limits?: Record<string, number | null>;
}

export interface PlanAccessState {
  planKey: OrktoPlanKey | null;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  readOnly: boolean;
  configurationRequired: boolean;
  entitlements: PlanEntitlements;
  effectivePriceVersion: number | null;
  publicPriceCents: number | null;
  publicPriceApproved: boolean;
}

export function normalizePlanKey(value: unknown): OrktoPlanKey | null {
  if (value === 'free') return 'legacy_standard';
  return typeof value === 'string' && (ORKTO_PLAN_KEYS as readonly string[]).includes(value)
    ? value as OrktoPlanKey
    : null;
}

export function resolvePlanAccess(input: {
  planKey: unknown;
  status: unknown;
  trialEndsAt?: string | null;
  entitlements?: unknown;
  effectivePriceVersion?: number | null;
  priceCents?: number | null;
  priceIsPublic?: boolean;
  now?: number;
}): PlanAccessState {
  const planKey = normalizePlanKey(input.planKey);
  const allowedStatuses: SubscriptionStatus[] = ['trial', 'active', 'past_due', 'suspended', 'cancelled'];
  const status = allowedStatuses.includes(input.status as SubscriptionStatus)
    ? input.status as SubscriptionStatus
    : 'configuration_required';
  const trialEndMs = input.trialEndsAt ? Date.parse(input.trialEndsAt) : Number.NaN;
  const trialActive = status === 'trial' && Number.isFinite(trialEndMs) && trialEndMs > (input.now ?? Date.now());
  const configurationRequired = !planKey || status === 'configuration_required' || input.effectivePriceVersion == null;
  const entitlements = input.entitlements && typeof input.entitlements === 'object'
    ? input.entitlements as PlanEntitlements
    : {};
  const readOnly = configurationRequired || (status === 'trial' ? !trialActive : status !== 'active');
  const publicPriceApproved = input.priceIsPublic === true && input.priceCents !== null && input.priceCents !== undefined;
  return {
    planKey,
    status,
    trialEndsAt: input.trialEndsAt || null,
    readOnly,
    configurationRequired,
    entitlements,
    effectivePriceVersion: input.effectivePriceVersion ?? null,
    publicPriceCents: publicPriceApproved ? input.priceCents! : null,
    publicPriceApproved,
  };
}

export function hasPlanFeature(state: PlanAccessState, feature: string): boolean {
  return !state.configurationRequired && state.entitlements.features?.[feature] === true;
}

export type PlanLimitCheck = { allowed: true; remaining: number | null } | { allowed: false; remaining: 0; reason: 'configuration_required' | 'limit_reached' };

/** A null limit is an explicit unlimited policy; an absent/non-numeric limit fails closed. */
export function checkPlanLimit(entitlements: PlanEntitlements, key: string, current: number, requested = 1): PlanLimitCheck {
  const limit = entitlements.limits?.[key];
  if (limit === undefined || (limit !== null && (!Number.isFinite(limit) || limit < 0))) {
    return { allowed: false, remaining: 0, reason: 'configuration_required' };
  }
  if (!Number.isFinite(current) || current < 0 || !Number.isFinite(requested) || requested <= 0) {
    return { allowed: false, remaining: 0, reason: 'configuration_required' };
  }
  if (limit === null) return { allowed: true, remaining: null };
  const remaining = Math.max(0, limit - current);
  return current + requested <= limit
    ? { allowed: true, remaining: limit - current - requested }
    : { allowed: false, remaining: 0, reason: 'limit_reached' };
}

/** Loads the effective versioned subscription policy through the server-side database client. */
export async function loadWorkspacePlanAccess(db: any, workspaceId: string, now = new Date()) {
  const [workspaceResult, subscriptionResult] = await Promise.all([
    db.from('orkto_workspaces').select('plan_key,subscription_status').eq('id', workspaceId).maybeSingle(),
    db.from('orkto_workspace_subscriptions').select('plan_key,status,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (workspaceResult.error) throw workspaceResult.error;
  if (subscriptionResult.error) throw subscriptionResult.error;
  const subscription = subscriptionResult.data;
  const planKey = normalizePlanKey(subscription?.plan_key || workspaceResult.data?.plan_key);
  let version: any = null;
  if (planKey) {
    const versionResult = await db.from('orkto_plan_price_versions')
      .select('version,price_cents,price_is_public,entitlements')
      .eq('plan_key', planKey).eq('status', 'approved').lte('effective_from', now.toISOString())
      .or(`effective_until.is.null,effective_until.gt.${now.toISOString()}`)
      .order('effective_from', { ascending: false }).limit(1).maybeSingle();
    if (versionResult.error) throw versionResult.error;
    version = versionResult.data;
  }
  const access = resolvePlanAccess({
    planKey,
    status: subscription?.status || workspaceResult.data?.subscription_status,
    trialEndsAt: subscription?.trial_ends_at,
    entitlements: version?.entitlements,
    effectivePriceVersion: version?.version,
    priceCents: version?.price_cents,
    priceIsPublic: version?.price_is_public,
    now: now.getTime(),
  });
  return { ...access, subscription: subscription || null, workspace: workspaceResult.data || null };
}
