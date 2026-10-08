export type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent';
export type MoodRing = 'ENGAGED' | 'NEUTRAL' | 'STUCK' | 'LOYAL';
export type CollectionStatus = 'OPEN' | 'CONTACTED' | 'NEGOTIATING' | 'PROMISED' | 'PAID' | 'ESCALATED' | 'CLOSED';
export type SwarmAgent = 'qualification_agent' | 'sales_agent' | 'objection_agent' | 'followup_agent' | 'recovery_agent' | 'collection_agent' | 'risk_agent' | 'reporting_agent' | 'customer_success_agent';

export interface PriorityInput {
  valueCents?: number;
  urgency?: 'low' | 'normal' | 'high' | 'urgent';
  minutesWaiting?: number;
  recurringCustomer?: boolean;
  stage?: string;
  riskScore?: number;
  slaMinutes?: number;
  intent?: 'buy' | 'support' | 'objection' | 'payment' | 'unknown';
  override?: PriorityLevel | null;
}

export interface PriorityResult {
  score: number;
  level: PriorityLevel;
  reasons: string[];
  overridden: boolean;
}

export function classifyConversationSignals(text?: string | null): {
  intent: NonNullable<PriorityInput['intent']>;
  urgency: NonNullable<PriorityInput['urgency']>;
  signals: string[];
} {
  const value = normalized(text);
  const signals: string[] = [];
  const urgency: NonNullable<PriorityInput['urgency']> = /\b(urgente|hoje|agora|parado|emergencia|emergencial|socorro)\b/.test(value)
    ? 'urgent'
    : /\b(preciso rapido|o quanto antes|ainda hoje|prioridade)\b/.test(value) ? 'high' : 'normal';
  if (urgency !== 'normal') signals.push(`Urgência identificada na mensagem (${urgency}).`);

  const intent: NonNullable<PriorityInput['intent']> = /\b(pagar|pagamento|boleto|pix|vencido|cobranca)\b/.test(value) ? 'payment'
    : /\b(caro|desconto|nao gostei|obje[cç][aã]o|duvida|preocupado)\b/.test(value) ? 'objection'
      : /\b(comprar|quero|contratar|orcamento|proposta|pre[cç]o|disponivel)\b/.test(value) ? 'buy'
        : /\b(ajuda|problema|suporte|defeito|erro)\b/.test(value) ? 'support' : 'unknown';
  if (intent !== 'unknown') signals.push(`Intenção identificada: ${intent}.`);
  return { intent, urgency, signals };
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const normalized = (value?: string | null) => value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() ?? '';

export function rankConversation(input: PriorityInput): PriorityResult {
  if (input.override) return { score: input.override === 'urgent' ? 100 : input.override === 'high' ? 75 : input.override === 'normal' ? 45 : 15, level: input.override, reasons: ['Prioridade ajustada manualmente.'], overridden: true };
  const reasons: string[] = [];
  let score = 0;
  const urgencyPoints = { low: 0, normal: 8, high: 22, urgent: 35 };
  const urgency = input.urgency ?? 'normal';
  score += urgencyPoints[urgency];
  if (urgency === 'urgent' || urgency === 'high') reasons.push(`Urgência marcada como ${urgency === 'urgent' ? 'urgente' : 'alta'}.`);
  const amount = Math.max(0, input.valueCents ?? 0);
  if (amount > 0) { score += Math.min(25, Math.log10(amount / 100 + 1) * 8); reasons.push('Há valor comercial associado.'); }
  const waiting = Math.max(0, input.minutesWaiting ?? 0);
  if (waiting >= (input.slaMinutes ?? 60)) { score += 22; reasons.push('O tempo de espera ultrapassou o SLA.'); }
  else if (waiting >= 30) { score += 10; reasons.push('A conversa está aguardando há algum tempo.'); }
  if (input.recurringCustomer) { score += 8; reasons.push('Cliente recorrente.'); }
  if (input.intent === 'buy') { score += 12; reasons.push('Intenção de compra identificada.'); }
  if (input.intent === 'payment') { score += 8; reasons.push('Assunto financeiro requer acompanhamento.'); }
  if (input.intent === 'objection') { score += 7; reasons.push('Objeção comercial identificada.'); }
  const risk = clamp(input.riskScore ?? 0);
  if (risk >= 70) { score += 12; reasons.push('Sinal de risco elevado requer revisão.'); }
  else if (risk >= 40) { score += 5; reasons.push('Há sinais moderados de risco.'); }
  if (input.stage === 'negotiation' || input.stage === 'proposal') { score += 5; reasons.push('Negociação/proposta ativa.'); }
  score = Math.round(clamp(score));
  const level: PriorityLevel = score >= 75 ? 'urgent' : score >= 50 ? 'high' : score >= 25 ? 'normal' : 'low';
  return { score, level, reasons: reasons.length ? reasons : ['Nenhum sinal prioritário disponível.'], overridden: false };
}

export interface RiskSignal { type: 'overdue_payment' | 'missed_promise' | 'proposal_unanswered' | 'long_silence' | 'repeat_buyer' | 'positive_payment_history' | 'explicit_opt_out'; severity?: number; observedAt?: string }
export interface RiskAssessment { score: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; confidence: number; reasons: string[]; recommendedAction: 'continue_normally' | 'human_review' | 'pause_contact'; signals: RiskSignal[]; engineVersion: string }

export function assessOperationalRisk(signals: RiskSignal[]): RiskAssessment {
  const weights: Record<RiskSignal['type'], number> = {
    overdue_payment: 28, missed_promise: 24, proposal_unanswered: 10, long_silence: 8,
    repeat_buyer: -8, positive_payment_history: -12, explicit_opt_out: 0,
  };
  const unique = [...new Map(signals.map(signal => [`${signal.type}:${signal.observedAt ?? ''}`, signal])).values()];
  const score = Math.round(clamp(unique.reduce((sum, signal) => sum + (weights[signal.type] * clamp(signal.severity ?? 1, 0, 2)), 0)));
  const confidence = Number(Math.min(0.95, unique.length ? 0.3 + unique.length * 0.12 : 0).toFixed(2));
  const reasons = unique.map(signal => ({
    overdue_payment: 'Pagamento vencido registrado', missed_promise: 'Promessa de pagamento não cumprida',
    proposal_unanswered: 'Proposta sem resposta', long_silence: 'Período sem interação', repeat_buyer: 'Histórico de recompra',
    positive_payment_history: 'Histórico de pagamentos em dia', explicit_opt_out: 'Cliente pediu para interromper contato',
  }[signal.type]));
  const optOut = unique.some(signal => signal.type === 'explicit_opt_out');
  const riskLevel: RiskAssessment['riskLevel'] = score >= 85 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';
  return {
    score, riskLevel, confidence, reasons: [...new Set(reasons)], signals: unique, engineVersion: 'operational-risk-v1',
    recommendedAction: optOut ? 'pause_contact' : score >= 60 ? 'human_review' : 'continue_normally',
  };
}

export function deriveMoodRing(input: { replyRate?: number; responseMinutes?: number; positiveSignals?: number; negativeSignals?: number; completedPurchases?: number }): { state: MoodRing; explanation: string; reasons: string[]; signals: string[]; confidence: number } {
  const replyRate = clamp(input.replyRate ?? 0, 0, 1);
  const positive = Math.max(0, input.positiveSignals ?? 0);
  const negative = Math.max(0, input.negativeSignals ?? 0);
  const purchases = Math.max(0, input.completedPurchases ?? 0);
  const state: MoodRing = purchases >= 3 && positive >= negative ? 'LOYAL'
    : negative >= 2 || ((input.responseMinutes ?? 0) > 10_080 && replyRate < 0.2) ? 'STUCK'
      : replyRate >= 0.7 && positive > 0 ? 'ENGAGED' : 'NEUTRAL';
  const explanation = state === 'LOYAL' ? 'Histórico consistente de compras e sinais positivos.'
    : state === 'ENGAGED' ? 'Respostas frequentes e sinais positivos recentes.'
      : state === 'STUCK' ? 'A conversa perdeu ritmo ou acumulou sinais de bloqueio.'
        : 'Ainda não há sinais suficientes para classificar a relação.';
  const signals = [purchases ? `${purchases} compras concluídas` : '', input.responseMinutes ? `última resposta há ${input.responseMinutes} min` : '', positive ? `${positive} sinais positivos` : '', negative ? `${negative} sinais de bloqueio` : ''].filter(Boolean);
  const evidenceCount = [input.replyRate !== undefined, input.responseMinutes !== undefined, positive > 0, negative > 0, purchases > 0].filter(Boolean).length;
  const confidence = Number(Math.min(0.9, evidenceCount ? 0.25 + evidenceCount * 0.13 : 0).toFixed(2));
  const reasons = signals.length ? signals : ['Ainda não há sinais operacionais suficientes para uma classificação confiável.'];
  return { state, explanation, reasons, signals, confidence };
}

export function scoreOperationalAnxiety(input: { responseMinutes?: number; messagesLastDay?: number; urgencyWords?: number; patternChange?: number }): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  if ((input.urgencyWords ?? 0) > 0) { score += Math.min(35, (input.urgencyWords ?? 0) * 12); signals.push('urgência textual'); }
  if ((input.patternChange ?? 0) >= 0.5) { score += 20; signals.push('mudança recente no padrão de contato'); }
  if ((input.messagesLastDay ?? 0) >= 5) { score += 15; signals.push('frequência de mensagens acima do padrão'); }
  if ((input.responseMinutes ?? 0) > 1_440) { score += 10; signals.push('tempo de resposta elevado'); }
  return { score: Math.round(clamp(score)), signals };
}

