/**
 * Rotas da Inbox Operacional - Onda 1
 * 
 * Endpoints para:
 * - Webhook simulado de WhatsApp (homologação)
 * - Lista de conversas (inbox)
 * - Detalhe de conversa
 * - Sugestões de resposta
 * - Aprovação de ações
 */

import express from 'express';
import crypto from 'crypto';
import { getHermesAdapter, type Suggestion, type ConversationContext, type RecentMessage } from './orkto-core/hermes-adapter.js';
import { getPolicyEngine, type PolicyContext, type PolicyDecision } from './orkto-core/policy-engine.js';

export function registerInboxRoutes(app: express.Express): void {
  const router = express.Router();
  
  // ============================================================
  // Webhook Simulado de WhatsApp (Homologação)
  // ============================================================
  
  /**
   * POST /api/orkto/whatsapp/webhook-sim
   * Recebe evento simulado de WhatsApp para homologação.
   * Não envia mensagem real - apenas persiste e gera sugestão.
   */
  router.post('/whatsapp/webhook-sim', async (req, res) => {
    try {
      console.log('[Inbox] webhook-sim chamado:', JSON.stringify(req.body));
      
      const { workspaceId, contactName, contactPhone, message, senderType = 'customer' } = req.body;
      
      if (!workspaceId || !message) {
        return res.status(400).json({ error: 'workspaceId e message são obrigatórios' });
      }
      
      // 1. Criar ou encontrar contato
      const contactId = crypto.randomUUID();
      const conversationId = crypto.randomUUID();
      
      console.log(`[Inbox] webhook-sim: conversa ${conversationId} para ${contactName || contactPhone}`);
      
      // 2. Criar contexto de conversa
      const context: ConversationContext = {
        conversationId,
        workspaceId,
        contactId,
        contactName: contactName || 'Contato',
        contactPhone: contactPhone || '',
        channel: 'whatsapp',
        recentMessages: [{
          id: crypto.randomUUID(),
          senderType: senderType as 'customer' | 'human' | 'bot' | 'system',
          content: message,
          createdAt: new Date().toISOString(),
          messageType: 'text',
        }],
      };
      
      // 3. Classificar intenção com HermesAdapter mock
      const adapter = getHermesAdapter();
      const intent = await adapter.classifyIntent(context);
      console.log(`[Inbox] intenção classificada: ${intent.intent} (confiança: ${intent.confidence})`);
      
      // 4. Selecionar especialista
      const specialist = await adapter.selectSpecialist(intent, context);
      console.log(`[Inbox] especialista selecionado: ${specialist.specialistName}`);
      
      // 5. Gerar sugestão de resposta
      const suggestion = await adapter.suggestResponse(context, intent);
      console.log(`[Inbox] sugestão gerada: "${suggestion.text.slice(0, 50)}..."`);
      
      // 6. Criar tarefa de aprovação simulada
      const approvalTask = {
        id: crypto.randomUUID(),
        conversationId,
        contactId,
        contactName: context.contactName,
        contactPhone: context.contactPhone,
        message,
        intent: intent.intent,
        specialist: specialist.specialistName,
        suggestion: suggestion.text,
        suggestedAction: suggestion.suggestedAction,
        confidence: suggestion.confidence,
        status: 'pending',
        createdAt: new Date().toISOString(),
        traceId: suggestion.timestamp,
      };
      
      // Log de auditoria (em produção, persistir no Supabase)
      console.log(`[Inbox] auditoria: sugestão criada para aprovação`, {
        conversationId,
        intent: intent.intent,
        specialist: specialist.specialistName,
      });
      
      res.json({
        success: true,
        conversationId,
        contactId,
        suggestion: {
          text: suggestion.text,
          specialist: suggestion.specialistName,
          intent: suggestion.intent,
          confidence: suggestion.confidence,
        },
        approvalTask,
        trace: {
          intentClassification: intent,
          specialistSelection: specialist,
          timestamp: suggestion.timestamp,
        },
        simulated: true,
        warning: 'Modo homologação - nenhuma mensagem real foi enviada',
      });
      
    } catch (error) {
      console.error('[Inbox] erro no webhook-sim:', error);
      res.status(500).json({ error: 'Erro interno do servidor', simulated: true });
    }
  });
  
  // ============================================================
  // Inbox - Lista de Conversas
  // ============================================================
  
  /**
   * GET /api/orkto/inbox
   * Lista conversas priorizadas para a inbox operacional.
   */
  router.get('/inbox', async (req, res) => {
    try {
      const { workspaceId, limit = 50, offset = 0, status, channel } = req.query;
      
      // Em produção, consultar via Supabase
      // Por enquanto, retornar dados simulados para demonstração
      const mockConversations = [
        {
          id: 'conv-001',
          contactName: 'Maria Silva',
          contactPhone: '+5511999999999',
          channel: 'whatsapp',
          status: 'active',
          priorityScore: 95,
          priorityReason: 'Alto valor + urgmge',
          moodState: 'green',
          moodReason: 'Resposta positiva',
          lastMessage: 'Olá, gostaria de saber mais sobre os serviços!',
          lastMessageAt: new Date().toISOString(),
          messageCount: 5,
          assignedTo: null,
        },
        {
          id: 'conv-002',
          contactName: 'João Santos',
          contactPhone: '+5511888888888',
          channel: 'whatsapp',
          status: 'active',
          priorityScore: 80,
          priorityReason: 'Sem resposta há 2h',
          moodState: 'yellow',
          moodReason: 'Espera por resposta',
          lastMessage: 'Pode me dar uma resposta?',
          lastMessageAt: new Date().toISOString(),
          messageCount: 3,
          assignedTo: null,
        },
        {
          id: 'conv-003',
          contactName: 'Pedrão LTDA',
          contactPhone: '+5511777777777',
          channel: 'whatsapp',
          status: 'active',
          priorityScore: 90,
          priorityReason: 'Cliente recorrente + alto valor',
          moodState: 'green',
          moodReason: 'Relacionamento establish',
          lastMessage: 'Vamos fechar essa proposta!',
          lastMessageAt: new Date().toISOString(),
          messageCount: 12,
          assignedTo: 'user-001',
        },
      ];
      
      res.json({
        success: true,
        conversations: mockConversations.slice(Number(offset), Number(offset) + Number(limit)),
        total: mockConversations.length,
        simulated: true,
      });
    } catch (error) {
      console.error('[Inbox] erro ao listar:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  // ============================================================
  // Detalhe de Conversa
  // ============================================================
  
  /**
   * GET /api/orkto/conversations/:conversationId
   * Detalhes completos de uma conversa com timeline.
   */
  router.get('/conversations/:conversationId', async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      // Simular detalhe de conversa
      const mockConversation = {
        id: conversationId,
        contact: {
          id: 'contact-001',
          name: 'Maria Silva',
          phone: '+5511999999999',
          email: 'maria@exemplo.com.br',
          company: 'Maria Silva Contabilidade',
        },
        channel: 'whatsapp',
        status: 'active',
        mood: {
          state: 'green',
          confidence: 0.85,
          reason: 'Cliente responde rapidamente e com tom positivo',
        },
        risk: {
          score: 5,
          signals: [],
          reason: 'Sem sinais de risco identificados',
        },
        messages: [
          { id: 'msg-001', senderType: 'customer', content: 'Olá, gostaria de saber mais sobre os serviços!', createdAt: '2026-09-18T10:00:00Z', messageType: 'text' },
          { id: 'msg-002', senderType: 'human', content: 'Olá! Claro, em que posso ajudar?', createdAt: '2026-09-18T10:01:00Z', messageType: 'text' },
          { id: 'msg-003', senderType: 'customer', content: 'Tenho um escritório e preciso de ajuda com...', createdAt: '2026-09-18T10:02:00Z', messageType: 'text' },
        ],
        suggestion: {
          id: 'suggestion-001',
          text: 'Olá! Tudo bem? Como posso ajudar você hoje?',
          specialist: 'Hunter',
          intent: 'greeting',
          confidence: 0.95,
          status: 'pending',
          requiresApproval: true,
          createdAt: new Date().toISOString(),
        },
        pendingApproval: true,
      };
      
      res.json({
        success: true,
        conversation: mockConversation,
        simulated: true,
      });
    } catch (error) {
      console.error('[Inbox] erro ao buscar conversa:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  // ============================================================
  // Sugestões e Aprovações
  // ============================================================
  
  /**
   * GET /api/orkto/suggestions/:conversationId
   * Obtém sugestões pendentes para uma conversa.
   */
  router.get('/suggestions/:conversationId', async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      const mockSuggestion = {
        id: 'suggestion-' + conversationId,
        conversationId,
        text: 'Olá! Tudo bem? Como posso ajudar você hoje?',
        specialist: {
          id: 'bot-hunter',
          name: 'Hunter',
          type: 'hunter',
        },
        intent: 'greeting',
        intentConfidence: 0.95,
        explanation: 'Sugestão para saudação inicial do cliente',
        requiresApproval: true,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      
      res.json({
        success: true,
        suggestion: mockSuggestion,
        simulated: true,
      });
    } catch (error) {
      console.error('[Inbox] erro ao buscar sugestão:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  /**
   * POST /api/orkto/approvals/:approvalId/approve
   * Aprova uma sugestão de ação.
   */
  router.post('/approvals/:approvalId/approve', async (req, res) => {
    try {
      const { approvalId } = req.params;
      const { workspaceId, userId } = req.body;
      
      res.json({
        success: true,
        approvalId,
        status: 'approved',
        action: {
          type: 'respond',
          description: 'Resposta aprovada pelo operador',
          message: 'Olá! Tudo bem? Como posso ajudar você hoje?',
        },
        simulated: true,
        warning: 'Modo homologação - mensagem não foi enviada',
      });
    } catch (error) {
      console.error('[Inbox] erro ao aprovar:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  /**
   * POST /api/orkto/approvals/:approvalId/reject
   * Rejeita uma sugestão de ação.
   */
  router.post('/approvals/:approvalId/reject', async (req, res) => {
    try {
      const { approvalId } = req.params;
      const { reason } = req.body;
      
      res.json({
        success: true,
        approvalId,
        status: 'rejected',
        rejectionReason: reason || 'Rejeitada pelo operador',
        simulated: true,
      });
    } catch (error) {
      console.error('[Inbox] erro ao rejeitar:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  /**
   * POST /api/orkto/approvals/:approvalId/edit
   * Edita o texto de uma sugestão antes de aprovar.
   */
  router.post('/approvals/:approvalId/edit', async (req, res) => {
    try {
      const { approvalId } = req.params;
      const { editedText, workspaceId, userId } = req.body;
      
      res.json({
        success: true,
        approvalId,
        status: 'edited',
        editedText,
        action: {
          type: 'respond',
          description: 'Resposta editada e pendente de nova aprovação',
          message: editedText,
        },
        simulated: true,
      });
    } catch (error) {
      console.error('[Inbox] erro ao editar:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  // ============================================================
  // Central de Bots
  // ============================================================
  
  /**
   * GET /api/orkto/bots
   * Lista de bots com status e configurações.
   */
  router.get('/bots', async (req, res) => {
    try {
      const { workspaceId } = req.query;
      
      const mockBots = [
        {
          id: 'bot-hunter',
          name: 'Hunter',
          slug: 'hunter',
          description: 'Primeiro contato, qualificação e manuseio de objecões',
          avatar_url: null,
          status: 'running',
          trustLevel: 2, // Sugerindo
          capabilities: ['respond', 'qualify', 'handle_objection'],
          lastRunAt: new Date().toISOString(),
          stats: {
            totalRuns: 15,
            successfulRuns: 14,
            failedRuns: 1,
            avgLatencyMs: 250,
          },
        },
        {
          id: 'bot-farmer',
          name: 'Farmer',
          slug: 'farmer',
          description: 'Relacionamento, pos-venda e upsell',
          avatar_url: null,
          status: 'running',
          trustLevel: 1, // Observando
          capabilities: ['respond', 'followup', 'upsell'],
          lastRunAt: null,
          stats: {
            totalRuns: 0,
            successfulRuns: 0,
            failedRuns: 0,
            avgLatencyMs: 0,
          },
        },
        {
          id: 'bot-recovery',
          name: 'Recovery Bot',
          slug: 'recovery',
          description: 'Recuperar propostas paradas',
          avatar_url: null,
          status: 'stopped',
          trustLevel: 1, // Observando
          capabilities: ['respond', 'followup', 'stop_sequence'],
          lastRunAt: null,
          stats: {
            totalRuns: 0,
            successfulRuns: 0,
            failedRuns: 0,
            avgLatencyMs: 0,
          },
        },
        {
          id: 'bot-collection',
          name: 'Collection Analyst',
          slug: 'collection',
          description: 'Identificar motivo do atraso e negociar',
          avatar_url: null,
          status: 'running',
          trustLevel: 1, // Observando
          capabilities: ['respond', 'payment_planning'],
          lastRunAt: new Date().toISOString(),
          stats: {
            totalRuns: 3,
            successfulRuns: 3,
            failedRuns: 0,
            avgLatencyMs: 320,
          },
        },
        {
          id: 'bot-risk',
          name: 'Risk Analyst',
          slug: 'risk',
          description: 'Calcular e explicar sinais de risco',
          avatar_url: null,
          status: 'running',
          trustLevel: 1, // Observando
          capabilities: ['risk_analysis', 'create_task', 'recommend'],
          lastRunAt: new Date().toISOString(),
          stats: {
            totalRuns: 8,
            successfulRuns: 8,
            failedRuns: 0,
            avgLatencyMs: 180,
          },
        },
      ];
      
      res.json({
        success: true,
        bots: mockBots,
        simulated: true,
      });
    } catch (error) {
      console.error('[Inbox] erro ao listar bots:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  /**
   * POST /api/orkto/bots/:botId/pause
   * Pausa um bot.
   */
  router.post('/bots/:botId/pause', async (req, res) => {
    try {
      const { botId } = req.params;
      
      res.json({
        success: true,
        botId,
        status: 'paused',
        message: `Bot ${botId} pausado`,
        simulated: true,
      });
    } catch (error) {
      console.error('[Inbox] erro ao pausar bot:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  /**
   * POST /api/orkto/bots/:botId/resume
   * Retoma um bot pausado.
   */
  router.post('/bots/:botId/resume', async (req, res) => {
    try {
      const { botId } = req.params;
      
      res.json({
        success: true,
        botId,
        status: 'running',
        message: `Bot ${botId} retomado`,
        simulated: true,
      });
    } catch (error) {
      console.error('[Inbox] erro ao retomar bot:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  // ============================================================
  // Painel Operacional (Hoje)
  // ============================================================
  
  /**
   * GET /api/orkto/dashboard
   * Painel "Hoje" com resumo operacional.
   */
  router.get('/dashboard', async (req, res) => {
    try {
      const { workspaceId } = req.query;
      
      res.json({
        success: true,
        dashboard: {
          health: {
            channels: { whatsapp: 'healthy', email: 'healthy' },
            hermesAgent: 'mock-active',
            lastSync: new Date().toISOString(),
          },
          pendingApprovals: [
            { id: 'app-001', conversationId: 'conv-001', type: 'suggestion', priority: 'high' },
            { id: 'app-002', conversationId: 'conv-002', type: 'discount', priority: 'medium' },
          ],
          opportunities: [
            { id: 'opp-001', contactName: 'Maria Silva', value: 5000, stage: 'proposal_sent' },
            { id: 'opp-002', contactName: 'Pedrão LTDA', value: 12000, stage: 'negotiation' },
          ],
          atRisk: [
            { id: 'risk-001', contactName: 'João Santos', value: 3000, reason: 'Sem resposta há 3 dias' },
          ],
          stalledProposals: [
            { id: 'prop-001', quoteNumber: '260918-ABC1234', clientName: 'Empreendimento S/A', daysPending: 7 },
          ],
          dailySummary: 'Hoje você tem 2 aprovações pendentes, 2 oportunidades para avançar e 1 cobrança em risco.',
          recentBotActivity: [
            { bot: 'Hunter', action: 'suggest', conversation: 'conv-001', time: '2 min ago' },
            { bot: 'Risk Analyst', action: 'analyze', conversation: 'conv-002', time: '15 min ago' },
          ],
        },
        simulated: true,
      });
    } catch (error) {
      console.error('[Inbox] erro ao carregar dashboard:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  // Registrar rotas
  app.use('/api/orkto', router);
}
