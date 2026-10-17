import test from 'node:test';
import assert from 'node:assert/strict';
import {asaasSandbox} from '../supabase/functions/orkto-core-mutations/_shared/asaas-sandbox.js';
import {changeSandboxSubscription,reconcileSandboxSubscription,SUBSCRIPTION_EVENTS} from '../supabase/functions/orkto-core-mutations/_shared/billing-lifecycle.js';

const env={APP_ENV:'staging',ASAAS_ENVIRONMENT:'sandbox',ORKTO_BILLING_SANDBOX_ENABLED:'ON',
 ORKTO_BILLING_SANDBOX_LIFECYCLE_ENABLED:'ON',ASAAS_API_KEY:'fixture-only',VITE_SUPABASE_URL:'https://ghrjongiodziasupakrk.supabase.co'};
test('native update uses PUT sandbox and never updates pending payments or commercial price',async()=>{
 const processor=asaasSandbox(env,(async(url,init)=>{
  assert.equal(String(url),'https://api-sandbox.asaas.com/v3/subscriptions/sub_test');assert.equal(init?.method,'PUT');
  assert.deepEqual(JSON.parse(String(init?.body)),{status:'INACTIVE',updatePendingPayments:false});
  return Response.json({id:'sub_test',status:'INACTIVE'});
 }) as typeof fetch);
 await processor.update('sub_test',{status:'INACTIVE'});
 await assert.rejects(processor.update('sub_test',{status:'ACTIVE'}));
 await assert.rejects(processor.update('sub_test',{status:'INACTIVE',value:1} as any));
});
test('cancel requires explicit lifecycle flag and confirmed DELETE receipt',async()=>{
 let calls=0;const send=(async(_url,init)=>{calls++;assert.equal(init?.method,'DELETE');return Response.json({id:'sub_test',deleted:true});}) as typeof fetch;
 await asaasSandbox(env,send).cancel('sub_test');assert.equal(calls,1);
 await assert.rejects(asaasSandbox({...env,ORKTO_BILLING_SANDBOX_LIFECYCLE_ENABLED:undefined},send).cancel('sub_test'));
 assert.equal(calls,1);
 await assert.rejects(asaasSandbox(env,(async()=>Response.json({id:'sub_test',deleted:false})) as typeof fetch).cancel('sub_test'));
});
test('unknown or deleted provider state is never fabricated from HTTP errors',async()=>{
 await assert.rejects(asaasSandbox(env,(async()=>new Response('',{status:404})) as typeof fetch).read('sub_test'));
 const row=await asaasSandbox(env,(async()=>Response.json({id:'sub_test',value:79.90,status:'ACTIVE',customer:'cus_test',externalReference:'orkto-sub:test',deleted:true})) as typeof fetch).read('sub_test');
 assert.equal(row.status,'DELETED');
});
function fixture() {
 const calls:any[]=[];let state='reserved';let reserved=false;
 const db={rpc:async(name:string,args:any)=>{
  calls.push({name,args});
  if(name==='orkto_reserve_subscription_command'){
   if(reserved)return {data:{execute:false,state}};
   reserved=true;return {data:{execute:true,id:'command1',providerId:'sub_test',customerRef:'cus_test',priceCents:7990}};
  }
  if(name==='orkto_observe_subscription')return {data:'RECORDED_POLICY_REQUIRED'};
  if(name==='orkto_finish_subscription_command'){state=args.p_state;return {data:true};}
  throw new Error('Unexpected RPC');
 }};
 const processor:any={read:async()=>({providerId:'sub_test',status:'ACTIVE',customerRef:'cus_test',bindingId:'orkto-sub:binding',valueCents:7990}),
 update:async()=>{calls.push('PUT');},cancel:async()=>{calls.push('DELETE');}};
 const input={workspaceId:'workspace',actorId:'owner',bindingId:'binding',key:'request-key',operation:'cancel' as const,changes:{}};
 return {db,processor,input,calls};
}
test('cancel is reserved before I/O, recorded and replayed without second DELETE',async()=>{
 const f=fixture();assert.equal(await changeSandboxSubscription(f.db,f.processor,f.input),'RECORDED_POLICY_REQUIRED');
 assert.equal(f.calls[0].name,'orkto_reserve_subscription_command');
 assert.equal(await changeSandboxSubscription(f.db,f.processor,f.input),'REPLAY');
 assert.equal(f.calls.filter(v=>v==='DELETE').length,1);
});
test('ambiguous provider outcome persists unknown and refuses automatic resend',async()=>{
 const f=fixture();let attempts=0;f.processor.cancel=async()=>{attempts++;throw new Error('timeout');};
 await assert.rejects(changeSandboxSubscription(f.db,f.processor,f.input));
 assert.equal(await changeSandboxSubscription(f.db,f.processor,f.input),'RECONCILIATION_REQUIRED');assert.equal(attempts,1);
 assert.ok(f.calls.some(v=>v.args?.p_state==='unknown'));
});
test('foreign or inconsistent binding denies mutation before contacting supplier',async()=>{
 const f=fixture();f.db.rpc=async()=>({error:{code:'42501'}} as any);
 await assert.rejects(changeSandboxSubscription(f.db,f.processor,f.input));assert.equal(f.calls.length,0);
});
test('native lifecycle records provider state but never grants entitlement',async()=>{
 assert.deepEqual([...SUBSCRIPTION_EVENTS],['SUBSCRIPTION_CREATED','SUBSCRIPTION_UPDATED','SUBSCRIPTION_INACTIVATED','SUBSCRIPTION_DELETED']);
 const f=fixture();await reconcileSandboxSubscription(f.db,f.processor,'sub_test','event-test');
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'orkto_observe_subscription');
 f.processor.read=async()=>({status:'UNRECOGNIZED'});
 await assert.rejects(reconcileSandboxSubscription(f.db,f.processor,'sub_test','event-test'));
});
test('update re-reads authoritative provider after PUT, persistence failure is unknown',async()=>{
 const f=fixture();let reads=0;f.processor.read=async()=>{reads++;return {status:'INACTIVE',customerRef:'cus_test',bindingId:'orkto-sub:binding',valueCents:7990};};
 await changeSandboxSubscription(f.db,f.processor,{...f.input,operation:'update',changes:{status:'INACTIVE'}});
 assert.equal(reads,2);assert.equal(f.calls.filter(v=>v==='PUT').length,1);
});
