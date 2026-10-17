import test from 'node:test';
import assert from 'node:assert/strict';
import {assessSandboxNotifications as assess,preflightAsaasSandbox} from '../readiness/asaas-sandbox-readonly-preflight.mjs';

const disabled={id:'not_fixture',enabled:false};
const row={id:'not_fixture',enabled:true,emailEnabledForProvider:false,smsEnabledForProvider:false,
 emailEnabledForCustomer:false,smsEnabledForCustomer:false,phoneCallEnabledForCustomer:false,whatsappEnabledForCustomer:false};
test('empty, incomplete or ambiguous snapshots never prove notification safety',()=>{
 for(const input of [null,{},[],{data:[]},{hasMore:false,data:[]},{hasMore:true,data:[disabled]},
  {hasMore:false,data:[{id:'not_fixture'}]},{hasMore:false,data:[{id:'not_fixture',enabled:true}]}])assert.equal(assess(input).status,'BLOCKED_EXTERNAL');
});
test('globally disabled rows or all explicitly disabled channels are safe observations',()=>{
 for(const record of [disabled,{...disabled,whatsappEnabledForCustomer:true},row])
  assert.equal(assess({hasMore:false,data:[record]}).status,'PASS');
});
test('each enabled channel fails and unknown enabled channels require schema review',()=>{
 for(const key of Object.keys(row).filter(k=>k!=='enabled'&&k!=='id'))
  assert.equal(assess({hasMore:false,data:[{...row,[key]:true}]}).status,'FAIL');
 assert.equal(assess({hasMore:false,data:[{...row,pushEnabledForCustomer:true}]}).status,'BLOCKED_EXTERNAL');
});
function fixture(){
 const calls=[];const key='fixture-sandbox-secret';
 const options={env:{APP_ENV:'staging',ASAAS_ENVIRONMENT:'sandbox',SUPABASE_URL:'https://ghrjongiodziasupakrk.supabase.co',ASAAS_API_KEY:key},
  approvedCustomer:{id:'cus_fixture',exclusivelySynthetic:true,ownerApproved:true},executionMode:'FIXTURE',
  fetchImpl:async(url,init)=>{calls.push({url,init});return Response.json(url.endsWith('/notifications')
   ?{hasMore:false,data:[{...disabled,customer:'cus_fixture'}]}:{id:'cus_fixture',name:'Private fixture data never reported'});}};
 return {options,calls,key};
}
test('missing configuration, approval or production target blocks all network access',async()=>{
 for(const mutate of [f=>{f.options.env.APP_ENV='production';},f=>{f.options.env.ASAAS_ENVIRONMENT='production';},
  f=>{f.options.env.SUPABASE_URL='https://wrong.supabase.co';},f=>{delete f.options.env.ASAAS_API_KEY;},
  f=>{f.options.approvedCustomer.ownerApproved=false;},f=>{f.options.approvedCustomer.id='../escape';}]){
  const f=fixture();mutate(f);assert.equal((await preflightAsaasSandbox(f.options)).status,'BLOCKED_EXTERNAL');assert.equal(f.calls.length,0);
 }
});
test('real-mode cannot be certified using an injected fixture transport',async()=>{
 const f=fixture();f.options.executionMode='STAGING';assert.equal((await preflightAsaasSandbox(f.options)).status,'BLOCKED_EXTERNAL');assert.equal(f.calls.length,0);
});
test('GET-only sandbox preflight never enables flags, changes notifications or returns credentials/customer data',async()=>{
 const f=fixture();const r=await preflightAsaasSandbox(f.options);assert.equal(r.status,'PASS');assert.equal(f.calls.length,2);
 for(const {url,init} of f.calls){assert.ok(url.startsWith('https://api-sandbox.asaas.com/v3/customers/cus_fixture'));
  assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.redirect,'manual');}
 const output=JSON.stringify(r);for(const value of [f.key,'cus_fixture','Private fixture'])assert.ok(!output.includes(value));
 assert.equal(r.executionMode,'FIXTURE');assert.equal(r.readyForProductionCandidate,'NO');
});
test('foreign customer, unavailable provider, redirects and oversized data fail closed without raw error output',async()=>{
 for(const send of [async()=>Response.json({id:'cus_foreign'}),async()=>new Response(null,{status:302}),
  async()=>new Response('x'.repeat(70_000)),async()=>{throw new Error('private secret credentials');}]){
  const f=fixture();f.options.fetchImpl=send;const r=await preflightAsaasSandbox(f.options);
  assert.equal(r.status,'BLOCKED_EXTERNAL');assert.ok(!JSON.stringify(r).includes('private'));
 }
});
test('foreign customer notification snapshot is not approved',async()=>{
 const f=fixture();f.options.fetchImpl=async url=>Response.json(url.endsWith('/notifications')
  ?{hasMore:false,data:[{...disabled,customer:'cus_foreign'}]}:{id:'cus_fixture'});
 assert.equal((await preflightAsaasSandbox(f.options)).reason,'CUSTOMER_NOTIFICATION_MISMATCH');
});
