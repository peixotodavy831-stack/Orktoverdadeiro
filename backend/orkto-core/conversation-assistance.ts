/** Deterministic, read-only assistance. Inbound text is evidence, never authority. */
export interface AssistanceInput {
  conversation: { id: string; contact_phone?: string | null };
  clients: Array<{ id: string; name: string; phone?: string | null }>;
  clientsComplete: boolean;
  messages: Array<{ id: string; direction: string; content?: string | null; sent_at?: string | null }>;
  deals: Array<{ id: string; title: string; status: string }>;
}
export function buildConversationAssistance(input: AssistanceInput) {
  const phone = String(input.conversation.contact_phone || '').replace(/\D/g, '');
  const matches = phone.length >= 8 ? input.clients.filter(client => String(client.phone || '').replace(/\D/g, '') === phone) : [];
  const state = !input.clientsComplete ? 'incomplete' : matches.length > 1 ? 'ambiguous' : matches.length === 1 ? 'matched' : 'unmatched';
  const latest = input.messages.find(message => message.direction === 'incoming');
  // Never echo arbitrary inbound instructions, promise prices, or invent a commercial intent.
  const draft = latest ? 'Olá! Recebemos sua mensagem. Pode confirmar o que você procura e o prazo desejado para que possamos orientar o próximo passo?' : null;
  return {
    version: 'conversation-assistance-r0', conversationId: input.conversation.id,
    mode: 'read_only', customerState: state,
    customer: state === 'matched' ? { id: matches[0].id, name: matches[0].name } : null,
    candidateCount: matches.length, deals: input.deals,
    nextStep: state === 'matched' ? 'Revise a necessidade do cliente antes de preparar uma proposta.' : 'Confirme a identidade do cliente antes de vincular ou criar registros.',
    draft, sources: [{ type: 'conversation', id: input.conversation.id }, ...(latest ? [{ type: 'message', id: latest.id }] : [])],
    limitations: ['Rascunho determinístico, não é uma análise por IA.', 'Nenhum registro criado, alterado ou enviado.', 'Consulta limitada a 20 mensagens recebidas; o texto não é analisado.'],
  };
}
