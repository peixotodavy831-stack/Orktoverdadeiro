import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const numericId=z.string().regex(/^\d{5,30}$/);
const unixTime=z.string().regex(/^\d{1,12}$/);
const messageSchema=z.object({id:z.string().min(1).max(300),from:numericId,timestamp:unixTime,type:z.string().max(40),text:z.object({body:z.string().max(65536)}).optional()});
const statusSchema=z.object({id:z.string().min(1).max(300),status:z.enum(['sent','delivered','read','failed']),timestamp:unixTime,recipient_id:numericId});
const envelopeSchema=z.object({object:z.literal('whatsapp_business_account'),entry:z.array(z.object({id:numericId,changes:z.array(z.object({field:z.string().max(80),value:z.object({metadata:z.object({phone_number_id:numericId}),messages:z.array(messageSchema).max(100).optional(),statuses:z.array(statusSchema).max(100).optional()})})).max(100)})).max(100)});

export class MetaWebhookError extends Error {
  constructor(readonly category:'signature_invalid'|'payload_invalid'|'connection_unresolved') {super(category);this.name='MetaWebhookError';}
}
export interface MetaConnection { workspaceId:string; connectionId:string; wabaId:string; phoneNumberId:string }
export type MetaNormalizedEvent = {workspaceId:string;connectionId:string;phoneNumberId:string;externalMessageId:string;occurredAt:string}&(
  {kind:'message';from:string;messageType:string;text:string|null}|
  {kind:'status';status:'sent'|'delivered'|'read'|'failed';recipient:string}
);

/** Verify the exact HTTP body bytes, before parsing. Never stringify req.body. */
export function verifyMetaSignature(body:Buffer,signature:string|undefined,appSecret:string):boolean {
  if(!appSecret||body.length>1_048_576||!/^sha256=[a-f0-9]{64}$/.test(signature||''))return false;
  const expected=createHmac('sha256',appSecret).update(body).digest();
  return timingSafeEqual(expected,Buffer.from(signature!.slice(7),'hex'));
}

/** Pure normalization boundary. Resolver must use a trusted, unique connection
 * repository; the payload cannot choose a workspace. No persistence/send here. */
export async function parseVerifiedMetaWebhook(body:Buffer,signature:string|undefined,appSecret:string,
  resolveConnection:(phoneNumberId:string)=>Promise<MetaConnection|null>):Promise<MetaNormalizedEvent[]> {
  if(!verifyMetaSignature(body,signature,appSecret))throw new MetaWebhookError('signature_invalid');
  let parsed:ReturnType<typeof envelopeSchema.parse>;
  try { parsed=envelopeSchema.parse(JSON.parse(body.toString('utf8'))); }
  catch { throw new MetaWebhookError('payload_invalid'); }
  const result:MetaNormalizedEvent[]=[];
  const bindings=new Map<string,MetaConnection>();
  const ids=new Set<string>();
  for(const entry of parsed.entry)for(const change of entry.changes){
    if(change.field!=='messages')continue;
    const phone=change.value.metadata.phone_number_id;
    let connection=bindings.get(phone);
    if(!connection){connection=await resolveConnection(phone)||undefined;if(connection)bindings.set(phone,connection);}
    if(!connection||!z.string().uuid().safeParse(connection.workspaceId).success||!z.string().uuid().safeParse(connection.connectionId).success||connection.phoneNumberId!==phone||connection.wabaId!==entry.id)throw new MetaWebhookError('connection_unresolved');
    const base={workspaceId:connection.workspaceId,connectionId:connection.connectionId,phoneNumberId:phone};
    const timestamp=(value:string)=>{const time=Number(value)*1000;if(!Number.isFinite(time)||time<0||time>8.64e15)throw new MetaWebhookError('payload_invalid');return new Date(time).toISOString();};
    for(const message of change.value.messages||[]){
      if(message.type==='text'&&!message.text)throw new MetaWebhookError('payload_invalid');
      const key=`${phone}:message:${message.id}`;if(ids.has(key))continue;ids.add(key);
      result.push({...base,kind:'message',externalMessageId:message.id,from:message.from,messageType:message.type,text:message.type==='text'?message.text!.body:null,occurredAt:timestamp(message.timestamp)});
    }
    for(const status of change.value.statuses||[]){
      const key=`${phone}:status:${status.id}:${status.status}:${status.timestamp}`;if(ids.has(key))continue;ids.add(key);
      result.push({...base,kind:'status',externalMessageId:status.id,status:status.status,recipient:status.recipient_id,occurredAt:timestamp(status.timestamp)});
    }
  }
  return result;
}
