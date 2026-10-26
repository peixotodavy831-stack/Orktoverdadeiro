import {metaServiceWindowOpen} from './meta-send.ts';

/** Explicit operator request only. Provider/model calls and writes are forbidden here. */
export async function prepareWhatsAppReply(db:any,workspaceId:string,conversationId:string,now=Date.now()) {
 const conversation=await db.from('orkto_conversations').select('id,source_channel,status')
  .eq('workspace_id',workspaceId).eq('id',conversationId).maybeSingle();
 if(conversation.error)throw new Error('WIA_QUERY_FAILED');
 const unavailable={action:'answer',requiresApproval:false,sourceIds:[] as string[],confidenceSignal:'high',
  reasonCode:'whatsapp_reply_not_eligible',messageDraft:'Não há conversa WhatsApp elegível neste workspace. Nenhuma resposta foi enviada.'};
 if(!conversation.data||conversation.data.source_channel!=='whatsapp'||['archived','closed'].includes(conversation.data.status))return unavailable;
 const messages=await db.from('orkto_messages').select('id,sent_at').eq('workspace_id',workspaceId)
  .eq('conversation_id',conversationId).eq('direction','incoming').order('sent_at',{ascending:false}).limit(1);
 if(messages.error)throw new Error('WIA_QUERY_FAILED');
 const latest=messages.data?.[0];
 if(!latest||!metaServiceWindowOpen(latest.sent_at,now))return {...unavailable,reasonCode:'whatsapp_service_window_unavailable',
  messageDraft:'Não foi confirmada uma mensagem recebida dentro da janela de atendimento. Revise as regras de template e consentimento antes de contatar o cliente.'};
 return {action:'request_approval',requiresApproval:true,confidenceSignal:'high',
  sourceIds:[`conversation:${conversationId}`,`message:${latest.id}`],reasonCode:'deterministic_whatsapp_reply_review',
  messageDraft:'Olá! Recebemos sua mensagem. Pode confirmar o que você procura e o prazo desejado para que nossa equipe confira as opções?'};
}
