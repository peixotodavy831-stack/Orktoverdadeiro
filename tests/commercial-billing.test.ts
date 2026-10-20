import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMERCIAL_PLANS,commercialPlan,validateCommercialPrice } from '../supabase/functions/orkto-core-mutations/_shared/commercial-catalog.js';
import { canConsumePulso,estimateModelCost } from '../supabase/functions/orkto-core-mutations/_shared/cost-governor.js';
import { reconcileSubscription,canCreateCheckout,type VerifiedSubscriptionObservation } from '../backend/billing/subscription-policy.js';
import { asaasSandbox } from '../backend/billing/asaas-sandbox.js';
import {reserveTarget,cashForecast13Weeks} from '../backend/finance/economic-controls.js';

const now=Date.parse('2026-10-16T12:00:00Z');
const event:VerifiedSubscriptionObservation={workspaceId:'workspace-a',providerSubscriptionId:'sub_test',planKey:'pro',priceVersion:2,
 priceCents:14990,currency:'BRL',periodStart:'2026-10-01T00:00:00Z',periodEnd:'2026-11-01T00:00:00Z',observedAt:'2026-10-16T11:00:00Z',
 financial:'confirmed',cancelAtPeriodEnd:false,source:'provider_reconciliation'};
test('exactly five approved plans and four exact prices',()=>{
 assert.deepEqual(COMMERCIAL_PLANS.map(p=>[p.name,p.priceCents]),[['Start',7990],['Pro',14990],['Business',29990],['Scale',59990],['Enterprise',null]]);
});
test('Enterprise is proposal-only and cannot receive automatic fixed-price activation',()=>{
 assert.equal(commercialPlan('enterprise')?.priceCents,null);
 assert.throws(()=>reconcileSubscription(null,{...event,planKey:'enterprise',priceCents:149990},now));
});
test('legacy and invented plans are not new commercial offers',()=>{
 for(const key of ['founders','legacy_standard','professional','enterprise_plus','free'])assert.equal(commercialPlan(key),null);
});
test('version and approved price integrity reject client prices',()=>{
 assert.equal(validateCommercialPrice('pro',14990,2),true);
 for(const [price,version]of[[1,2],[14990,1],[14990,3]])assert.equal(validateCommercialPrice('pro',price,version),false);
});
test('browser callback cannot activate subscription',()=>{
 assert.throws(()=>reconcileSubscription(null,{...event,source:'browser_return'} as any,now));
});
test('verified paid reconciliation activates only matched commercial terms',()=>{
 assert.equal(reconcileSubscription(null,event,now).commercial,'active');
 assert.throws(()=>reconcileSubscription(null,{...event,currency:'USD'},now));
});
test('duplicate and stale observations cannot replay side effects or regress access',()=>{
 const current=reconcileSubscription(null,event,now);
 assert.equal(reconcileSubscription(current,event,now),current);
 assert.equal(reconcileSubscription(current,{...event,financial:'overdue',observedAt:'2026-10-15T00:00:00Z'},now),current);
});
test('renewal advances period from a newer reconciled observation',()=>{
 const current=reconcileSubscription(null,event,now);
 const renewed=reconcileSubscription(current,{...event,periodStart:'2026-11-01T00:00:00Z',periodEnd:'2026-12-01T00:00:00Z',observedAt:'2026-11-01T00:00:00Z'},Date.parse('2026-11-01T12:00:00Z'));
 assert.equal(renewed.commercial,'active');assert.equal(renewed.periodEnd,'2026-12-01T00:00:00Z');
});
test('overdue state does not represent an active paid entitlement',()=>{
 assert.equal(reconcileSubscription(null,{...event,financial:'overdue'},now).commercial,'past_due');
});
test('cancellation and refund revoke commercial activation',()=>{
 for(const financial of ['cancelled','refunded'] as const)assert.equal(reconcileSubscription(null,{...event,financial},now).commercial,'cancelled');
});
test('cancellation at period end keeps confirmed paid period',()=>{
 const next=reconcileSubscription(null,{...event,cancelAtPeriodEnd:true},now);
 assert.equal(next.commercial,'active');assert.equal(next.cancelAtPeriodEnd,true);
});
test('expired paid period does not grant ongoing access',()=>{
 assert.equal(reconcileSubscription(null,event,Date.parse('2026-12-01T00:00:00Z')).commercial,'expired');
});
test('plan changes require exact newly approved price version',()=>{
 assert.equal(reconcileSubscription(null,{...event,planKey:'business',priceCents:29990},now).planKey,'business');
 assert.throws(()=>reconcileSubscription(null,{...event,planKey:'business'},now));
});
test('cross-company or provider-subscription mismatches are rejected',()=>{
 const current=reconcileSubscription(null,event,now);
 assert.throws(()=>reconcileSubscription(current,{...event,workspaceId:'workspace-b'},now));
 assert.throws(()=>reconcileSubscription(current,{...event,providerSubscriptionId:'sub_other'},now));
});
test('checkout is disabled by default and never accepts production',()=>{
 assert.equal(canCreateCheckout({}),false);
 assert.equal(canCreateCheckout({APP_ENV:'production',ORKTO_BILLING_SANDBOX_ENABLED:'ON'}),false);
 assert.throws(()=>asaasSandbox({}));
});
test('sandbox adapter returns pending and a provider failure never activates a plan',async()=>{
 const env={APP_ENV:'staging',ASAAS_ENVIRONMENT:'sandbox',ORKTO_BILLING_SANDBOX_ENABLED:'ON',VITE_SUPABASE_URL:'https://ghrjongiodziasupakrk.supabase.co',ASAAS_API_KEY:'synthetic-sandbox-key'};
 const input={customerRef:'cus_test',bindingId:'orkto-sub:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',planKey:'pro',priceVersion:2,priceCents:14990,nextDueDate:'2026-11-01'};
 const processor=asaasSandbox(env,(async(url,init)=>{assert.match(String(url),/^https:\/\/api-sandbox.asaas.com\/v3\/subscriptions$/);assert.equal(JSON.parse(String(init?.body)).value,149.9);return Response.json({id:'sub_test'});}) as typeof fetch);
 assert.deepEqual(await processor.create(input),{providerId:'sub_test',state:'pending'});
 const failed=asaasSandbox(env,(async()=>new Response('',{status:500})) as typeof fetch);
 await assert.rejects(failed.create(input),/BILLING_PROVIDER_REJECTED/);
});
test('Pulso is fixed-point, absent approval or allowance fails closed',()=>{
 assert.equal(canConsumePulso({approved:false,allowanceMilli:1000,usedMilli:0,reservedMilli:0,requestedMilli:250}).allowed,false);
 assert.equal(canConsumePulso({approved:true,allowanceMilli:null,usedMilli:0,reservedMilli:0,requestedMilli:250}).allowed,false);
 assert.equal(canConsumePulso({approved:true,allowanceMilli:1000,usedMilli:250,reservedMilli:500,requestedMilli:250}).allowed,true);
});
test('reserved or consumed Pulso cannot exceed approved allowance',()=>{
 assert.equal(canConsumePulso({approved:true,allowanceMilli:1000,usedMilli:750,reservedMilli:250,requestedMilli:250}).allowed,false);
});
test('model costs use matching versioned tariff and distinguish unknown from zero',()=>{
 const usage={provider:'other',model:'model-a',input:1000000,cached:100000,output:100000};
 assert.equal(estimateModelCost(null,usage,now),null);
 const tariff={version:1,provider:'other',model:'model-a',inputMicrousdPerMillion:1000000,cachedMicrousdPerMillion:100000,outputMicrousdPerMillion:2000000,effectiveFrom:'2026-10-01',effectiveUntil:null};
 assert.deepEqual(estimateModelCost(tariff,usage,now),{microusd:1110000,tariffVersion:1,basis:'estimated'});
 assert.equal(estimateModelCost({...tariff,model:'foreign'},usage,now),null);
});
test('40 percent reserve allocations are subdivisions and never available cash',()=>{
 const reserve=reserveTarget({receivedCents:100000,availableCashCents:25000,constitutedCents:null});
 assert.equal(reserve.targetCents,40000);assert.equal(reserve.shortfallCents,15000);assert.equal(reserve.constitutedCents,null);
 assert.equal(reserve.allocations.reduce((sum,item)=>sum+item.percent,0),40);
});
test('13-week cash projection excludes actual entries and labels forecast',()=>{
 const result=cashForecast13Weeks(1000,[{occurred_on:'2026-10-17',transaction_type:'expense',amount_cents:500,cash_status:'forecast'},
 {occurred_on:'2026-10-17',transaction_type:'expense',amount_cents:900,cash_status:'paid'}],new Date(now));
 assert.equal(result.length,13);assert.equal(result[0].closingCents,500);assert.equal(result[0].basis,'forecast');
});
