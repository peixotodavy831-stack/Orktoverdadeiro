/** Stream bound applies even when the sender omits or lies about Content-Length. */
export async function readMetaBody(body:ReadableStream<Uint8Array>|null):Promise<Uint8Array|null>{
 if(!body)return new Uint8Array();
 const reader=body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
   if(size>1_048_576){await reader.cancel();return null;}chunks.push(value);}
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}

/** Bind durable idempotency to normalized message content as well as its ID.
 * The DB receives only a digest, never raw text as a fingerprint. */
export async function metaMessageFingerprint(input:{eventId:string;phoneNumberId:string;wabaId:string;
 from:string;type:string;at:string;text:string|null}){
 const canonical=JSON.stringify({eventId:input.eventId,phoneNumberId:input.phoneNumberId,wabaId:input.wabaId,
  from:input.from,type:input.type,at:input.at,text:input.text});
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

/** The delivery ledger returns a decision even when its RPC transport succeeds.
 * Conflicts must remain failed audit entries, never confirmed delivery. */
export function metaReceiptOutcome(decision:unknown):{
 status:'processed'|'ignored'|'failed';failureCategory:string|null;retry:boolean;
}{
 if(decision==='APPLIED'||decision==='DUPLICATE')return{status:'processed',failureCategory:null,retry:false};
 if(decision==='STALE_IGNORED'||decision==='NOT_FOUND')return{status:'ignored',failureCategory:null,retry:false};
 if(decision==='EVENT_CONFLICT'||decision==='PROVIDER_REFERENCE_CONFLICT')return{status:'failed',failureCategory:'delivery_ledger_conflict',retry:false};
 return{status:'failed',failureCategory:'delivery_decision_unrecognized',retry:true};
}

/** RPC HTTP success is not proof that the inbound message was committed. */
export function metaIngestConfirmed(value:unknown):boolean {
 const row=Array.isArray(value)?(value.length===1?value[0]:null):value;
 if(!row||typeof row!=='object')return false;
 const result=row as Record<string,unknown>;
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 return (result.decision==='APPLIED'||result.decision==='DUPLICATE')
   &&typeof result.message_id==='string'&&uuid.test(result.message_id)
   &&(result.decision==='DUPLICATE'||typeof result.conversation_id==='string'&&uuid.test(result.conversation_id));
}

/** Provider receipts must belong to the persisted conversation recipient. */
export function metaRecipientMatches(received:unknown,phone:unknown):boolean {
 if(typeof received!=='string'||typeof phone!=='string'||!/^\d{5,30}$/.test(received))return false;
 return received===phone.replace(/\D/g,'');
}