export interface PurchaseEvent { purchasedAt: string; amountCents: number; productKey?: string }
export function estimateRepurchaseWindow(purchases: PurchaseEvent[], now = new Date()): { estimatedAt: string | null; confidence: number; intervalDays: number | null; eligible: boolean; windowOpen: boolean; reason: string } {
  const dates = purchases.map(p => new Date(p.purchasedAt)).filter(date => Number.isFinite(date.getTime())).sort((a, b) => a.getTime() - b.getTime());
  if (dates.length < 3) return { estimatedAt: null, confidence: 0, intervalDays: null, eligible: false, windowOpen: false, reason: 'Histórico insuficiente: são necessárias ao menos três compras para estimar o ciclo.' };
  const intervals = dates.slice(1).map((date, index) => (date.getTime() - dates[index].getTime()) / 86_400_000).filter(days => days > 0 && days <= 730);
  if (intervals.length < 2) return { estimatedAt: null, confidence: 0, intervalDays: null, eligible: false, windowOpen: false, reason: 'Não foi possível encontrar ciclos de recompra válidos.' };
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const deviations = sorted.map(value => Math.abs(value - median)).sort((a, b) => a - b);
  const deviationRatio = deviations[Math.floor(deviations.length / 2)] / Math.max(1, median);
  const confidence = Number(clamp(0.45 + Math.min(intervals.length, 5) * 0.08 - deviationRatio * 0.5, 0, 0.9).toFixed(2));
  const estimated = new Date(dates[dates.length - 1].getTime() + median * 86_400_000);
  const eligible = confidence >= 0.65;
  const windowOpen = estimated <= now;
  return { estimatedAt: estimated.toISOString(), confidence, intervalDays: Math.round(median), eligible, windowOpen, reason: !eligible ? 'Confiança abaixo do limite; revisão humana recomendada.' : windowOpen ? 'Janela de recompra aberta, calculada a partir de compras observadas.' : 'Próxima janela estimada a partir de compras observadas.' };
}

