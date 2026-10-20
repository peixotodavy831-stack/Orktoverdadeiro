import assert from 'node:assert/strict';
import test from 'node:test';
import {completeMetaEmbeddedSignup,MetaConnectionError,metaRuntimeConfig} from '../supabase/functions/orkto-core-mutations/_shared/meta-connection.ts';

const values:Record<string,string>={
  META_APP_ID:'1234567890',META_APP_SECRET:'test-meta-secret',META_EMBEDDED_SIGNUP_CONFIG_ID:'9876543210',
  META_GRAPH_API_VERSION:'v25.0',META_EMBEDDED_SIGNUP_REDIRECT_URI:'https://staging.example.test/meta/callback',
};
const env={get:(name:string)=>values[name]};
const input={code:'one-time-code',businessId:'1111111111',wabaId:'2222222222',phoneNumberId:'3333333333',coexistenceState:'not_requested' as const};

test('Meta runtime fails closed when any server credential or identifier is invalid',()=>{
  assert.equal(metaRuntimeConfig({get:()=>undefined}),null);
  assert.equal(metaRuntimeConfig({get:name=>name==='META_APP_ID'?'not-an-id':values[name]}),null);
  assert.equal(metaRuntimeConfig({get:name=>name==='META_EMBEDDED_SIGNUP_REDIRECT_URI'?'http://unsafe.test':values[name]}),null);
  assert.deepEqual(metaRuntimeConfig(env),{appId:'1234567890',configId:'9876543210',graphVersion:'v25.0',redirectUri:'https://staging.example.test/meta/callback'});
});

test('Embedded Signup exchanges the one-time code, verifies the phone and subscribes the WABA without exposing the secret',async()=>{
  const calls:Array<{url:string;init:RequestInit}>=[];
  const send:typeof fetch=async(url,init={})=>{
    calls.push({url:String(url),init});
    if(String(url).endsWith('/oauth/access_token'))return Response.json({access_token:'provider-access-token'});
    if(String(url).endsWith('/me/permissions'))return Response.json({data:[
      {permission:'whatsapp_business_management',status:'granted'},
      {permission:'whatsapp_business_messaging',status:'granted'},
      {permission:'business_management',status:'declined'},
    ]});
    if(String(url).includes('/3333333333?'))return Response.json({id:'3333333333',display_phone_number:'+55 11 99999-0000',verified_name:'Oficina Piloto',quality_rating:'GREEN'});
    if(String(url).endsWith('/2222222222/subscribed_apps'))return Response.json({success:true});
    return Response.json({error:'unexpected'},{status:500});
  };
  const result=await completeMetaEmbeddedSignup(input,env,send);
  assert.equal(result.accessToken,'provider-access-token');
  assert.equal(result.verifiedName,'Oficina Piloto');
  assert.equal(result.metadata.qualityRating,'GREEN');
  assert.deepEqual(result.grantedScopes,['whatsapp_business_management','whatsapp_business_messaging']);
  assert.equal(calls.length,4);
  const tokenBody=String(calls[0].init.body);
  assert.match(tokenBody,/client_secret=test-meta-secret/);
  assert.doesNotMatch(JSON.stringify(result.metadata),/secret|provider-access-token/i);
});

test('Embedded Signup rejects mismatched provider phone identity and transient provider failure',async()=>{
  const mismatch:typeof fetch=async(url)=>{
    if(String(url).endsWith('/oauth/access_token'))return Response.json({access_token:'provider-access-token'});
    if(String(url).endsWith('/me/permissions'))return Response.json({data:[
      {permission:'whatsapp_business_management',status:'granted'},
      {permission:'whatsapp_business_messaging',status:'granted'},
    ]});
    return Response.json({id:'4444444444',display_phone_number:'+55 11 99999-0000',verified_name:'Wrong'});
  };
  await assert.rejects(completeMetaEmbeddedSignup(input,env,mismatch),(error:unknown)=>
    error instanceof MetaConnectionError&&error.code==='PROVIDER_RESPONSE_INVALID');
  const unavailable:typeof fetch=async()=>Response.json({error:'busy'},{status:429});
  await assert.rejects(completeMetaEmbeddedSignup(input,env,unavailable),(error:unknown)=>
    error instanceof MetaConnectionError&&error.code==='PROVIDER_UNAVAILABLE');
});

test('Embedded Signup rejects a token that lacks a required WhatsApp permission',async()=>{
  const missingScope:typeof fetch=async(url)=>{
    if(String(url).endsWith('/oauth/access_token'))return Response.json({access_token:'provider-access-token'});
    return Response.json({data:[{permission:'whatsapp_business_management',status:'granted'}]});
  };
  await assert.rejects(completeMetaEmbeddedSignup(input,env,missingScope),(error:unknown)=>
    error instanceof MetaConnectionError&&error.code==='PROVIDER_REJECTED');
});
