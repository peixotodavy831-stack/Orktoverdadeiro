/**
 * PolicyEngine - Motor de Políticas de Autonomia
 * 
 * Aplica regras de autonomia, horário, consentimento, limites de desconto
 * e níveis de confiança antes de qualquer ação de bot.
 */

// Tipos de contrato
export interface PolicyContext {
  workspaceId: string;
  conversationId?: string;
  contactId?: string;
  channel: 'whatsapp' | 'telegram' | 'email' | 'direct';
  action: ActionProposal;
  agentId?: string;
  agentType?: string;
  trustLevel: number; // 1-4
  currentHour?: number;
  timezone?: string;
  contactConsents?: ContactConsent[];
  planLimits?: PlanLimits;
}

export interface ContactConsent {
  channel: string;
  consentType: 'marketing' | 'service' | 'payment' | 'all';
  grantedAt: string;
  revokedAt?: string;
}

export interface PlanLimits {
  maxDiscountPercent: number;
  botAutonomyLevel: number;
  maxConcurrentActions: number;
}

export interface ActionProposal {
  actionType: 'respond' | 'send_message' | 'discount' | 'create_task' | 'update_quote' | 'schedule_followup' | 'escalate' | 'pause' | 'transfer_to_human' | 'log';
  description: string;
  payload: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requiresApproval: boolean;
}

export interface PolicyDecision {
  allowed: boolean;
  level: 'execute' | 'suggest' | 'require_approval' | 'denied';
  reason: string;
  policiesChecked: string[];
  violations: PolicyViolation[];
}

export interface PolicyViolation {
  policy: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

export interface PolicyResult {
  decision: PolicyDecision;
  actionId: string;
  timestamp: string;
  traceId: string;
}

// ============================================================
// Implementação do Policy Engine
// ============================================================

export class PolicyEngine {
  private audits: Array<{
    timestamp: string;
    context: PolicyContext;
    decision: PolicyDecision;
    traceId: string;
  }> = [];

  constructor() {
    console.log('[PolicyEngine] Inicializado');
  }

