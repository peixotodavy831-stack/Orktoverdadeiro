const NUMERIC_ID=/^\d{5,30}$/;
const GRAPH_VERSION=/^v\d{1,2}\.\d{1,2}$/;

export type MetaRuntimeConfig={appId:string;configId:string;graphVersion:string;redirectUri:string|null};
export class MetaConnectionError extends Error{
  constructor(readonly code:'CONFIGURATION_REQUIRED'|'PROVIDER_REJECTED'|'PROVIDER_UNAVAILABLE'|'PROVIDER_RESPONSE_INVALID'){super(code);this.name='MetaConnectionError'}
}

export function metaRuntimeConfig(env:{get(name:string):string|undefined}):MetaRuntimeConfig|null{
  const appId=(env.get('META_APP_ID')||'').trim();
  const appSecret=(env.get('META_APP_SECRET')||'').trim();
  const configId=(env.get('META_EMBEDDED_SIGNUP_CONFIG_ID')||'').trim();
  const graphVersion=(env.get('META_GRAPH_API_VERSION')||'').trim();
  const redirect=(env.get('META_EMBEDDED_SIGNUP_REDIRECT_URI')||'').trim();
  if(!NUMERIC_ID.test(appId)||!appSecret||appSecret.length>512||!NUMERIC_ID.test(configId)||!GRAPH_VERSION.test(graphVersion))return null;
  let redirectUri:string|null=null;
  if(redirect){try{const parsed=new URL(redirect);if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash) return null;redirectUri=parsed.href}catch{return null}}
  return{appId,configId,graphVersion,redirectUri};
}

async function providerJson(url:string,init:RequestInit,send:typeof fetch,timeout=12_000){
  let response:Response;
  try{response=await send(url,{...init,redirect:'error',signal:AbortSignal.timeout(timeout)})}
  catch{throw new MetaConnectionError('PROVIDER_UNAVAILABLE')}
  let body:unknown;try{body=await response.json()}catch{throw new MetaConnectionError('PROVIDER_RESPONSE_INVALID')}
  if(!response.ok)throw new MetaConnectionError(response.status>=500||response.status===429?'PROVIDER_UNAVAILABLE':'PROVIDER_REJECTED');
  if(!body||typeof body!=='object'||Array.isArray(body))throw new MetaConnectionError('PROVIDER_RESPONSE_INVALID');
  return body as Record<string,unknown>;
}

export async function completeMetaEmbeddedSignup(input:{
  code:string;businessId:string|null;wabaId:string;phoneNumberId:string;
  coexistenceState:'unknown'|'eligible'|'enabled'|'ineligible'|'not_requested';
},env:{get(name:string):string|undefined},send:typeof fetch=fetch){
  const config=metaRuntimeConfig(env);if(!config)throw new MetaConnectionError('CONFIGURATION_REQUIRED');
  if(!input.code||input.code.length>4096||!NUMERIC_ID.test(input.wabaId)||!NUMERIC_ID.test(input.phoneNumberId)
    ||input.businessId!==null&&!NUMERIC_ID.test(input.businessId))throw new MetaConnectionError('PROVIDER_RESPONSE_INVALID');
  const body=new URLSearchParams({client_id:config.appId,client_secret:(env.get('META_APP_SECRET')||'').trim(),code:input.code});
  if(config.redirectUri)body.set('redirect_uri',config.redirectUri);
  const tokenResult=await providerJson(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`,{
    method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:body.toString(),
  },send);
  const accessToken=typeof tokenResult.access_token==='string'?tokenResult.access_token.trim():'';
  if(!accessToken||accessToken.length>8192)throw new MetaConnectionError('PROVIDER_RESPONSE_INVALID');
  const permissionResult=await providerJson(`https://graph.facebook.com/${config.graphVersion}/me/permissions`,{
    method:'GET',headers:{authorization:`Bearer ${accessToken}`},
  },send);
  if(!Array.isArray(permissionResult.data))throw new MetaConnectionError('PROVIDER_RESPONSE_INVALID');
  const grantedScopes=permissionResult.data.flatMap(entry=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry))return[];
    const row=entry as Record<string,unknown>;
    return typeof row.permission==='string'&&row.status==='granted'?[row.permission]:[];
  });
  const requiredScopes=['whatsapp_business_management','whatsapp_business_messaging'];
  if(requiredScopes.some(scope=>!grantedScopes.includes(scope)))throw new MetaConnectionError('PROVIDER_REJECTED');
  const phone=await providerJson(`https://graph.facebook.com/${config.graphVersion}/${input.phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`,{
    method:'GET',headers:{authorization:`Bearer ${accessToken}`},
  },send);
  if(phone.id!==input.phoneNumberId||typeof phone.display_phone_number!=='string'||typeof phone.verified_name!=='string')
    throw new MetaConnectionError('PROVIDER_RESPONSE_INVALID');
  await providerJson(`https://graph.facebook.com/${config.graphVersion}/${input.wabaId}/subscribed_apps`,{
    method:'POST',headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:'{}',
  },send);
  return{
    accessToken,businessId:input.businessId,wabaId:input.wabaId,phoneNumberId:input.phoneNumberId,
    displayPhoneNumber:phone.display_phone_number.slice(0,80),verifiedName:phone.verified_name.slice(0,180),
    coexistenceState:input.coexistenceState,grantedScopes:grantedScopes.slice(0,32),
    metadata:{qualityRating:typeof phone.quality_rating==='string'?phone.quality_rating.slice(0,40):null,graphVersion:config.graphVersion},
  };
}
