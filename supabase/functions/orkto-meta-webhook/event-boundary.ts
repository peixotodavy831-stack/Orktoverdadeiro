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
