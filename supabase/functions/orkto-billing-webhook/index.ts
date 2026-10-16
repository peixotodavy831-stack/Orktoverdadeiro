import {createClient} from '@supabase/supabase-js';
import {asaasSandbox} from '../orkto-core-mutations/_shared/asaas-sandbox.ts';
import {reconcileSandboxPayment} from '../orkto-core-mutations/_shared/billing-reconciliation.ts';

const reply=(status:number,state:string)=>new Response(JSON.stringify({state}),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
// verify_jwt=false is intentional for a provider webhook. The dedicated token is checked before any persistence.
Deno.serve(async req=>{
  if(req.method!=='POST')return reply(405,'METHOD_NOT_ALLOWED');
  const expected=Deno.env.get('ASAAS_WEBHOOK_SECRET')||'';
  const received=req.headers.get('asaas-access-token')||'';
  if(expected.length<32)return reply(503,'CONFIGURATION_REQUIRED');
  const a=new TextEncoder().encode(received),b=new TextEncoder().encode(expected);let mismatch=a.length^b.length;
  for(let i=0;i<b.length;i++)mismatch|=(a[i]||0)^b[i];
  if(mismatch)return reply(401,'UNAUTHORIZED');
  const env=Object.fromEntries(['APP_ENV','ASAAS_ENVIRONMENT','ORKTO_BILLING_SANDBOX_ENABLED','ASAAS_API_KEY'].map(key=>[key,Deno.env.get(key)]));
  env.VITE_SUPABASE_URL=Deno.env.get('SUPABASE_URL');
  let processor;try{processor=asaasSandbox(env);}catch{return reply(503,'CONFIGURATION_REQUIRED');}
  if(Number(req.headers.get('content-length')||0)>32768)return reply(413,'INVALID_EVENT');
  const raw=await req.text();if(new TextEncoder().encode(raw).length>32768)return reply(413,'INVALID_EVENT');
  let event;try{event=JSON.parse(raw);}catch{return reply(400,'INVALID_EVENT');}
  if(typeof event.id!=='string'||!/^[a-zA-Z0-9_-]{8,200}$/.test(event.id)||typeof event.event!=='string'
    ||!/^PAYMENT_[A-Z_]{1,80}$/.test(event.event)||typeof event.payment?.id!=='string')return reply(400,'INVALID_EVENT');
  const fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(v=>v.toString(16).padStart(2,'0')).join('');
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!key)return reply(503,'CONFIGURATION_REQUIRED');
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const claimed=await db.rpc('orkto_claim_payment_webhook_event',{p_provider:'asaas',p_provider_event_id:event.id,
    p_event_type:event.event,p_request_fingerprint:fingerprint,p_occurred_at:null});
  const claim=Array.isArray(claimed.data)?claimed.data[0]:claimed.data;
  if(claimed.error)return reply(503,'PERSISTENCE_UNAVAILABLE');
  if(claim?.decision==='DUPLICATE')return reply(200,'REPLAY');
  if(!['CLAIMED','RETRY'].includes(claim?.decision))return reply(409,'RECONCILIATION_REQUIRED');
  try{
    const result=await reconcileSandboxPayment(db,processor,event.payment.id,event.id);
    const done=await db.rpc('orkto_finish_payment_webhook_event',{p_provider:'asaas',p_provider_event_id:event.id,
      p_request_fingerprint:fingerprint,p_claim_token:claim.claim_token,p_target_status:'processed',p_error_category:null});
    if(done.error||done.data!==true)throw new Error('CLAIM_LOST');
    return reply(200,result);
  }catch{
    await db.rpc('orkto_finish_payment_webhook_event',{p_provider:'asaas',p_provider_event_id:event.id,
      p_request_fingerprint:fingerprint,p_claim_token:claim.claim_token,p_target_status:'failed',p_error_category:'reconciliation_required'});
    return reply(503,'RECONCILIATION_REQUIRED');
  }
});
