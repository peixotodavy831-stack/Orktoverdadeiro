import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileSandboxPayment} from '../supabase/functions/orkto-core-mutations/_shared/billing-reconciliation.js';

const binding={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',workspace_id:'company-a',customer_ref:'cus_a',provider_subscription_id:'sub_a'};
function fixture(overrides:Record<string,unknown>={}) {
 const calls:any[]=[];
 const processor:any={payment:async()=>({id:'pay_a',subscriptionId:'sub_a',customerRef:'cus_a',valueCents:7990,status:'CONFIRMED',dueDate:'2026-01-31',...overrides}),
 read:async()=>({providerId:'sub_a',customerRef:'cus_a',valueCents:7990,bindingId:`orkto-sub:${binding.id}`,status:'ACTIVE'})};
 const query:any={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:binding,error:null})};
 const db={from:()=>query,rpc:async(name:string,args:any)=>{if(name==='orkto_observe_subscription')return {data:'RECORDED',error:null};calls.push({name,args});return {data:'APPLIED',error:null};}};
 return {db,processor,calls};
}
test('provider re-read must match workspace customer, subscription, price and reference',async()=>{
 const f=fixture();assert.equal(await reconcileSandboxPayment(f.db,f.processor,'pay_a','evt_test'),'APPLIED');
 assert.equal(f.calls[0].args.p_period_end,'2026-02-28T00:00:00.000Z');
 assert.equal(f.calls[0].args.p_financial_status,'confirmed');
 assert.equal(f.calls[0].args.p_binding_id,binding.id);
});
test('foreign customer and wrong amount never reach entitlement mutation',async()=>{
 for(const override of [{customerRef:'cus_b'},{valueCents:1}]){
  const f=fixture(override);await assert.rejects(reconcileSandboxPayment(f.db,f.processor,'pay_a','evt_test'));assert.equal(f.calls.length,0);
 }
});
test('pending payment remains pending even when the subscription object is ACTIVE',async()=>{
 const f=fixture({status:'PENDING'});await reconcileSandboxPayment(f.db,f.processor,'pay_a','evt_test');
 assert.equal(f.calls[0].args.p_financial_status,'pending');
});
test('provider outage leaves no fabricated activation or automatic second charge',async()=>{
 const f=fixture();f.processor.payment=async()=>{throw new Error('provider_unavailable');};
 await assert.rejects(reconcileSandboxPayment(f.db,f.processor,'pay_a','evt_test'));assert.equal(f.calls.length,0);
});