export function estimateRepurchaseByProduct(purchases: PurchaseEvent[], now = new Date()) {
  const grouped = new Map<string, PurchaseEvent[]>();
  for (const purchase of purchases) {
    const key = purchase.productKey?.trim() || 'all';
    grouped.set(key, [...(grouped.get(key) || []), purchase]);
  }
  return [...grouped.entries()].map(([productKey, events]) => ({ productKey, ...estimateRepurchaseWindow(events, now) }));
}

export interface ReplayMessageEvidence { id?: string; direction: 'incoming' | 'outgoing'; content: string; sentAt?: string }
export function identifyReplayCandidate(messages: ReplayMessageEvidence[]): { objectionType: string; strategy: string; responseText: string; objectionMessageId: string | null; responseMessageId: string | null } | null {
  const ordered = [...messages].sort((a, b) => new Date(a.sentAt || 0).getTime() - new Date(b.sentAt || 0).getTime());
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const incoming = ordered[index];
    if (incoming.direction !== 'incoming') continue;
    const text = normalized(incoming.content);
    const objectionType = /\b(caro|preco|valor|desconto|orcamento alto)\b/.test(text) ? 'price'
      : /\b(vou pensar|depois|agora nao|sem tempo|mais tarde)\b/.test(text) ? 'timing'
        : /\b(duvida|garantia|confianca|nao conheco|como funciona)\b/.test(text) ? 'trust_or_clarity'
          : null;
    if (!objectionType) continue;
    const response = ordered.slice(index + 1).find(item => item.direction === 'outgoing' && item.content.trim());
    if (!response) continue;
    const responseText = normalized(response.content);
    const strategy = /\b(parcel|op[cç][aã]o|alternativa|condi[cç][aã]o)\b/.test(responseText) ? 'offer_options'
      : /\b(garantia|inclui|benef[ií]cio|resultado|qualidade)\b/.test(responseText) ? 'explain_value'
        : /\b(agend|marc|pr[oó]ximo passo|posso ajudar)\b/.test(responseText) ? 'propose_next_step'
          : 'direct_response';
    return { objectionType, strategy, responseText: response.content.trim().slice(0, 2000), objectionMessageId: incoming.id || null, responseMessageId: response.id || null };
  }
  return null;
}

