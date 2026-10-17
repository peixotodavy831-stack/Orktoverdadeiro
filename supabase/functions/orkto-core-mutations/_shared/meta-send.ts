const NUMERIC_ID=/^\d{5,30}$/;
const GRAPH_VERSION=/^v\d{1,2}\.\d{1,2}$/;

export type MetaSendFailure='authentication'|'invalid_request'|'rate_limit'|'provider_transient'|'outcome_unknown';
export class MetaSendError extends Error{
  constructor(readonly category:MetaSendFailure,readonly retryAfterMs?:number){super(category);this.name='MetaSendError'}
}

export async function sendMetaText(input:{
  phoneNumberId:string;recipient:string;content:string;accessToken:string;graphVersion:string;
},send:typeof fetch=fetch){
  if(!NUMERIC_ID.test(input.phoneNumberId)||!NUMERIC_ID.test(input.recipient)||!input.content.trim()
    ||input.content.length>4000||!input.accessToken||input.accessToken.length>8192
    ||!GRAPH_VERSION.test(input.graphVersion))throw new MetaSendError('invalid_request');
  let response:Response;
  try{
    response=await send(`https://graph.facebook.com/${input.graphVersion}/${input.phoneNumberId}/messages`,{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(12_000),
      headers:{authorization:`Bearer ${input.accessToken}`,'content-type':'application/json'},
      body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:input.recipient,
        type:'text',text:{preview_url:false,body:input.content.trim()}}),
    });
  }catch{throw new MetaSendError('outcome_unknown')}
  let body:unknown;try{body=await response.json()}catch{body=null}
  if(!response.ok){
    const retryAfter=Number(response.headers.get('retry-after')||'');
    const retryAfterMs=Number.isFinite(retryAfter)&&retryAfter>=0?Math.min(retryAfter*1000,3_600_000):undefined;
    if(response.status===401||response.status===403)throw new MetaSendError('authentication');
    if(response.status===429)throw new MetaSendError('rate_limit',retryAfterMs);
    if(response.status>=500)throw new MetaSendError('provider_transient',retryAfterMs);
    throw new MetaSendError('invalid_request');
  }
  const record=body as {messages?:Array<{id?:unknown}>}|null;
  const externalMessageId=record?.messages?.[0]?.id;
  if(typeof externalMessageId!=='string'||externalMessageId.length<1||externalMessageId.length>400)
    throw new MetaSendError('outcome_unknown');
  return{externalMessageId,acceptedAt:new Date().toISOString()};
}
