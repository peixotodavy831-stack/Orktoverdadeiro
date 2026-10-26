import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';

const secret='synthetic-meta-app-secret';
const workspace='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const conversation='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const message='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let handler:(request:Request)=>Response|Promise<Response>;
const originalFetch=globalThis.fetch,originalDeno=globalThis.Deno;
let claim='CLAIMED',ingest:unknown=[{decision:'APPLIED',conversation_id:conversation,message_id:message}];
let recipient='5511999990000',finishFails=false,finishFalse=false;
const calls:Array<{path:string;body:any}>=[];
before(async()=>{
 globalThis.Deno={env:{get:name=>({META_APP_SECRET:secret,META_WEBHOOK_VERIFY_TOKEN:'synthetic-verify',
  SUPABASE_URL:'https://fixture-supabase.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key'}[name])},serve:fn=>{handler=fn;}};
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.origin,'https://fixture-supabase.invalid','No live HTTP permitted');
  const path=url.pathname,body=init?.body?JSON.parse(String(init.body)):null;calls.push({path,body});
  if(path.endsWith('/orkto_claim_meta_webhook_event'))return Response.json([{decision:claim,workspace_id:workspace,connection_id:workspace,claim_token:workspace}]);
  if(path.endsWith('/orkto_ingest_meta_text_message'))return Response.json(ingest);
  if(path.endsWith('/orkto_finish_meta_webhook_event'))return finishFails?Response.json({message:'fixture unavailable'},{status:503}):Response.json(!finishFalse);
  if(path.endsWith('/orkto_record_channel_delivery_event'))return Response.json('APPLIED');
  if(path.endsWith('/orkto_channel_send_requests'))return Response.json({id:message,conversation_id:conversation});
  if(path.endsWith('/orkto_conversations')){assert.equal(url.searchParams.get('workspace_id'),`eq.${workspace}`);return Response.json({contact_phone:recipient});}
  throw new Error('Unexpected fixture request');
 };
 await import('../supabase/functions/orkto-meta-webhook/index.ts');
});
after(()=>{globalThis.fetch=originalFetch;globalThis.Deno=originalDeno;});
function reset(){claim='CLAIMED';ingest=[{decision:'APPLIED',conversation_id:conversation,message_id:message}];recipient='5511999990000';finishFails=false;finishFalse=false;calls.length=0;}
function request(kind:'message'|'status'|'image'='message',valid=true){
 const value={metadata:{phone_number_id:'123456789'},...(kind==='status'?{statuses:[{id:'wamid.synthetic',status:'delivered',timestamp:'1793000000',recipient_id:'5511999990000'}]}:
  {messages:[{id:'wamid.synthetic',from:'5511999990000',timestamp:'1793000000',type:kind==='image'?'image':'text',text:{body:'Synthetic inbound evidence'}}]})};
 const body=JSON.stringify({object:'whatsapp_business_account',entry:[{id:'987654321',changes:[{field:'messages',value}]}]});
 return new Request('https://fixture.invalid/webhook',{method:'POST',body,headers:{'x-hub-signature-256':valid?'sha256='+createHmac('sha256',secret).update(body).digest('hex'):'invalid'}});
}
test('official handler rejects unsigned input before database access',async()=>{reset();assert.equal((await handler(request('message',false))).status,401);assert.equal(calls.length,0);});
test('official handler acknowledges only persisted ingest decisions',async()=>{
 reset();assert.equal((await handler(request())).status,200);
 for(const invalid of [[],null,[{decision:'CONNECTION_NOT_FOUND'}],[{decision:'APPLIED'}]]){
  reset();ingest=invalid;assert.equal((await handler(request())).status,503);
  assert.equal(calls.at(-1)?.body.p_status,'failed');
 }
});
test('in-progress claims request retry rather than acknowledging unfinished work',async()=>{
 for(const kind of ['message','status'] as const){reset();claim='IN_PROGRESS';assert.equal((await handler(request(kind))).status,503);assert.equal(calls.length,1);}
 reset();claim='DUPLICATE';assert.equal((await handler(request())).status,200);assert.equal(calls.length,1);
});
test('receipt recipient mismatch cannot update another conversation delivery',async()=>{
 reset();recipient='5511888880000';assert.equal((await handler(request('status'))).status,200);
 assert.equal(calls.some(call=>call.path.endsWith('/orkto_record_channel_delivery_event')),false);
 assert.equal(calls.at(-1)?.body.p_failure_category,'recipient_mismatch');
 reset();assert.equal((await handler(request('status'))).status,200);
 assert.equal(calls.some(call=>call.path.endsWith('/orkto_record_channel_delivery_event')),true);
});
test('failure to finish unsupported media claim remains retryable, never false ACK',async()=>{
 reset();finishFails=true;assert.equal((await handler(request('image'))).status,503);
 assert.equal(calls.some(call=>call.path.endsWith('/orkto_ingest_meta_text_message')),false);
 reset();finishFalse=true;assert.equal((await handler(request('image'))).status,503);
 reset();finishFalse=true;assert.equal((await handler(request('status'))).status,503);
});
