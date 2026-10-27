import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationApproval,conversationMessage,persistedMessageReceipt} from '../src/product/conversation-message.js';
test('database message contract preserves role, timestamp and explicit unsupported content',()=>{
 const msg=conversationMessage({id:'synthetic',conversation_id:'conversation',sender_role:'contact',message_type:'audio',
  sent_at:'2026-10-27T10:00:00Z',direction:'incoming',content:'Áudio recebido; conteúdo não processado.',metadata:{content_state:'unsupported'}});
 assert.equal(msg.senderRole,'contact');assert.equal(msg.messageType,'audio');assert.equal(msg.sentAt,'2026-10-27T10:00:00Z');
 assert.equal(msg.metadata?.content_state,'unsupported');assert.equal(persistedMessageReceipt(msg),null);
});
test('database approval records render text safely and unknown states never offer approval',()=>{
 const task=conversationApproval({id:'synthetic',conversation_id:'A',bot_name:'hermes',task_type:'response_suggestion',
  proposed_content:'Rascunho para revisão',proposed_action:{untrusted:'not a React node'},status:'pending',reason:'Revisão humana'});
 assert.equal(task.botName,'hermes');assert.equal(task.proposedAction,'Rascunho para revisão');assert.equal(task.status,'pending');
 assert.equal(task.justification,'Revisão humana');assert.equal(conversationApproval({id:'B',status:'unknown'}).status,'cancelled');
});
test('only persisted provider receipts confirm delivery or reading, never local read state',()=>{
 const msg=conversationMessage({id:'synthetic',senderRole:'operator',messageType:'text',direction:'outgoing',read_at:'2026-10-27',
  metadata:{provider:'meta_whatsapp_cloud'}});
 assert.equal(persistedMessageReceipt(msg),'Aceita pelo provedor · entrega não confirmada');
 for(const [status,label] of [['sent','Enviada'],['delivered','Entregue'],['read','Lida'],['failed','Falhou']]){
  assert.match(persistedMessageReceipt({...msg,metadata:{...msg.metadata,provider_receipt_status:status,provider_receipt_at:'2026-10-27T10:00:00Z'}})!,new RegExp(label));
 }
 assert.doesNotMatch(persistedMessageReceipt({...msg,metadata:{...msg.metadata,provider_receipt_status:'read',provider_receipt_at:'invalid'}})!,/Lida/);
});