export function deriveMessageMemoryCandidates(input: { messageId: string; conversationId: string; direction: 'incoming' | 'outgoing'; content: string; occurredAt: string }): Array<{ type: 'raw_event' | 'preference'; content: Record<string, unknown>; confidence: number; idempotencyKey: string }> {
  if (input.direction !== 'incoming') return [];
  const candidates: Array<{ type: 'raw_event' | 'preference'; content: Record<string, unknown>; confidence: number; idempotencyKey: string }> = [{
    type: 'raw_event', content: { eventType: 'incoming_message', messageId: input.messageId, conversationId: input.conversationId, occurredAt: input.occurredAt },
    confidence: 1, idempotencyKey: `message:${input.messageId}:raw_event`,
  }];
  const text = normalized(input.content);
  const morning = /\b(prefiro|prefere|pode ser)\b.{0,50}\b(contato|falar|ligar|mensagem|mensagens)\b.{0,40}\b(manha|cedo)\b/.test(text);
  const afternoon = /\b(prefiro|prefere|pode ser)\b.{0,50}\b(contato|falar|ligar|mensagem|mensagens)\b.{0,40}\b(tarde)\b/.test(text);
  const evening = /\b(prefiro|prefere|pode ser)\b.{0,50}\b(contato|falar|ligar|mensagem|mensagens)\b.{0,40}\b(noite)\b/.test(text);
  const contactWindow = morning ? 'morning' : afternoon ? 'afternoon' : evening ? 'evening' : null;
  if (contactWindow) candidates.push({ type: 'preference', content: { contactWindow }, confidence: 0.9, idempotencyKey: `message:${input.messageId}:preference:contact_window` });
  return candidates;
}

export interface RecoveryStopState { customerReplied?: boolean; dealClosed?: boolean; optedOut?: boolean; automationDisabled?: boolean; activeQuote?: boolean }
export function recoveryStopReason(state: RecoveryStopState): string | null {
  if (state.optedOut) return 'opt_out';
  if (state.customerReplied) return 'customer_replied';
  if (state.dealClosed) return 'deal_closed';
  if (state.automationDisabled) return 'automation_disabled';
  if (!state.activeQuote) return 'quote_inactive';
  return null;
}

