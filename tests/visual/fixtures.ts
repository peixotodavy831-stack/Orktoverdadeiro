/**
 * Test-only data for reviewing layout and interaction states.
 * This module is imported only by tests/visual and is never part of the app entry.
 */
export const VISUAL_TOKEN = 'visual-qa-only';
export const VISUAL_CONVERSATION_ID = 'visual-conversation-1';
export const VISUAL_DEAL_ID = 'visual-deal-1';

const recent = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const visualConversation = {
  id: VISUAL_CONVERSATION_ID,
  contact_name: 'Marina Costa',
  contact_phone: '+55 11 99999-1234',
  source_channel: 'WhatsApp',
  status: 'open',
  last_message: 'Consegue me confirmar o prazo da proposta?',
  last_message_by: 'customer',
  last_message_at: recent(8),
  unread_count: 2,
  message_count: 2,
  priority: 'high',
  priority_reason: ['A cliente aguarda retorno sobre prazo e escopo da proposta.'],
  related_deal_ids: [VISUAL_DEAL_ID],
};

export const visualConversationDetail = {
  id: VISUAL_CONVERSATION_ID,
  contactName: 'Marina Costa',
  contactPhone: '+55 11 99999-1234',
  status: 'open',
  sourceChannel: 'WhatsApp',
  mood: 'yellow',
  quoteId: 'visual-proposal-1',
  quoteTotal: 4200,
  messages: [
    {
      id: 'visual-message-in-1',
      senderRole: 'contact',
      direction: 'incoming',
      content: 'Consegue me confirmar o prazo da proposta?',
      sentAt: recent(8),
      messageType: 'text',
      senderName: 'Marina Costa',
    },
    {
      id: 'visual-message-out-1',
      senderRole: 'operator',
      direction: 'outgoing',
      content: 'Vou confirmar o prazo e já retorno por aqui.',
      sentAt: recent(24),
      messageType: 'text',
      senderName: 'Você',
    },
  ],
  approval_tasks: [],
};

export const visualWiaActions = [
  {
    id: 'visual-wia-awaiting-1',
    action_type: 'preparar_resposta_cliente',
    payload: { messageDraft: 'Olá, Marina. Estou confirmando o prazo da proposta e retorno em seguida.' },
    rationale: 'A conversa mostra uma solicitação de prazo ainda sem resposta confirmada.',
    status: 'awaiting_approval',
    requires_approval: true,
    confidence: 0.82,
    created_at: recent(12),
    run_id: 'visual-run-1',
  },
  {
    id: 'visual-wia-prepared-1',
    action_type: 'revisar_proposta',
    payload: { messageDraft: 'Revisar prazo e escopo antes do próximo contato.' },
    rationale: 'A proposta está aguardando retorno da cliente.',
    status: 'prepared',
    created_at: recent(35),
    run_id: 'visual-run-2',
  },
  {
    id: 'visual-wia-executed-1',
    action_type: 'registrar_nota_comercial',
    payload: { messageDraft: 'Contexto da proposta revisado.' },
    status: 'executed',
    created_at: recent(90),
    run_id: 'visual-run-3',
  },
  {
    id: 'visual-wia-failed-1',
    action_type: 'sincronizar_calendario',
    rationale: 'O calendário não está conectado no ambiente de revisão.',
    status: 'failed',
    created_at: recent(180),
    run_id: 'visual-run-4',
  },
];

export const visualDeals = [
  {
    id: VISUAL_DEAL_ID,
    title: 'Renovação do contrato de manutenção',
    description: 'Revisão do escopo e das datas de atendimento.',
    customer_ref: 'visual-client-1',
    stage: 'proposal',
    status: 'open',
    value_cents: 420000,
    probability_percent: 65,
    expected_close_on: null,
    updated_at: recent(35),
    stage_changed_at: recent(2_880),
    owner_name: 'Equipe comercial',
    next_action: 'Confirmar prazo com a cliente',
    lost_reason: null,
    risk: {
      score: 61,
      confidence: 0.74,
      reasons: ['Sem retorno após o envio da proposta'],
      recommended_action: 'Retomar contato com contexto do prazo solicitado',
    },
  },
  {
    id: 'visual-deal-2',
    title: 'Plano de suporte anual',
    description: 'Proposta de suporte preventivo.',
    customer_ref: null,
    stage: 'negotiation',
    status: 'open',
    value_cents: null,
    probability_percent: null,
    expected_close_on: null,
    updated_at: recent(240),
    stage_changed_at: recent(8_640),
    owner_name: null,
    next_action: null,
    lost_reason: null,
    risk: null,
  },
];

export const visualWiaRouteResult = {
  success: true,
  agent: 'wia-visual-qa',
  traceId: 'visual-trace-1',
  runId: 'visual-run-qa',
  decision: {
    action: 'answer',
    messageDraft: 'A proposta está em negociação. Confirme o prazo solicitado e registre a próxima interação após a resposta.',
    reasonCode: 'A conversa selecionada contém uma pergunta sobre prazo.',
    sourceIds: [VISUAL_CONVERSATION_ID, VISUAL_DEAL_ID],
    requiresApproval: false,
    confidenceSignal: 'Confiança retornada pelo contrato de teste',
  },
  usage: { provider: 'fixture de revisão', model: 'somente teste' },
  toolExecutions: [],
};
