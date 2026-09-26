/**
 * HermesAdapter - Adaptador para o Hermes Agent
 * 
 * Este módulo é o único ponto de contato da ORKTO com o Hermes Agent.
 * Em desenvolvimento/homologação, usa um mock que registra traces.
 * Em produção, conectará ao gateway do Hermes Agent via protocolo definido.
 */

// Tipos de contrato
export interface ConversationContext {
  conversationId: string;
  workspaceId: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  channel: 'whatsapp' | 'telegram' | 'email' | 'direct';
  recentMessages: RecentMessage[];
  conversationMetadata?: Record<string, unknown>;
}

export interface RecentMessage {
  id: string;
  senderType: 'customer' | 'human' | 'bot' | 'system';
  content: string;
  createdAt: string;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'document';
}

export interface IntentClassification {
  intent: string;
  confidence: number;
  category: 'greeting' | 'qualification' | 'objection' | 'purchase' | 'support' | 'payment' | 'followup' | 'other';
  entities: Record<string, string | number>;
  explanation: string;
}

export interface SpecialistSelection {
  specialistId: string;
  specialistName: string;
  specialistType: 'hunter' | 'farmer' | 'recovery' | 'collection' | 'risk' | 'report' | 'growth' | 'price_auditor';
  reason: string;
  requiredCapabilities: string[];
}

export interface SpecialistContext {
  specialistId: string;
  context: Record<string, unknown>;
  contextSummary: string;
}

export interface ActionProposal {
  actionType: 'respond' | 'send_message' | 'discount' | 'create_task' | 'update_quote' | 'schedule_followup' | 'escalate' | 'pause' | 'transfer_to_human' | 'log';
  description: string;
  payload: Record<string, unknown>;
  suggestedText?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requiresApproval: boolean;
}

export interface ActionResult {
  success: boolean;
  actionId?: string;
  result?: Record<string, unknown>;
  error?: string;
  traceId: string;
}

export interface Suggestion {
  text: string;
  specialistId: string;
  specialistName: string;
  intent: string;
  explanation: string;
  suggestedAction?: ActionProposal;
  confidence: number;
  timestamp: string;
}

// Interface do adaptador
export interface HermesAdapter {
  classifyIntent(context: ConversationContext): Promise<IntentClassification>;
  selectSpecialist(intent: IntentClassification, context: ConversationContext): Promise<SpecialistSelection>;
  buildSpecialistContext(selection: SpecialistSelection, conversation: ConversationContext): Promise<SpecialistContext>;
  suggestResponse(context: ConversationContext, intent: IntentClassification): Promise<Suggestion>;
  executeAction(action: ActionProposal, context: ConversationContext): Promise<ActionResult>;
}

// ============================================================
// Mock do HermesAdapter para homologação
// ============================================================

export class MockHermesAdapter implements HermesAdapter {
  private traceLog: Array<{
    timestamp: string;
    operation: string;
    input: unknown;
    output: unknown;
    durationMs: number;
  }> = [];
  
  constructor() {
    // Registrar início da sessão
    console.log('[HermesAdapter.Mock] Inicializado em modo homologação');
  }

  private logTrace(operation: string, input: unknown, output: unknown, durationMs: number): void {
    const trace = {
      timestamp: new Date().toISOString(),
      operation,
      input: this.sanitizeInput(input),
      output: this.sanitizeOutput(output),
      durationMs,
    };
    this.traceLog.push(trace);
    console.log(`[HermesAdapter.Trace] ${operation} -> ${JSON.stringify(output).slice(0, 200)}`);
  }

  private sanitizeInput(input: unknown): unknown {
    // Remove dados sensíveis do trace
    if (typeof input === 'object' && input !== null) {
      const sanitized = { ...input };
      if ('contactPhone' in sanitized) {
        (sanitized as Record<string, unknown>).contactPhone = '[REDACTED]';
      }
      return sanitized;
    }
    return input;
  }

  private sanitizeOutput(output: unknown): unknown {
    if (typeof output === 'object' && output !== null) {
      const sanitized = { ...output };
      return sanitized;
    }
    return output;
  }

  getTraceLog(): readonly { timestamp: string; operation: string; input: unknown; output: unknown; durationMs: number }[] {
    return this.traceLog;
  }

  clearTraceLog(): void {
    this.traceLog = [];
  }

  // Extração simples de entidades da mensagem para homologação
  private extractEntities(messageContent: string): Record<string, string | number> {
    const entities: Record<string, string | number> = {};
    
    // Extrair valores monetários (ex: R$ 5000, 5000 reais)
    const moneyMatch = messageContent.match(/R\$\s*(\d+[.,]?\d*)/i) || messageContent.match(/(\d+)\s*(?:reais?|r\$)/i);
    if (moneyMatch) {
      entities.amount = moneyMatch[1].replace(',', '.');
    }
    
    // Extrair nomes próprios (iniciais maiúsculas)
    const nameMatch = messageContent.match(/(?:cl(stop)?e)?nt[eo]?\s+([A-Z][a-z]+)/i);
    if (nameMatch) {
      entities.clientName = nameMatch[1];
    }
    
    // Extrair telefones (formato brasileiro)
    const phoneMatch = messageContent.match(/(\d{2}[\.\s]?\d{4,5}[-\s]?\d{4})/);
    if (phoneMatch) {
      entities.phone = phoneMatch[1];
    }
    
    return entities;
  }