  private generateTraceId(): string {
    return `policy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private logAudit(context: PolicyContext, decision: PolicyDecision, traceId: string): void {
    this.audits.push({
      timestamp: new Date().toISOString(),
      context: this.sanitizeContext(context),
      decision,
      traceId,
    });
    console.log(`[PolicyEngine.Audit] ${decision.level} - ${decision.reason}`);
  }

  private sanitizeContext(context: PolicyContext): PolicyContext {
    // Remove dados sensíveis do audit
    const { contactId, ...rest } = context;
    return rest as PolicyContext;
  }

  getAuditLog(): readonly { timestamp: string; context: PolicyContext; decision: PolicyDecision; traceId: string }[] {
    return this.audits;
  }

  clearAuditLog(): void {
    this.audits = [];
  }

  async evaluate(
    action: ActionProposal,
    context: PolicyContext
  ): Promise<PolicyResult> {
    const traceId = this.generateTraceId();
    const policiesChecked: string[] = [];
    const violations: PolicyViolation[] = [];

    // 1. Política de Horário
    const timePolicy = this.checkTimePolicy(context);
    policiesChecked.push('time_window');
    if (!timePolicy.allowed) {
      violations.push(timePolicy.violation);
    }

    // 2. Política de Consentimento
    const consentPolicy = this.checkConsentPolicy(context);
    policiesChecked.push('consent');
    if (!consentPolicy.allowed) {
      violations.push(consentPolicy.violation);
    }

    // 3. Política de Limite Comercial (desconto)
    const discountPolicy = this.checkDiscountPolicy(action, context);
    policiesChecked.push('discount_limit');
    if (!discountPolicy.allowed) {
      violations.push(discountPolicy.violation);
    }

    // 4. Política de Risco (ações de risco)
    const riskPolicy = this.checkRiskPolicy(action, context);
    policiesChecked.push('risk_control');
    if (!riskPolicy.allowed) {
      violations.push(riskPolicy.violation);
    }

    // 5. Política de Nível de Autonomia
    const autonomyPolicy = this.checkAutonomyPolicy(action, context);
    policiesChecked.push('autonomy_level');
    if (!autonomyPolicy.allowed) {
      violations.push(autonomyPolicy.violation);
    }

    // Decisão final
    const hasViolations = violations.some(v => v.severity === 'error');
    const hasWarnings = violations.some(v => v.severity === 'warning');
    
    let level: PolicyDecision['level'];
    let allowed: boolean;
    let reason: string;

    if (hasViolations) {
      level = 'denied';
      allowed = false;
      reason = `Ação não autorizada: ${violations.filter(v => v.severity === 'error').map(v => v.message).join('; ')}`;
    } else if (hasWarnings || action.requiresApproval || context.trustLevel < 3) {
      level = action.requiresApproval || context.trustLevel < 3 ? 'require_approval' : 'suggest';
      allowed = true;
      reason = hasWarnings 
        ? `Ação permitida com ressalvas: ${violations.map(v => v.message).join('; ')}`
        : 'Ação requer aprovação humana';
    } else {
      level = 'execute';
      allowed = true;
      reason = 'Ação autorizada pelos políticas';
    }

    const decision: PolicyDecision = {
      allowed,
      level,
      reason,
      policiesChecked,
      violations,
    };

    this.logAudit(context, decision, traceId);

    return {
      decision,
      actionId: traceId,
      timestamp: new Date().toISOString(),
      traceId,
    };
  }

  private checkTimePolicy(context: PolicyContext): { allowed: boolean; violation?: PolicyViolation } {
    if (!context.currentHour || !context.timezone) {
      return { allowed: true }; // Sem restrição se não configurado
    }

    const startHour = 9; // 09:00
    const endHour = 18;  // 18:00
    
    // Simplificando: apenas verificação de horário
    // Em produção, usar timezone real
    if (context.currentHour < startHour || context.currentHour >= endHour) {
      return {
        allowed: false,
        violation: {
          policy: 'time_window',
          severity: 'warning',
          message: `Ação fora da janela de operação (${startHour}:00-${endHour}:00). Aguardando janela ou requerendo aprovação.`,
          details: { currentHour: context.currentHour, startHour, endHour },
        },
      };
    }

    return { allowed: true };
  }

  private checkConsentPolicy(context: PolicyContext): { allowed: boolean; violation?: PolicyViolation } {
    if (!context.contactConsents || context.contactConsents.length === 0) {
      return { allowed: true }; // Sem consentimento registrado não bloqueia
    }

    const actionChannel = context.channel;
    const hasConsent = context.contactConsents.some(c => 
      c.channel === actionChannel && 
      (!c.revokedAt) &&
      (c.consentType === 'all' || c.consentType === 'service')
    );

    if (!hasConsent) {
      return {
        allowed: false,
        violation: {
          policy: 'consent',
          severity: 'error',
          message: `Sem consentimento para canal ${actionChannel}. Não pode executar ação.`,
          details: { requiredChannel: actionChannel, consents: context.contactConsents.map(c => ({ channel: c.channel, type: c.consentType, revoked: !!c.revokedAt })) },
        },
      };
    }

    return { allowed: true };
  }

  private checkDiscountPolicy(action: ActionProposal, context: PolicyContext): { allowed: boolean; violation?: PolicyViolation } {
    if (action.actionType !== 'discount') {
      return { allowed: true };
    }

    const maxDiscount = context.planLimits?.maxDiscountPercent ?? 10;
    const discountAmount = action.payload?.discount ?? action.payload?.discountPercent ?? 0;
    const numericDiscount = typeof discountAmount === 'number' ? discountAmount : Number(discountAmount) || 0;

    if (numericDiscount > maxDiscount) {
      return {
        allowed: false,
        violation: {
          policy: 'discount_limit',
          severity: 'error',
          message: `Desconto de ${numericDiscount}% excede limite de ${maxDiscount}% do plano. Requer aprovação humana.`,
          details: { requestedDiscount: numericDiscount, maxDiscount },
        },
      };
    }

    return { allowed: true };
  }

  private checkRiskPolicy(action: ActionProposal, context: PolicyContext): { allowed: boolean; violation?: PolicyViolation } {
    const riskActions = ['escalate', 'transfer_to_human', 'pause'];
    
    if (!riskActions.includes(action.actionType)) {
      return { allowed: true };
    }

    // Ações de risco sempre requerem aprovação
    if (context.trustLevel < 3) {
      return {
        allowed: true, // Não bloqueia, mas requirement de aprovação
        violation: {
          policy: 'risk_control',
          severity: 'warning',
          message: `Ação de risco "${action.actionType}" requer aprovação humana.`,
          details: { actionType: action.actionType, trustLevel: context.trustLevel },
        },
      };
    }

    return { allowed: true };
  }

  private checkAutonomyPolicy(action: ActionProposal, context: PolicyContext): { allowed: boolean; violation?: PolicyViolation } {
    // Níveis de autonomia
    // 1 = Observando (só registra)
    // 2 = Sugerindo (cria rascunho)
    // 3 = Autonomia Limitada (executa playbooks)
    // 4 = Autonomia Ampliada (executa com_restrainte)
    
    const autonomyRequirements: Record<string, number> = {
      respond: 1,
      send_message: 2,
      discount: 3,
      create_task: 1,
      update_quote: 2,
      schedule_followup: 2,
      escalate: 3,
      pause: 3,
      transfer_to_human: 3,
      log: 1,
    };

    const requiredLevel = autonomyRequirements[action.actionType] ?? 2;
    
    if (context.trustLevel < requiredLevel) {
      return {
        allowed: false,
        violation: {
          policy: 'autonomy_level',
          severity: 'warning',
          message: `Nível de autonomia (${context.trustLevel}) insuficiente para "${action.actionType}" (requer ${requiredLevel}).`,
          details: { actionType: action.actionType, trustLevel: context.trustLevel, requiredLevel },
        },
      };
    }

    return { allowed: true };
  }

  async canExecute(
    action: ActionProposal,
    context: PolicyContext
  ): Promise<PolicyDecision> {
    const result = await this.evaluate(action, context);
    return result.decision;
  }

  async recordExecution(
    execution: {
      actionId: string;
      actionType: string;
      status: string;
      timestamp: string;
      traceId: string;
      policiesApplied: string[];
      result?: Record<string, unknown>;
    }
  ): Promise<void> {
    console.log('[PolicyEngine] Execução registrada:', execution);
    // Em produção, escreveria no audit_log do Supabase
  }

  async getAutonomyLevel(
    _botId: string,
    _capability: string
  ): Promise<number> {
    // Em produção, buscaría no agent_configs
    return 1; // Default: observando
  }
}

// ============================================================
// Factory
// ============================================================

let policyEngineInstance: PolicyEngine | null = null;

export function getPolicyEngine(): PolicyEngine {
  if (!policyEngineInstance) {
    policyEngineInstance = new PolicyEngine();
  }
  return policyEngineInstance;
}

export function resetPolicyEngine(): void {
  policyEngineInstance = null;
}
