import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {readMetaBody,metaMessageFingerprint} from './event-boundary.ts';

const numericId=z.string().regex(/^\d{5,30}$/);
const unixTime=z.string().regex(/^\d{1,12}$/);
const message=z.object({
  id:z.string().min(1).max(300),from:numericId,timestamp:unixTime,
  type:z.string().min(1).max(40),text:z.object({body:z.string().min(1).max(65536)}).optional(),
}).passthrough();
const status=z.object({
  id:z.string().min(1).max(300),status:z.enum(['sent','delivered','read','failed']),
  timestamp:unixTime,recipient_id:numericId,
}).passthrough();
const envelope=z.object({
  object:z.literal('whatsapp_business_account'),
  entry:z.array(z.object({id:numericId,changes:z.array(z.object({
    field:z.string().max(80),value:z.object({
      metadata:z.object({phone_number_id:numericId}).passthrough(),
      messages:z.array(message).max(100).optional(),statuses:z.array(status).max(100).optional(),
    }).passthrough(),
  }).strict()).max(100)}).strict()).max(100),
}).strict();

function plain(statusCode:number,body:string){return new Response(body,{status:statusCode,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})}
function json(statusCode:number,code:string,requestId:string){return new Response(JSON.stringify({code,requestId}),{status:statusCode,headers:{'content-type':'application/json','cache-control':'no-store','x-request-id':requestId}})}
async function hex(bytes:ArrayBuffer){return Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('')}
async function sha256(value:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}
async function signatureValid(raw:Uint8Array,supplied:string|null,secret:string){
  if(!secret||!/^sha256=[a-f0-9]{64}$/.test(supplied||''))return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const actual=await crypto.subtle.sign('HMAC',key,raw);
  const expected=new Uint8Array(32);for(let i=0;i<32;i++)expected[i]=Number.parseInt(supplied!.slice(7+i*2,9+i*2),16);
  const received=new Uint8Array(actual);let diff=0;for(let i=0;i<received.length;i++)diff|=received[i]^expected[i];return diff===0;
}
function occurredAt(value:string){const ms=Number(value)*1000;if(!Number.isFinite(ms)||ms<0||ms>8.64e15)throw new Error('invalid_timestamp');return new Date(ms).toISOString()}

