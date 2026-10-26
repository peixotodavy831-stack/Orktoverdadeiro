export function whatsappReplyDraft(conversationId:string,channel:string|null|undefined):string|null {
 if(channel?.toLowerCase()!=='whatsapp'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId))return null;
 return `Preparar resposta WhatsApp da conversa ${conversationId.toLowerCase()}`;
}
