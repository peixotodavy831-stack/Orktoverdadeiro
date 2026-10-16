import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { parseVerifiedMetaWebhook, verifyMetaSignature } from '../backend/channels/meta-webhook.js';
const secret='synthetic-local-secret';
const workspaceId='11111111-1111-4111-8111-111111111111';
const connectionId='22222222-2222-4222-8222-222222222222';
const envelope=()=>({object:'whatsapp_business_account',entry:[{id:'123456789',changes:[{field:'messages',value:{metadata:{phone_number_id:'987654321'},messages:[{id:'wamid.synthetic',from:'5511999990000',type:'text',timestamp:'1792100000',text:{body:'Solicitação sintética'}}]}}]}]});
const encode=(data:unknown)=>{const body=Buffer.from(JSON.stringify(data));return {body,signature:`sha256=${createHmac('sha256',secret).update(body).digest('hex')}`};};
const resolve=async(phone:string)=>({workspaceId,connectionId,phoneNumberId:phone,wabaId:'123456789'});
test('Meta verifies exact raw body bytes and fails tampered or malformed signatures',()=>{
  const {body,signature}=encode(envelope());
  assert.equal(verifyMetaSignature(body,signature,secret),true);
  assert.equal(verifyMetaSignature(Buffer.concat([body,Buffer.from(' ')]),signature,secret),false);
  assert.equal(verifyMetaSignature(body,'sha256=x',secret),false);
  assert.equal(verifyMetaSignature(body,signature,''),false);
});
test('untrusted workspace fields cannot override the trusted number binding',async()=>{
  const input={...envelope(),workspace_id:'foreign-workspace'};const {body,signature}=encode(input);
  const events=await parseVerifiedMetaWebhook(body,signature,secret,resolve);
  assert.equal(events.length,1);assert.equal(events[0].workspaceId,workspaceId);
  assert.equal(events[0].kind,'message');
});
test('unknown number or mismatched WABA is rejected before persistence',async()=>{
  const {body,signature}=encode(envelope());
  await assert.rejects(parseVerifiedMetaWebhook(body,signature,secret,async()=>null),/connection_unresolved/);
  await assert.rejects(parseVerifiedMetaWebhook(body,signature,secret,async phone=>({...await resolve(phone),wabaId:'55555555'})),/connection_unresolved/);
});
test('duplicate batch events normalize once; persistent dedup remains a repository responsibility',async()=>{
  const input=envelope();input.entry[0].changes[0].value.messages.push(input.entry[0].changes[0].value.messages[0]);
  const {body,signature}=encode(input);assert.equal((await parseVerifiedMetaWebhook(body,signature,secret,resolve)).length,1);
});
test('invalid JSON signature and oversized input never reach the connection resolver',async()=>{
  let calls=0;const resolver=async()=>{calls++;return null;};
  await assert.rejects(parseVerifiedMetaWebhook(Buffer.from('invalid'),undefined,secret,resolver),/signature_invalid/);
  const {body,signature}=encode({object:'invalid'});await assert.rejects(parseVerifiedMetaWebhook(body,signature,secret,resolver),/payload_invalid/);
  assert.equal(verifyMetaSignature(Buffer.alloc(1_048_577),signature,secret),false);assert.equal(calls,0);
});
test('status notifications are distinct from message acceptance',async()=>{
  const {body,signature}=encode({object:'whatsapp_business_account',entry:[{id:'123456789',changes:[{field:'messages',value:{metadata:{phone_number_id:'987654321'},statuses:[{id:'wamid.synthetic',status:'delivered',timestamp:'1792100000',recipient_id:'5511999990000'}]}}]}]});
  const events=await parseVerifiedMetaWebhook(body,signature,secret,resolve);assert.equal(events[0].kind,'status');if(events[0].kind==='status')assert.equal(events[0].status,'delivered');
});