Deno.serve(async(req:Request)=>{
  const requestId=crypto.randomUUID();
  const verifyToken=Deno.env.get('META_WEBHOOK_VERIFY_TOKEN')||'';
  if(req.method==='GET'){
    const url=new URL(req.url);const mode=url.searchParams.get('hub.mode');const token=url.searchParams.get('hub.verify_token');const challenge=url.searchParams.get('hub.challenge');
    if(mode!=='subscribe'||!verifyToken||token!==verifyToken||!challenge||challenge.length>500)return plain(403,'Forbidden');
    return plain(200,challenge);
  }
  if(req.method!=='POST')return json(405,'METHOD_NOT_ALLOWED',requestId);
  const appSecret=Deno.env.get('META_APP_SECRET')||'';
  const length=Number(req.headers.get('content-length')||'0');if(length>1_048_576)return json(413,'PAYLOAD_TOO_LARGE',requestId);
  let raw:Uint8Array|null;try{raw=await readMetaBody(req.body);}catch{return json(400,'PAYLOAD_INVALID',requestId);}
  if(!raw)return json(413,'PAYLOAD_TOO_LARGE',requestId);
  if(!await signatureValid(raw,req.headers.get('x-hub-signature-256'),appSecret))return json(401,'SIGNATURE_INVALID',requestId);
  let payload:z.infer<typeof envelope>;
  try{payload=envelope.parse(JSON.parse(new TextDecoder().decode(raw)))}catch{return json(400,'PAYLOAD_INVALID',requestId)}
  const url=Deno.env.get('SUPABASE_URL')||'';const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if(!url||!serviceKey)return json(503,'CONFIGURATION_REQUIRED',requestId);
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  let retryRequired=false;
  for(const entry of payload.entry)for(const change of entry.changes){
    if(change.field!=='messages')continue;
    const phoneNumberId=change.value.metadata.phone_number_id;
    for(const item of change.value.messages||[]){
      const eventId=`message:${item.id}`;const at=occurredAt(item.timestamp);
      const fingerprint=await metaMessageFingerprint({eventId,phoneNumberId,wabaId:entry.id,from:item.from,type:item.type,at,
        text:item.type==='text'?item.text?.body??null:null});
      const {data:claimed,error:claimError}=await admin.rpc('orkto_claim_meta_webhook_event',{
        p_phone_number_id:phoneNumberId,p_waba_id:entry.id,p_provider_event_id:eventId,
        p_payload_fingerprint:fingerprint,p_event_kind:'message',p_occurred_at:at,
      });
      const claim=Array.isArray(claimed)?claimed[0]:claimed;
      if(claimError){retryRequired=true;continue}
       if(claim?.decision==='DUPLICATE'||claim?.decision==='IN_PROGRESS')continue;
       if(claim?.decision!=='CLAIMED'||typeof claim.connection_id!=='string'||typeof claim.claim_token!=='string')continue;
      if(item.type!=='text'||!item.text){
         await admin.rpc('orkto_finish_meta_webhook_event',{p_provider_event_id:eventId,p_claim_token:claim.claim_token,p_status:'ignored',p_failure_category:null});continue;
      }
      const {data:stored,error:storeError}=await admin.rpc('orkto_ingest_meta_text_message',{
         p_connection_id:claim.connection_id,p_provider_event_id:eventId,p_claim_token:claim.claim_token,p_external_message_id:item.id,
        p_sender_phone:item.from,p_text:item.text.body,p_occurred_at:at,
      });
      if(storeError||!stored){
         retryRequired=true;await admin.rpc('orkto_finish_meta_webhook_event',{p_provider_event_id:eventId,p_claim_token:claim.claim_token,p_status:'failed',p_failure_category:'persistence_error'});
      }
    }
    for(const item of change.value.statuses||[]){
      const eventId=`status:${item.id}:${item.status}:${item.timestamp}`;const at=occurredAt(item.timestamp);
      const fingerprint=await sha256(JSON.stringify({eventId,phoneNumberId,wabaId:entry.id,recipient:item.recipient_id,at}));
      const {data:claimed,error:claimError}=await admin.rpc('orkto_claim_meta_webhook_event',{
        p_phone_number_id:phoneNumberId,p_waba_id:entry.id,p_provider_event_id:eventId,
        p_payload_fingerprint:fingerprint,p_event_kind:'status',p_occurred_at:at,
      });
      const claim=Array.isArray(claimed)?claimed[0]:claimed;
      if(claimError){retryRequired=true;continue}
       if(claim?.decision==='DUPLICATE'||claim?.decision==='IN_PROGRESS')continue;
       if(claim?.decision!=='CLAIMED'||typeof claim.workspace_id!=='string'||typeof claim.claim_token!=='string')continue;
      const {data:send,error:lookupError}=await admin.from('orkto_channel_send_requests').select('id')
        .eq('workspace_id',claim.workspace_id).eq('provider','meta_whatsapp_cloud').eq('provider_message_id',item.id).maybeSingle();
      if(lookupError){retryRequired=true;continue}
       if(!send?.id){await admin.rpc('orkto_finish_meta_webhook_event',{p_provider_event_id:eventId,p_claim_token:claim.claim_token,p_status:'ignored',p_failure_category:null});continue}
      const mapped=item.status==='sent'?'PROVIDER_ACKNOWLEDGED':item.status==='failed'?'FAILED':'DELIVERED';
      const {error:receiptError}=await admin.rpc('orkto_record_channel_delivery_event',{
        p_workspace_id:claim.workspace_id,p_send_request_id:send.id,p_provider:'meta_whatsapp_cloud',
        p_provider_event_id:eventId,p_payload_fingerprint:fingerprint,p_provider_message_id:item.id,
        p_status:mapped,p_failure_category:item.status==='failed'?'provider_transient':null,p_occurred_at:at,
      });
       if(receiptError){retryRequired=true;await admin.rpc('orkto_finish_meta_webhook_event',{p_provider_event_id:eventId,p_claim_token:claim.claim_token,p_status:'failed',p_failure_category:'delivery_persistence_error'});continue}
       await admin.rpc('orkto_finish_meta_webhook_event',{p_provider_event_id:eventId,p_claim_token:claim.claim_token,p_status:'processed',p_failure_category:null});
    }
  }
  return retryRequired?json(503,'RETRY_REQUIRED',requestId):json(200,'ACCEPTED',requestId);
});