export function buildRecoverySchedule(startAt: Date, offsetsDays: number[] = [1, 4, 10, 30, 90]): Array<{ step: string; dueAt: string }> {
  if (!Number.isFinite(startAt.getTime()) || offsetsDays.length > 10 || offsetsDays.some((day, index) => !Number.isInteger(day) || day <= 0 || (index > 0 && day <= offsetsDays[index - 1]))) throw new Error('Cadência de recuperação inválida.');
  return offsetsDays.map(day => ({ step: `D+${day}`, dueAt: new Date(startAt.getTime() + day * 86_400_000).toISOString() }));
}

const collectionTransitions: Record<CollectionStatus, ReadonlySet<CollectionStatus>> = {
  OPEN: new Set(['CONTACTED','PAID','CLOSED']), CONTACTED: new Set(['NEGOTIATING','PROMISED','PAID','ESCALATED','CLOSED']),
  NEGOTIATING: new Set(['PROMISED','PAID','ESCALATED','CLOSED']), PROMISED: new Set(['PAID','ESCALATED','CLOSED']),
  PAID: new Set(['CLOSED']), ESCALATED: new Set(['NEGOTIATING','PROMISED','PAID','CLOSED']), CLOSED: new Set(),
};
export function transitionCollection(current: CollectionStatus, next: CollectionStatus): void {
  if (!collectionTransitions[current].has(next)) throw new Error(`Transição de cobrança inválida: ${current} → ${next}.`);
}

export function routeSwarmAgent(text: string, context: { overdueAmountCents?: number; reportRequest?: boolean } = {}): SwarmAgent {
  const value = normalized(text);
  if (context.reportRequest || /\b(relatorio|vendas ca[iu]|resultado|desempenho)\b/.test(value)) return 'reporting_agent';
  if ((context.overdueAmountCents ?? 0) > 0 || /\b(cobrar|cobranca|pagamento vencido|boleto vencido)\b/.test(value)) return 'collection_agent';
  if (/\b(risco|inadimpl|calote|perigo)\b/.test(value)) return 'risk_agent';
  if (/\b(obje[cç][aã]o|caro|muito caro|nao gostei|não gostei)\b/.test(value)) return 'objection_agent';
  if (/\b(sumiu|sem resposta|abandon|recuperar proposta)\b/.test(value)) return 'recovery_agent';
  if (/\b(acompanhar|follow.?up|retornar|retorno)\b/.test(value)) return 'followup_agent';
  if (/\b(pre[cç]o|proposta|orcamento|or[cç]amento|vender|comprar)\b/.test(value)) return 'sales_agent';
  if (/\b(cliente fiel|reativar|recompra|renovar)\b/.test(value)) return 'customer_success_agent';
  return 'qualification_agent';
}

export interface CustomerMatchInput { id: string; name?: string; phone?: string; email?: string; address?: string }
const digits = (value?: string) => (value ?? '').replace(/\D/g, '');
export function compareCustomers(left: CustomerMatchInput, right: CustomerMatchInput): { status: 'MATCH' | 'POSSIBLE_MATCH' | 'NO_MATCH'; score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  const aPhone = digits(left.phone); const bPhone = digits(right.phone);
  if (aPhone.length >= 8 && aPhone === bPhone) { score += 55; signals.push('telefone igual'); }
  const aEmail = normalized(left.email); const bEmail = normalized(right.email);
  if (aEmail && aEmail === bEmail) { score += 55; signals.push('e-mail igual'); }
  const aName = normalized(left.name); const bName = normalized(right.name);
  if (aName.length >= 4 && aName === bName) { score += 25; signals.push('nome igual'); }
  const aAddress = normalized(left.address); const bAddress = normalized(right.address);
  if (aAddress.length >= 8 && aAddress === bAddress) { score += 15; signals.push('endereço igual'); }
  score = Math.min(100, score);
  return { status: score >= 80 ? 'MATCH' : score >= 45 ? 'POSSIBLE_MATCH' : 'NO_MATCH', score, signals };
}

