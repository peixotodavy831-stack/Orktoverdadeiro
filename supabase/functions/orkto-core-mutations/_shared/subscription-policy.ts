import { validateCommercialPrice } from './commercial-catalog.ts';

export type FinancialState='pending'|'confirmed'|'overdue'|'refunded'|'cancelled';
export type CommercialState='pending'|'active'|'past_due'|'cancelled'|'expired';
export interface SubscriptionSnapshot {
  workspaceId:string; providerSubscriptionId:string; planKey:string; priceVersion:number;
  priceCents:number; periodStart:string; periodEnd:string; lastObservedAt:string;
  financial:FinancialState; commercial:CommercialState; cancelAtPeriodEnd:boolean;
}
export interface VerifiedSubscriptionObservation {
  workspaceId:string; providerSubscriptionId:string; planKey:string; priceVersion:number;
  priceCents:number; currency:string; periodStart:string; periodEnd:string; observedAt:string;
  financial:FinancialState; cancelAtPeriodEnd:boolean; source:'provider_reconciliation';
}
/** Browser callbacks and webhook prose are not proof of paid entitlement. */
export function reconcileSubscription(current:SubscriptionSnapshot|null,event:VerifiedSubscriptionObservation,now=Date.now()):SubscriptionSnapshot {
  if(event.source!=='provider_reconciliation'||!validateCommercialPrice(event.planKey,event.priceCents,event.priceVersion)
    ||event.currency!=='BRL'||!event.workspaceId||!event.providerSubscriptionId
    ||!['pending','confirmed','overdue','refunded','cancelled'].includes(event.financial))throw new Error('BILLING_RECONCILIATION_REQUIRED');
  const start=Date.parse(event.periodStart),end=Date.parse(event.periodEnd),observed=Date.parse(event.observedAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||!Number.isFinite(observed)||observed>now+60_000)throw new Error('BILLING_INVALID_PERIOD');
  if(current&&(current.workspaceId!==event.workspaceId||current.providerSubscriptionId!==event.providerSubscriptionId))throw new Error('BILLING_TENANT_MISMATCH');
  if(current&&observed<=Date.parse(current.lastObservedAt))return current;
  const commercial:CommercialState=end<=now?'expired':event.financial==='confirmed'?'active':event.financial==='overdue'?'past_due':event.financial==='pending'?'pending':'cancelled';
  return {workspaceId:event.workspaceId,providerSubscriptionId:event.providerSubscriptionId,planKey:event.planKey,
    priceVersion:event.priceVersion,priceCents:event.priceCents,periodStart:event.periodStart,periodEnd:event.periodEnd,
    lastObservedAt:event.observedAt,financial:event.financial,commercial,cancelAtPeriodEnd:event.cancelAtPeriodEnd};
}
export function canCreateCheckout(env:Record<string,string|undefined>) {
  return env.APP_ENV==='staging'&&env.ASAAS_ENVIRONMENT==='sandbox'&&env.ORKTO_BILLING_SANDBOX_ENABLED==='ON'
    &&env.VITE_SUPABASE_URL==='https://ghrjongiodziasupakrk.supabase.co';
}
