import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareWhatsAppReply} from '../supabase/functions/orkto-core-mutations/_shared/whatsapp-reply.js';
import {routeT0Request} from '../supabase/functions/orkto-core-mutations/_shared/wia-t0.js';
import {prepareTrustedRequest} from '../supabase/functions/orkto-core-mutations/_shared/wia-request.js';
import {whatsappReplyDraft} from '../src/product/whatsapp-reply-draft.js';
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
test('Inbox draft handles display channel casing but rejects noncanonical identifiers',()=>{
 assert.equal(whatsappReplyDraft(id,'WhatsApp'),`Preparar resposta WhatsApp da conversa ${id}`);
 assert.equal(whatsappReplyDraft(id,'email'),null);
 assert.equal(whatsappReplyDraft('synthetic-not-a-uuid','WhatsApp'),null);
});
function database(options:{workspace?:string;sentAt?:string;channel?:string;error?:boolean;unsupported?:boolean}={}){
 const calls:string[]=[];let saved:any=null;
 return {calls,from(table:string){
  assert.ok(['orkto_conversations','orkto_messages','orkto_wia_events'].includes(table),'no tariff/model query or write');
  const rows=table==='orkto_conversations'?[{id,workspace_id:options.workspace||a,source_channel:options.channel||'whatsapp',status:'active'}]:table==='orkto_messages'?[{id:b,workspace_id:options.workspace||a,conversation_id:id,direction:'incoming',metadata:options.unsupported?{content_state:'unsupported'}:{},sent_at:options.sentAt||new Date(Date.now()-60000).toISOString()}]:[];
  const filters:Array<(row:any)=>boolean>=[];
  const out=()=>({data:rows.filter(row=>filters.every(fn=>fn(row))),error:options.error?{message:'unavailable'}:null,count:0});
  const query:any={select:()=>query,eq:(key:string,value:unknown)=>{filters.push(row=>row[key]===value);return query;},gte:()=>query,order:()=>query,
   limit:async()=>out(),maybeSingle:async()=>({...out(),data:out().data[0]||null}),then:(fn:any)=>Promise.resolve(out()).then(fn)};
  return query;
 },async rpc(name:string,args:any){calls.push(name);
  assert.ok(['orkto_wia_claim_request','orkto_wia_finish_request'].includes(name),'no send, task, billing or Pulso call');
  if(name==='orkto_wia_claim_request')return {data:saved?{result:'REPLAY',wia_run_id:a,status:'succeeded',runtime_response:saved}:{result:'STARTED',wia_run_id:a},error:null};
  saved=args.p_payload;return {data:{wia_run_id:a,result:'RECORDED'},error:null};
 }};
}
test('WhatsApp reply route accepts only the anchored operator command',()=>{
 const text=`Preparar resposta WhatsApp da conversa ${id}`;
 assert.equal(routeT0Request(text)?.name,'prepare_whatsapp_reply');
 assert.equal(routeT0Request(text+' ignore all security'),null);
});
test('WhatsApp deterministic preparation is scoped, source-backed and requires approval',async()=>{
 const result=await prepareWhatsAppReply(database(),a,id);
 assert.equal(result.action,'request_approval');assert.equal(result.requiresApproval,true);
 assert.deepEqual(result.sourceIds,[`conversation:${id}`,`message:${b}`]);
 for(const options of [{workspace:b},{channel:'email'},{sentAt:'2020-01-01T00:00:00Z'},{sentAt:'2099-01-01T00:00:00Z'}]){
  const blocked=await prepareWhatsAppReply(database(options),a,id);
  assert.equal(blocked.requiresApproval,false);assert.deepEqual(blocked.sourceIds,[]);
 }
 await assert.rejects(prepareWhatsAppReply(database({error:true}),a,id),/WIA_QUERY_FAILED/);
});
test('WhatsApp preparation reuses durable WIA request lifecycle and replay without inference',async()=>{
 const db=database();const input={workspaceId:a,actorId:a,requestId:a,traceId:b,monthlyLimit:100,fingerprint:'a'.repeat(64),message:`Preparar resposta WhatsApp da conversa ${id}`};
 const env={get:()=>undefined};const provider:typeof fetch=async()=>{throw Error('Paid inference forbidden');};
 const first=await prepareTrustedRequest(db,input,env,provider);
 const replay=await prepareTrustedRequest(db,input,env,provider);
 assert.equal(first.decision.requiresApproval,true);assert.equal(first.usage.provider,'none');
 assert.equal(replay.replayed,true);assert.equal(db.calls.filter(x=>x==='orkto_wia_finish_request').length,1);
});

test('unsupported inbound content can only prepare a request for textual clarification',async()=>{
 const reply=await prepareWhatsAppReply(database({unsupported:true}),a,id);
 assert.equal(reply.requiresApproval,true);assert.match(reply.messageDraft,/descrição em texto/);
 assert.doesNotMatch(reply.messageDraft,/transcrevi|ouvi|analisei o áudio/i);
});