export interface PriceAuditInput { catalogPriceCents: number; proposedPriceCents: number; maxDiscountPercent: number; authorizedDiscountPercent?: number; approverPresent?: boolean }
export function auditProposalPrice(input: PriceAuditInput): { allowed: boolean; discountPercent: number; requiresApproval: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (![input.catalogPriceCents, input.proposedPriceCents].every(value => Number.isSafeInteger(value) && value >= 0) || input.catalogPriceCents <= 0) throw new Error('Valores de preço inválidos.');
  const discountPercent = Math.max(0, (input.catalogPriceCents - input.proposedPriceCents) / input.catalogPriceCents * 100);
  const requiresApproval = discountPercent > (input.authorizedDiscountPercent ?? 0);
  if (discountPercent > input.maxDiscountPercent) reasons.push('Desconto acima do limite comercial configurado.');
  if (requiresApproval && !input.approverPresent) reasons.push('Desconto excede a autorização disponível.');
  return { allowed: reasons.length === 0, discountPercent: Number(discountPercent.toFixed(2)), requiresApproval, reasons };
}

export function aggregateReplay(records: Array<{ objectionType?: string | null; strategy?: string | null; outcome: 'won' | 'lost' | 'pending' | 'unknown' }>, minimumSample = 3) {
  const groups = new Map<string, { objectionType: string; strategy: string; wins: number; losses: number; pending: number }>();
  for (const record of records) {
    if (!record.objectionType || !record.strategy || record.outcome === 'unknown') continue;
    const key = `${normalized(record.objectionType)}|${normalized(record.strategy)}`;
    const group = groups.get(key) ?? { objectionType: record.objectionType, strategy: record.strategy, wins: 0, losses: 0, pending: 0 };
    group[record.outcome === 'won' ? 'wins' : record.outcome === 'lost' ? 'losses' : 'pending'] += 1;
    groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    const resolved = group.wins + group.losses;
    return { ...group, sampleSize: resolved + group.pending, conversionRate: resolved ? Number((group.wins / resolved).toFixed(3)) : null,
      eligibleForRecommendation: resolved >= minimumSample, recommendation: resolved >= minimumSample ? (group.wins / resolved >= 0.5 ? 'Continue testando esta estratégia com revisão humana.' : 'Revise esta estratégia com revisão humana.') : 'Amostra ainda insuficiente.' };
  });
}

export type CollectiveMemoryContribution = {
  workspace_id: string;
  sector_key: string;
  pattern_key: string;
  aggregate: Record<string, unknown>;
  consent_status: 'disabled' | 'staged' | 'approved' | 'retracted';
  contribution_version: number;
  updated_at?: string;
};

const collectivePatternKeys = new Set(['quote_acceptance','response_time']);
const finiteCount = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000 ? value : null;

/**
 * Aggregate only pre-computed, workspace-local numeric summaries. Raw conversation text,
 * contact identifiers, and workspace IDs never leave the returned provenance object.
 * Latest consent state wins so retracting a newer version cannot revive older consent.
 */