  async classifyIntent(context: ConversationContext): Promise<IntentClassification> {
    const start = performance.now();
    
    // Análise simulada baseada no conteúdo da última mensagem
    const lastMessage = context.recentMessages[context.recentMessages.length - 1];
    const messageContent = lastMessage?.content?.toLowerCase() || '';
    
    let intent: string;
    let category: IntentClassification['category'];
    let confidence: number;
    
    // Detecção simples de intenção para homologação
    if (messageContent.includes('oi') || messageContent.includes('olá') || messageContent.includes('bom dia')) {
      intent = 'greeting';
      category = 'greeting';
      confidence = 0.95;
    } else if (messageContent.includes('preço') || messageContent.includes('valor') || messageContent.includes('quanto')) {
      intent = 'price_inquiry';
      category = 'qualification';
      confidence = 0.85;
    } else if (messageContent.includes('não') || messageContent.includes('não quero') || messageContent.includes('não está')) {
      intent = 'objection';
      category = 'objection';
      confidence = 0.75;
    } else if (messageContent.includes('pagamento') || messageContent.includes('pix') || messageContent.includes('boleto')) {
      intent = 'payment_inquiry';
      category = 'payment';
      confidence = 0.8;
    } else if (messageContent.includes('obrigado') || messageContent.includes('vamos') || messageContent.includes('sim')) {
      intent = 'positive_response';
      category = 'purchase';
      confidence = 0.85;
    } else {
      intent = 'general_inquiry';
      category = 'other';
      confidence = 0.6;
    }
    
    const result: IntentClassification = {
      intent,
      confidence,
      category,
      entities: this.extractEntities(messageContent),
      explanation: `Classificação baseada na mensagem: "${lastMessage?.content?.slice(0, 50)}..."`,
    };
    
    this.logTrace('classifyIntent', context, result, Math.round(performance.now() - start));
    return result;
  }

  async selectSpecialist(
    intent: IntentClassification,
    context: ConversationContext
  ): Promise<SpecialistSelection> {
    const start = performance.now();
    
    // Mapeamento de intenção para especialista
    const specialistMap: Record<string, SpecialistSelection> = {
      greeting: {
        specialistId: 'bot-hunter',
        specialistName: 'Hunter',
        specialistType: 'hunter',
        reason: 'Primeiro contato requer qualificação e warm-up',
        requiredCapabilities: ['respond', 'qualify'],
      },
      price_inquiry: {
        specialistId: 'bot-hunter',
        specialistName: 'Hunter',
        specialistType: 'hunter',
        reason: 'Consulta de preço requer preparação de proposta',
        requiredCapabilities: ['respond', 'quote'],
      },
      objection: {
        specialistId: 'bot-hunter',
        specialistName: 'Hunter',
        specialistType: 'hunter',
        reason: 'Objecões requerem handling e reengajamento',
        requiredCapabilities: ['respond', 'handle_objection'],
      },
      payment_inquiry: {
        specialistId: 'bot-collection',
        specialistName: 'Collection Analyst',
        specialistType: 'collection',
        reason: 'Inquiery de pagamento envolve cobrança',
        requiredCapabilities: ['respond', 'payment_planning'],
      },
      positive_response: {
        specialistId: 'bot-farmer',
        specialistName: 'Farmer',
        specialistType: 'farmer',
        reason: 'Resposta positiva requer nurturance e seguimento',
        requiredCapabilities: ['respond', 'followup'],
      },
    };
    
    const defaultSelection: SpecialistSelection = {
      specialistId: 'bot-hunter',
      specialistName: 'Hunter',
      specialistType: 'hunter',
      reason: 'Intenção não mapeada para especialista específico',
      requiredCapabilities: ['respond'],
    };
    
    const result = specialistMap[intent.intent] || defaultSelection;
    
    this.logTrace('selectSpecialist', { intent: intent.intent }, result, Math.round(performance.now() - start));
    return result;
  }

