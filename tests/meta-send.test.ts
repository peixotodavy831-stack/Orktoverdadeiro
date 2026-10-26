import assert from 'node:assert/strict';
import test from 'node:test';
import {MetaSendError,sendMetaText,metaServiceWindowOpen} from '../supabase/functions/orkto-core-mutations/_shared/meta-send.ts';

const input={phoneNumberId:'1234567890',recipient:'5511999990000',content:'Olá',accessToken:'server-token',graphVersion:'v25.0'};

test('Meta text send uses the fixed Graph host and returns only provider acceptance',async()=>{
  let captured:{url:string;init?:RequestInit}|null=null;
  const send:typeof fetch=async(url,init)=>{captured={url:String(url),init};return Response.json({messages:[{id:'wamid.accepted'}]})};
  const result=await sendMetaText(input,send);
  assert.equal(result.externalMessageId,'wamid.accepted');
  assert.equal(captured?.url,'https://graph.facebook.com/v25.0/1234567890/messages');
  const body=JSON.parse(String(captured?.init?.body));
  assert.deepEqual(body,{messaging_product:'whatsapp',recipient_type:'individual',to:'5511999990000',type:'text',text:{preview_url:false,body:'Olá'}});
  assert.equal((captured?.init?.headers as Record<string,string>).authorization,'Bearer server-token');
});

test('Meta text send classifies confirmed failures and keeps network ambiguity unretryable',async()=>{
  await assert.rejects(sendMetaText(input,async()=>Response.json({error:{code:190}},{status:400})),(error:unknown)=>error instanceof MetaSendError&&error.category==='authentication');
  await assert.rejects(sendMetaText(input,async()=>Response.json({error:{}},{status:401})),(error:unknown)=>error instanceof MetaSendError&&error.category==='authentication');
  await assert.rejects(sendMetaText(input,async()=>Response.json({error:{}},{status:429,headers:{'retry-after':'30'}})),(error:unknown)=>error instanceof MetaSendError&&error.category==='rate_limit'&&error.retryAfterMs===30000);
  await assert.rejects(sendMetaText(input,async()=>{throw new Error('network')}),(error:unknown)=>error instanceof MetaSendError&&error.category==='outcome_unknown');
  await assert.rejects(sendMetaText(input,async()=>Response.json({messages:[]})),(error:unknown)=>error instanceof MetaSendError&&error.category==='outcome_unknown');
});

test('Meta service window excludes future, missing and exactly expired timestamps',()=>{
 const now=Date.parse('2026-10-26T12:00:00Z');
 assert.equal(metaServiceWindowOpen('2026-10-26T11:59:59Z',now),true);
 for(const at of [null,'invalid','2026-10-26T12:00:01Z','2026-10-25T12:00:00Z','2026-10-24T12:00:00Z'])assert.equal(metaServiceWindowOpen(at,now),false);
});