export function aggregateCollectiveMemory(contributions: CollectiveMemoryContribution[], minimumCohort = 5) {
  const latestByWorkspaceAndPattern = new Map<string, CollectiveMemoryContribution>();
  for (const contribution of contributions) {
    if (!contribution.workspace_id || !/^[a-z0-9][a-z0-9_-]{0,59}$/.test(contribution.sector_key) || !collectivePatternKeys.has(contribution.pattern_key)) continue;
    if (!Number.isSafeInteger(contribution.contribution_version) || contribution.contribution_version < 1) continue;
    const periodStart = contribution.aggregate.periodStart; const periodEnd = contribution.aggregate.periodEnd;
    if (typeof periodStart !== 'string' || typeof periodEnd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodEnd < periodStart) continue;
    const key = `${contribution.sector_key}:${contribution.pattern_key}:${periodStart}:${periodEnd}:${contribution.workspace_id}`;
    const prior = latestByWorkspaceAndPattern.get(key);
    const newer = !prior || contribution.contribution_version > prior.contribution_version
      || (contribution.contribution_version === prior.contribution_version && String(contribution.updated_at || '') > String(prior.updated_at || ''));
    if (newer) latestByWorkspaceAndPattern.set(key, contribution);
  }

  const groups = new Map<string, CollectiveMemoryContribution[]>();
  for (const contribution of latestByWorkspaceAndPattern.values()) {
    if (contribution.consent_status !== 'approved') continue;
    const key = `${contribution.sector_key}:${contribution.pattern_key}:${contribution.aggregate.periodStart}:${contribution.aggregate.periodEnd}`;
    const group = groups.get(key) || []; group.push(contribution); groups.set(key,group);
  }

  const items = [...groups.values()].filter(group => new Set(group.map(item => item.workspace_id)).size >= minimumCohort).map(group => {
    const sectorKey = group[0].sector_key; const patternKey = group[0].pattern_key;
    const periodStart = String(group[0].aggregate.periodStart); const periodEnd = String(group[0].aggregate.periodEnd);
    const quoteRows = group.map(item => ({ quoteCount:finiteCount(item.aggregate.quoteCount), acceptedQuotes:finiteCount(item.aggregate.acceptedQuotes) })).filter(item => item.quoteCount !== null && item.acceptedQuotes !== null && item.acceptedQuotes <= item.quoteCount);
    const conversationRows = group.map(item => finiteCount(item.aggregate.conversationCount)).filter((value): value is number => value !== null);
    const responseRows = group.map(item => ({ sum:finiteCount(item.aggregate.responseMinutesTotal), samples:finiteCount(item.aggregate.responseSamples) })).filter(item => item.sum !== null && item.samples !== null && item.samples > 0);
    const totalQuotes = quoteRows.reduce((sum,item)=>sum+item.quoteCount!,0);
    const totalAccepted = quoteRows.reduce((sum,item)=>sum+item.acceptedQuotes!,0);
    const responseMinutesTotal = responseRows.reduce((sum,item)=>sum+item.sum!,0);
    const responseSamples = responseRows.reduce((sum,item)=>sum+item.samples!,0);
    const quoteMetricsAllowed = quoteRows.length >= minimumCohort;
    const conversationMetricsAllowed = conversationRows.length >= minimumCohort;
    const responseMetricsAllowed = responseRows.length >= minimumCohort;
    return {
      sectorKey,
      patternKey,
      periodStart,
      periodEnd,
      contributingWorkspaceCount: group.length,
      anonymizationVersion: 'numeric-aggregate-v1',
      aggregate: {
        quoteCount: quoteMetricsAllowed ? totalQuotes : null,
        acceptedQuotes: quoteMetricsAllowed ? totalAccepted : null,
        quoteAcceptanceRate: quoteMetricsAllowed && totalQuotes > 0 ? Number((totalAccepted/totalQuotes).toFixed(4)) : null,
        conversationCount: conversationMetricsAllowed ? conversationRows.reduce((sum,value)=>sum+value,0) : null,
        averageResponseMinutes: responseMetricsAllowed && responseSamples > 0 ? Number((responseMinutesTotal/responseSamples).toFixed(2)) : null,
        metricCohorts: { quotes:quoteRows.length, conversations:conversationRows.length, responseTime:responseRows.length },
      },
      provenance: { algorithm:'workspace-numeric-aggregate-v1', minimumCohort, source:'explicit_workspace_contributions', sourceWorkspaceCount:group.length },
    };
  });

  return { items, eligibleGroupCount:items.length, suppressedGroupCount:groups.size-items.length, minimumCohort };
}

export function validateImportRows(rows: Array<Record<string, unknown>>, requiredFields: string[]) {
  return rows.map((row, index) => {
    const errors = requiredFields.filter(field => typeof row[field] !== 'string' || !String(row[field]).trim()).map(field => `Campo obrigatório ausente: ${field}`);
    const phone = typeof row.phone === 'string' ? digits(row.phone) : '';
    if (row.phone && phone.length < 8) errors.push('Telefone inválido.');
    return { rowNumber: index + 1, valid: errors.length === 0, errors, normalized: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])) };
  });
}

