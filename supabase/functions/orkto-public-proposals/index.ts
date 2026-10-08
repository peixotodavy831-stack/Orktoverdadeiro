import { createClient } from '@supabase/supabase-js';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 2048;
const buckets = new Map<string,{ started:number; count:number }>();

function allowedOrigin(origin: string | null): string | undefined | false {
  if (!origin) return undefined;
  const allowed=(Deno.env.get('ORKTO_ALLOWED_ORIGINS')||'').split(',').map(v=>v.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : false;
}

function json(status:number,code:string,requestId:string,data?:unknown,origin?:string) {
  const headers:Record<string,string>={'content-type':'application/json','cache-control':'no-store','x-request-id':requestId,'vary':'Origin'};
  if(origin) headers['access-control-allow-origin']=origin;
  return new Response(JSON.stringify({code,requestId,...(data===undefined?{}:{data})}),{status,headers});
}

async function sha256Hex(value:string) {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

function rateLimited(key:string) {
  const now=Date.now(); const prior=buckets.get(key);
  if(!prior||now-prior.started>=60_000){buckets.set(key,{started:now,count:1});return false;}
  prior.count+=1; return prior.count>30;
}

Deno.serve(async(req:Request)=>{
  const supplied=req.headers.get('x-request-id')||'';
  const requestId=UUID.test(supplied)?supplied:crypto.randomUUID();
  const origin=allowedOrigin(req.headers.get('origin'));
  if(origin===false) return json(403,'PERMISSION_DENIED',requestId);
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:{
    'access-control-allow-origin':origin||'','access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'content-type, x-request-id','vary':'Origin'}});
  if(req.method!=='POST') return json(405,'VALIDATION_FAILED',requestId,undefined,origin);
  const length=Number(req.headers.get('content-length')||'0');
  if(length>MAX_BODY_BYTES) return json(413,'VALIDATION_FAILED',requestId,undefined,origin);
  try{
    const raw=await req.text();
    if(new TextEncoder().encode(raw).length>MAX_BODY_BYTES) return json(413,'VALIDATION_FAILED',requestId,undefined,origin);
    let body:unknown; try{body=JSON.parse(raw);}catch{return json(400,'VALIDATION_FAILED',requestId,undefined,origin);}
    if(!body||typeof body!=='object'||Array.isArray(body)) return json(400,'VALIDATION_FAILED',requestId,undefined,origin);
    const value=body as Record<string,unknown>;
    if(Object.keys(value).some(key=>!['command','token','customerName','reason'].includes(key))
      ||!['READ','VIEW','ACCEPT','REJECT'].includes(String(value.command))
      ||typeof value.token!=='string'||!TOKEN.test(value.token)
      ||(value.customerName!==undefined&&(typeof value.customerName!=='string'||value.customerName.trim().length>180))
      ||(value.reason!==undefined&&(typeof value.reason!=='string'||value.reason.length>500))
      ||(value.command==='ACCEPT'&&(typeof value.customerName!=='string'||value.customerName.trim().length<1)))
      return json(400,'VALIDATION_FAILED',requestId,undefined,origin);
    const tokenHash=await sha256Hex(value.token);
    if(rateLimited(tokenHash.slice(0,24))) return json(429,'RATE_LIMITED',requestId,undefined,origin);
    const url=Deno.env.get('SUPABASE_URL')||''; const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
    if(!url||!serviceKey) return json(503,'INTERNAL_ERROR',requestId,undefined,origin);
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await admin.rpc('orkto_public_live_quote_command',{
      p_public_token_hash:tokenHash,p_command:value.command,p_customer_name:value.customerName||null,
      p_reason:value.reason||null,p_request_id:requestId,
    });
    if(error){
      const known:Record<string,[number,string]>={ORKTO_VALIDATION_FAILED:[400,'VALIDATION_FAILED']};
      const mapped=known[error.message]; return json(mapped?.[0]||503,mapped?.[1]||'INTERNAL_ERROR',requestId,undefined,origin);
    }
    const result=String(data?.result||'');
    if(result==='NOT_FOUND'||result==='EXPIRED') return json(404,result,requestId,undefined,origin);
    if(result==='STALE'||result==='CONFLICT') return json(409,result,requestId,undefined,origin);
    return json(200,'OK',requestId,data,origin);
  }catch{return json(503,'INTERNAL_ERROR',requestId,undefined,origin);}
});
