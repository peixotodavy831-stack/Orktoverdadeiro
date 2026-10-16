import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';

declare global {var Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Response|Promise<Response>):void};}
const values:Record<string,string|undefined>={};let handler:(request:Request)=>Response|Promise<Response>;
const originalFetch=globalThis.fetch;let outbound=0;
const token='synthetic-webhook-token-32-characters-only';
before(async()=>{
 globalThis.Deno={env:{get:name=>values[name]},serve:callback=>{handler=callback;}};
 globalThis.fetch=(async()=>{outbound++;throw new Error('External calls forbidden in fixture');}) as typeof fetch;
 await import('../supabase/functions/orkto-billing-webhook/index.ts');
});
after(()=>{globalThis.fetch=originalFetch;});
const request=(body:string,received=token)=>new Request('https://fixture.invalid/billing',{method:'POST',headers:{'asaas-access-token':received},body});
test('billing webhook fails closed without dedicated secret before provider or database access',async()=>{
 assert.equal((await handler(request('{}'))).status,503);assert.equal(outbound,0);
});
test('billing webhook rejects wrong dedicated token before any persistence',async()=>{
 values.ASAAS_WEBHOOK_SECRET=token;
 assert.equal((await handler(request('{}','invalid'))).status,401);assert.equal(outbound,0);
});
test('valid token cannot enable missing sandbox configuration',async()=>{
 assert.equal((await handler(request('{}'))).status,503);assert.equal(outbound,0);
});
test('sandbox webhook rejects malformed or oversized events before creating a database client',async()=>{
 Object.assign(values,{APP_ENV:'staging',ASAAS_ENVIRONMENT:'sandbox',ORKTO_BILLING_SANDBOX_ENABLED:'ON',
  ASAAS_API_KEY:'fixture-sandbox-key',SUPABASE_URL:'https://ghrjongiodziasupakrk.supabase.co'});
 assert.equal((await handler(request('{'))).status,400);
 assert.equal((await handler(request('null'))).status,400);
 assert.equal((await handler(request('[]'))).status,400);
 assert.equal((await handler(request('x'.repeat(33000)))).status,413);
 assert.equal(outbound,0);
});
test('sandbox webhook cannot run against production even with a correct token',async()=>{
 values.APP_ENV='production';
 assert.equal((await handler(request('{}'))).status,503);assert.equal(outbound,0);
});

test('native subscription event re-reads provider and completes durable claim; duplicates skip I/O',async()=>{
 Object.assign(values,{APP_ENV:'staging',SUPABASE_SERVICE_ROLE_KEY:'fixture-service-key'});
 let duplicate=false;const calls:string[]=[];
 globalThis.fetch=(async(input)=>{
  const url=String(input);calls.push(url);
  if(url.endsWith('/orkto_claim_payment_webhook_event'))return Response.json({decision:duplicate?'DUPLICATE':'CLAIMED',claim_token:'fixture-claim'});
  if(url.endsWith('/subscriptions/sub_test'))return Response.json({id:'sub_test',status:'INACTIVE',value:79.9,customer:'cus_test',externalReference:'orkto-sub:fixture'});
  if(url.endsWith('/orkto_observe_subscription'))return Response.json('RECORDED_POLICY_REQUIRED');
  if(url.endsWith('/orkto_finish_payment_webhook_event'))return Response.json(true);
  throw new Error('Unexpected request');
 }) as typeof fetch;
 const event=JSON.stringify({id:'evt_native_fixture',event:'SUBSCRIPTION_INACTIVATED',subscription:{id:'sub_test',status:'ACTIVE'}});
 const first=await handler(request(event));assert.equal(first.status,200);assert.equal((await first.json()).state,'RECORDED_POLICY_REQUIRED');
 assert.equal(calls.filter(url=>url.includes('api-sandbox')).length,1);
 duplicate=true;const second=await handler(request(event));assert.equal((await second.json()).state,'REPLAY');
 assert.equal(calls.filter(url=>url.includes('api-sandbox')).length,1);
});

test('native deletion 404 stays retryable and never assumes entitlement termination',async()=>{
 const calls:string[]=[];
 globalThis.fetch=(async(input,init)=>{
  const url=String(input);calls.push(url);
  if(url.endsWith('/orkto_claim_payment_webhook_event'))return Response.json({decision:'CLAIMED',claim_token:'fixture-claim'});
  if(url.includes('api-sandbox'))return new Response('',{status:404});
  if(url.endsWith('/orkto_finish_payment_webhook_event')){
   assert.equal(JSON.parse(String(init?.body)).p_target_status,'failed');return Response.json(true);
  }
  throw new Error('Unexpected request');
 }) as typeof fetch;
 const result=await handler(request(JSON.stringify({id:'evt_deleted_fixture',event:'SUBSCRIPTION_DELETED',subscription:{id:'sub_test'}})));
 assert.equal(result.status,503);assert.ok(!calls.some(url=>url.endsWith('/orkto_observe_subscription')));
});