export function classifyImportDuplicates(
  rows: ReturnType<typeof validateImportRows>,
  existingCustomers: CustomerMatchInput[],
) {
  const candidates: Array<CustomerMatchInput & { sourceRow?: number }> = [...existingCustomers];
  return rows.map(row => {
    if (!row.valid) return { ...row, status: 'error' as const, duplicateMatches: [] };
    const candidate = row.normalized;
    const matches = candidates.map(match => ({ match, result: compareCustomers(
      { id: 'import-preview', name: String(candidate.name || ''), phone: String(candidate.phone || ''), address: String(candidate.company || '') },
      match,
    ) })).filter(entry => entry.result.status !== 'NO_MATCH').sort((a, b) => b.result.score - a.result.score).slice(0, 5);
    const duplicate = matches.length > 0;
    const result = {
      ...row,
      status: duplicate ? 'duplicate' as const : 'valid' as const,
      errors: duplicate ? ['Possível duplicidade: revisar antes de importar.'] : row.errors,
      duplicateMatches: matches.map(({ match, result: comparison }) => ({
        clientId: match.sourceRow ? null : match.id,
        rowNumber: match.sourceRow || null,
        name: match.name || 'Cliente sem nome',
        status: comparison.status,
        score: comparison.score,
        signals: comparison.signals,
      })),
    };
    if (!duplicate) candidates.push({ id: `csv-${row.rowNumber}`, name: String(candidate.name || ''), phone: String(candidate.phone || ''), address: String(candidate.company || ''), sourceRow: row.rowNumber });
    return result;
  });
}

export function computeOperationalMetrics(input: {
  quotes: Array<{ total?: number | string | null; status?: string }>;
  deals: Array<{ value_cents?: number | string | null; status?: string; stage?: string }>;
  conversations: Array<{ status?: string }>;
  responseMinutes?: number[];
}) {
  const quoteCount = input.quotes.length;
  const acceptedQuotes = input.quotes.filter(quote => ['approved','accepted'].includes((quote.status || '').toLowerCase())).length;
  const quoteValueCents = input.quotes.reduce((sum, quote) => sum + Math.max(0, Math.round(Number(quote.total || 0) * 100)), 0);
  const wonDeals = input.deals.filter(deal => deal.status === 'won' || deal.stage === 'won');
  const closedDeals = input.deals.filter(deal => ['won','lost'].includes(String(deal.status || deal.stage)));
  const pipelineValueCents = input.deals.filter(deal => !['won','lost','archived'].includes(String(deal.status))).reduce((sum, deal) => sum + Math.max(0, Math.round(Number(deal.value_cents || 0))), 0);
  const responseTimes = (input.responseMinutes || []).filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  const middle = Math.floor(responseTimes.length / 2);
  const medianResponseMinutes = responseTimes.length ? Number((responseTimes.length % 2 ? responseTimes[middle] : (responseTimes[middle - 1] + responseTimes[middle]) / 2).toFixed(1)) : null;
  return {
    currency: 'BRL', basis: 'computed_from_workspace_records',
    quotes: { count: quoteCount, accepted: acceptedQuotes, valueCents: quoteValueCents, acceptanceRate: quoteCount ? Number((acceptedQuotes / quoteCount).toFixed(4)) : null },
    deals: { open: input.deals.filter(deal => !['won','lost','archived'].includes(String(deal.status))).length, won: wonDeals.length, closed: closedDeals.length, wonRevenueCents: wonDeals.reduce((sum, deal) => sum + Math.max(0, Math.round(Number(deal.value_cents || 0))), 0), pipelineValueCents },
    conversations: { total: input.conversations.length, open: input.conversations.filter(item => !['closed','archived'].includes(String(item.status))).length },
    response: { samples: responseTimes.length, medianMinutes: medianResponseMinutes },
    coverage: { quotes: quoteCount > 0, deals: input.deals.length > 0, conversations: input.conversations.length > 0, responseTimes: responseTimes.length > 0 },
  };
}