  async buildSpecialistContext(
    selection: SpecialistSelection,
    conversation: ConversationContext
  ): Promise<SpecialistContext> {
    const start = performance.now();
    
    const contextSummary = `
Contato: ${conversation.contactName || 'N/A'} (${conversation.contactPhone || 'N/A'})
Canal: ${conversation.channel}
Intenção detectada: ${conversation.recentMessages[conversation.recentMessages.length - 1]?.content?.slice(0, 100)}
Últimas mensagens: ${conversation.recentMessages.slice(-3).map(m => `${m.senderType}: ${m.content?.slice(0, 50)}`).join(' | ')}
    `.trim();
    
    const result: SpecialistContext = {
      specialistId: selection.specialistId,
      context: {
        conversation,
        specialistType: selection.specialistType,
        capabilities: selection.requiredCapabilities,
      },
      contextSummary,
    };
    
    this.logTrace('buildSpecialistContext', selection, result, Math.round(performance.now() - start));
    return result;
  }

  async suggestResponse(
    context: ConversationContext,
    intent: IntentClassification
  ): Promise<Suggestion> {
    const start = performance.now();
    
    const lastMessage = context.recentMessages[context.recentMessages.length - 1];
    const messageContent = lastMessage?.content || '';
    
    // Gerar sugestão baseada na intenção
    const suggestions: Record<string, { text: string; action?: ActionProposal }> = {
      greeting: {
        text: `Olá! Tudo bem? Como posso ajudar você hoje?`,
        action: {
          actionType: 'respond',
          description: 'Responder ao greeting do cliente',
          payload: { message: 'Olá! Tudo bem? Como posso ajudar você hoje?' },
          priority: 'low',
          requiresApproval: true,
        },
      },
      price_inquiry: {
        text: `O valor da proposta está em R$ [VALOR]. Posso detalhar os itens ou ajustar o escopo se precisar. Qual opção você prefere?`,
        action: {
          actionType: 'respond',
          description: 'Responder à consulta de preço',
          payload: { message: `O valor da proposta está em R$ [VALOR]. Posso detalhar os itens ou ajustar o escopo se precisar. Qual opção você prefere?` },
          priority: 'medium',
          requiresApproval: true,
        },
      },
      objection: {
        text: `Entendo sua preocupação. Vou verificar o que podemos ajustar para resolver isso. Me conta mais sobre o que não está achando ideal?`,
        action: {
          actionType: 'respond',
          description: 'Acknowledge e investigar objecão',
          payload: { message: `Entendo sua preocupação. Vou verificar o que podemos ajustar.` },
          priority: 'high',
          requiresApproval: true,
        },
      },
      payment_inquiry: {
        text: `Posso te ajudar com o pagamento! Você prefere PIX ouboleto? Vou te enviar as opções agora.`,
        action: {
          actionType: 'send_message',
          description: 'Enviar opções de pagamento',
          payload: { template: 'payment_options' },
          priority: 'high',
          requiresApproval: true,
        },
      },
      positive_response: {
        text: `Show! Vamos avançar então. Qual o melhor momento para fecharmos os detalhes e agendarmos o início?`,
        action: {
          actionType: 'respond',
          description: 'Confirmar interesse e agendar próximo passo',
          payload: { message: `Show! Vamos avançar então. Qual o melhor momento?` },
          priority: 'high',
          requiresApproval: true,
        },
      },
    };
    
    const defaultSuggestion = suggestions['greeting'];
    const suggestionData = suggestions[intent.intent] || defaultSuggestion;
    
    const result: Suggestion = {
      text: suggestionData.text,
      specialistId: 'bot-hunter',
      specialistName: 'Hunter',
      intent: intent.intent,
      explanation: `Sugestão para intenção "${intent.intent}" com confiança ${intent.confidence.toFixed(2)}`,
      suggestedAction: suggestionData.action,
      confidence: intent.confidence,
      timestamp: new Date().toISOString(),
    };
    
    this.logTrace('suggestResponse', { intent: intent.intent }, result, Math.round(performance.now() - start));
    return result;
  }

  async executeAction(
    action: ActionProposal,
    context: ConversationContext
  ): Promise<ActionResult> {
    const start = performance.now();
    
    // Em homologação, todas as ações são registradas mas não executadas
    const traceId = crypto.randomUUID();
    
    const result: ActionResult = {
      success: true,
      actionId: traceId,
      result: {
        actionType: action.actionType,
        description: action.description,
        simulated: true,
        message: 'Ação registrada em modo homologação. Nenhum envio real realizado.',
      },
      traceId,
    };
    
    this.logTrace('executeAction', { action, context }, result, Math.round(performance.now() - start));
    return result;
  }
}

// ============================================================
// Factory para criar o adaptador (mock em dev, real em prod)
// ============================================================

let adapterInstance: HermesAdapter | null = null;

export function getHermesAdapter(): HermesAdapter {
  if (!adapterInstance) {
    // Em produção, verificar variável de ambiente para usar implementação real
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction && process.env.HERMES_API_URL) {
      // Implementação real seria aqui
      console.warn('[HermesAdapter] Modo produção não implementado ainda - usando mock');
    }
    
    adapterInstance = new MockHermesAdapter();
  }
  
  return adapterInstance;
}

export function resetHermesAdapter(): void {
  adapterInstance = null;
}
