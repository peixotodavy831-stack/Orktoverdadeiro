import type { SubscriptionProcessor } from './asaas-sandbox.ts';
import {reconcileSandboxSubscription} from './billing-lifecycle.ts';

/** Re-read authoritative provider payment and match all server-owned bindings before the atomic RPC. */
export async function reconcileSandboxPayment(db:any,processor:SubscriptionProcessor,paymentId:string,eventKey:string) {
  const payment=await processor.payment(paymentId);
  const {data:binding,error}=await db.from('orkto_billing_bindings').select('id,workspace_id,provider_subscription_id,customer_ref')
    .eq('provider','asaas').eq('environment','sandbox').eq('provider_subscription_id',payment.subscriptionId).maybeSingle();
  if(error||!binding||binding.customer_ref!==payment.customerRef)throw new Error('BILLING_BINDING_MISMATCH');
  const subscription=await processor.read(payment.subscriptionId);
  if(subscription.bindingId!==`orkto-sub:${binding.id}`||subscription.customerRef!==binding.customer_ref
    ||subscription.valueCents!==payment.valueCents)throw new Error('BILLING_PROVIDER_MISMATCH');
  const financial={CONFIRMED:'confirmed',RECEIVED:'confirmed',OVERDUE:'overdue',REFUNDED:'refunded',PENDING:'pending',DELETED:'cancelled'}[payment.status];
  if(!financial)throw new Error('BILLING_RECONCILIATION_REQUIRED');
  await reconcileSandboxSubscription(db,processor,payment.subscriptionId,`obs:${eventKey}`);
  const start=new Date(`${payment.dueDate}T00:00:00.000Z`);
  if(!Number.isFinite(start.getTime())||start.toISOString().slice(0,10)!==payment.dueDate)throw new Error('BILLING_INVALID_PERIOD');
  const end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1,1);
  end.setUTCDate(Math.min(start.getUTCDate(),new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate()));
  const result=await db.rpc('orkto_reconcile_subscription',{p_binding_id:binding.id,p_event_key:eventKey,
    p_provider_subscription_id:payment.subscriptionId,p_amount_cents:payment.valueCents,p_currency:'BRL',p_financial_status:financial,
    p_period_start:start.toISOString(),p_period_end:end.toISOString(),p_observed_at:new Date().toISOString()});
  if(result.error||!['APPLIED','REPLAY','STALE','RECORDED_POLICY_REQUIRED'].includes(result.data))throw new Error('BILLING_RECONCILIATION_FAILED');
  return result.data as string;
}
