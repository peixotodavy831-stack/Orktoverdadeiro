import type { ApprovalTask, ConversationMessage, MessageRole, MessageType } from '../types';

/** The API returns database names; fixtures and legacy views may use camelCase. */
export function conversationMessage(row: Record<string, any>): ConversationMessage {
  const role=row.sender_role??row.senderRole;
  const type=row.message_type??row.messageType;
  return { ...row, id:String(row.id), conversationId:row.conversation_id??row.conversationId,
    senderRole:(['contact','operator','bot','system'].includes(role)?role:'system') as MessageRole,
    messageType:(['text','image','audio','video','document','location','contact','system'].includes(type)?type:'system') as MessageType,
    senderName:row.sender_name??row.senderName,botName:row.bot_name??row.botName,
    botActionId:row.bot_action_id??row.botActionId,approvalTaskId:row.approval_task_id??row.approvalTaskId,
    sentAt:row.sent_at??row.sentAt,content:typeof row.content==='string'?row.content:'',
    direction:row.direction==='incoming'||row.direction==='outgoing'?row.direction:'internal',
    metadata:row.metadata&&typeof row.metadata==='object'&&!Array.isArray(row.metadata)?row.metadata:{},
  };
}

/** Local read_at and HTTP success must never become provider delivery/read proof. */
export function persistedMessageReceipt(message: ConversationMessage): string|null {
  if(message.direction!=='outgoing'||message.metadata?.provider!=='meta_whatsapp_cloud')return null;
  const at=message.metadata.provider_receipt_at;
  if(typeof at==='string'&&Number.isFinite(Date.parse(at))){
    switch(message.metadata.provider_receipt_status){
      case 'sent':return 'Enviada · confirmado pela Meta';
      case 'delivered':return 'Entregue · confirmado pela Meta';
      case 'read':return 'Lida · confirmado pela Meta';
      case 'failed':return 'Falhou · informado pela Meta';
    }
  }
  return 'Aceita pelo provedor · entrega não confirmada';
}

/** Approval records also arrive in database casing. Unknown states never enable approval. */
export function conversationApproval(row:Record<string,any>):ApprovalTask{
 const content=typeof (row.proposed_content??row.proposedContent)==='string'?(row.proposed_content??row.proposedContent):'';
 const proposed=row.proposed_action??row.proposedAction;
 return {...row,id:String(row.id),conversationId:row.conversation_id??row.conversationId,
  taskType:row.task_type??row.taskType,botName:typeof(row.bot_name??row.botName)==='string'?(row.bot_name??row.botName):'hermes',
  proposedContent:content,proposedAction:typeof proposed==='string'?proposed:content,
  title:typeof row.title==='string'?row.title:'Revisar rascunho da conversa',
  reason:typeof row.reason==='string'?row.reason:'',justification:row.justification??row.reason??'',
  policyApplied:row.policy_applied??row.policyApplied,createdAt:row.created_at??row.createdAt,
  expiresAt:row.expires_at??row.expiresAt,decidedAt:row.decided_at??row.decidedAt,
  decidedBy:row.decided_by??row.decidedBy,decisionReason:row.decision_reason??row.decisionReason,
  status:['pending','approved','rejected','edited','scheduled','cancelled'].includes(row.status)?row.status:'cancelled'};
}
