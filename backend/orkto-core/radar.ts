export type RadarSignalKind = 'unanswered_proposal' | 'unattended_lead' | 'overdue_followup';

export interface RadarQuoteInput {
  id: string;
  quote_number: string | null;
  client_name: string | null;
  total: number | null;
  status: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  deal_id: string | null;
  archived_at?: string | null;
  retention_expires_at?: string | null;
}

export interface RadarMessageInput {
  direction: string | null;
  sent_at: string | null;
  read_at: string | null;
}

export interface RadarConversationInput {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  status: string | null;
  created_at: string | null;
  messages: RadarMessageInput[];
}

export interface RadarTaskInput {
  id: string;
  title: string | null;
  status: string | null;
  due_at: string | null;
  deal_id: string | null;
  customer_ref: string | null;
  completed_at?: string | null;
}

export interface RadarDealInput {
  id: string;
  title: string | null;
  stage: string | null;
  status: string | null;
  expected_close_on: string | null;
  customer_ref: string | null;
}

export interface RadarSignal {
  id: string;
  kind: RadarSignalKind;
  severity: 'high' | 'medium';
  title: string;
  recommendation: string;
  entity_type: 'quote' | 'conversation' | 'task' | 'deal';
  entity_ref: string;
  suggested_view: 'proposals' | 'conversations' | 'deals';
  evidence: Record<string, unknown>;
  source?: 'task_due' | 'deal_expected_close';
  action_query?: { dealId?: string };
}

export interface RadarSnapshot {
  generated_at: string;
  counts: { unanswered_proposals: number; unattended_leads: number; overdue_followups: number };
  signals: RadarSignal[];
}

export interface RadarOptions {
  proposalUnansweredHours?: number;
  slaMinutes?: number;
  proposalHighHours?: number;
  leadHighMinutes?: number;
  followupHighDays?: number;
  maxPerKind?: number;
}

const DEFAULTS = {
  proposalUnansweredHours: 48,
  proposalHighHours: 24 * 7,
  slaMinutes: 60,
  leadHighMinutes: 240,
  followupHighDays: 7,
  maxPerKind: 25,
} as const;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const SEVERITY_RANK = { high: 0, medium: 1 } as const;

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function optionsFor(options: RadarOptions) {
  const proposalUnansweredHours = bounded(options.proposalUnansweredHours, DEFAULTS.proposalUnansweredHours, 1, 8760);
  const slaMinutes = bounded(options.slaMinutes, DEFAULTS.slaMinutes, 5, 1440);
  return { proposalUnansweredHours, slaMinutes,
    proposalHighHours: Math.max(proposalUnansweredHours, bounded(options.proposalHighHours, DEFAULTS.proposalHighHours, 1, 8760)),
    leadHighMinutes: Math.max(slaMinutes, bounded(options.leadHighMinutes, DEFAULTS.leadHighMinutes, 5, 10080)),
    followupHighDays: bounded(options.followupHighDays, DEFAULTS.followupHighDays, 1, 365),
    maxPerKind: Math.floor(bounded(options.maxPerKind, DEFAULTS.maxPerKind, 1, 100)),
  };
}

function finiteTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function sortSignals(signals: RadarSignal[]): RadarSignal[] {
  return signals.slice().sort((left, right) => {
    if (SEVERITY_RANK[left.severity] !== SEVERITY_RANK[right.severity]) return SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
    const leftAge = Number(left.evidence.waiting_ms ?? left.evidence.overdue_ms ?? 0);
    const rightAge = Number(right.evidence.waiting_ms ?? right.evidence.overdue_ms ?? 0);
    if (rightAge !== leftAge) return rightAge - leftAge;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

export function detectUnansweredProposals(quotes: RadarQuoteInput[], nowMs: number, options: RadarOptions = {}): RadarSignal[] {
  const { proposalUnansweredHours: thresholdHours, proposalHighHours: highHours, maxPerKind: max } = optionsFor(options);
  const signals: RadarSignal[] = [];
  for (const quote of quotes || []) {
    if (!['sent', 'viewed', 'pending'].includes(String(quote.status || ''))) continue;
    if (quote.approved_at || quote.rejected_at) continue;
    if (quote.archived_at) continue;
    const expiresAt = finiteTime(quote.retention_expires_at);
    if (quote.retention_expires_at && (expiresAt === null || expiresAt <= nowMs)) continue;
    const sentAt = finiteTime(quote.sent_at);
    if (sentAt === null) continue;
    const waitingMs = nowMs - sentAt;
    if (waitingMs < thresholdHours * HOUR_MS) continue;
    const viewed = finiteTime(quote.viewed_at);
    const viewedAt = viewed !== null && viewed >= sentAt && viewed <= nowMs ? viewed : null;
    const waitingHours = Math.floor(waitingMs / HOUR_MS);
    const severity: RadarSignal['severity'] = waitingMs >= highHours * HOUR_MS ? 'high' : 'medium';
    const client = String(quote.client_name || 'Cliente sem nome');
    const number = String(quote.quote_number || quote.id);
    signals.push({
      id: `radar:unanswered_proposal:${quote.id}`,
      kind: 'unanswered_proposal',
      severity,
      title: `Proposta #${number} sem resposta (${client})`,
      recommendation: viewedAt !== null
        ? `Visualização registrada; proposta enviada há ${waitingHours} h, sem decisão registrada — revise antes de acompanhar o cliente.`
        : `Proposta enviada há ${waitingHours} h, sem visualização registrada — revise o canal e o recebimento.`,
      entity_type: 'quote',
      entity_ref: String(quote.id),
      suggested_view: 'proposals',
      evidence: {
        quote_number: quote.quote_number,
        client_name: client,
        total: Number(quote.total || 0),
        status: quote.status,
        sent_at: quote.sent_at,
        viewed_at: viewedAt === null ? null : quote.viewed_at,
        deal_id: quote.deal_id,
        waiting_hours: waitingHours,
        waiting_ms: waitingMs,
      },
      action_query: quote.deal_id ? { dealId: String(quote.deal_id) } : undefined,
    });
  }
  return sortSignals(signals).slice(0, max);
}

export function detectUnattendedLeads(conversations: RadarConversationInput[], nowMs: number, options: RadarOptions = {}): RadarSignal[] {
  const { slaMinutes, leadHighMinutes: highMinutes, maxPerKind: max } = optionsFor(options);
  const signals: RadarSignal[] = [];
  for (const conversation of conversations || []) {
    if (!['open', 'active'].includes(String(conversation.status || ''))) continue;
    const messages = (conversation.messages || []).slice();
    const relevant = messages.filter(message => ['incoming','outgoing'].includes(message.direction || ''));
    // An invalid/future event makes ordering uncertain. Internal notes never
    // count as a response, and conversation creation alone is not an inbound lead.
    if (relevant.some(message => finiteTime(message.sent_at) === null || finiteTime(message.sent_at)! > nowMs)) continue;
    const outgoing = relevant.filter(message => message.direction === 'outgoing');
    const lastOutgoing = Math.max(-Infinity, ...outgoing.map(message => finiteTime(message.sent_at)!));
    const pending = relevant.filter(message => message.direction === 'incoming' && finiteTime(message.sent_at)! > lastOutgoing);
    if (!pending.length) continue;
    const firstPending = Math.min(...pending.map(message => finiteTime(message.sent_at)!));
    const lastMessage = Math.max(...relevant.map(message => finiteTime(message.sent_at)!));
    const unread = pending.filter(message => !message.read_at).length;
    const waitingMs = nowMs - firstPending;
    if (waitingMs === null || waitingMs < slaMinutes * 60_000) continue;
    const waitingMinutes = Math.floor(waitingMs / 60_000);
    const severity: RadarSignal['severity'] = waitingMs >= highMinutes * 60_000 ? 'high' : 'medium';
    const contact = String(conversation.contact_name || conversation.contact_phone || 'Lead sem identificação');
    signals.push({
      id: `radar:unattended_lead:${conversation.id}`,
      kind: 'unattended_lead',
      severity,
      title: `Lead aguardando resposta: ${contact}`,
      recommendation: `Lead aguarda resposta há ${waitingMinutes} min — responda antes de prospectar novos leads.`,
      entity_type: 'conversation',
      entity_ref: String(conversation.id),
      suggested_view: 'conversations',
      evidence: {
        contact_name: conversation.contact_name,
        contact_phone: conversation.contact_phone,
        waiting_minutes: waitingMinutes,
        waiting_ms: waitingMs,
        unread_count: unread,
        sla_minutes: slaMinutes,
        last_message_at: new Date(lastMessage).toISOString(),
        waiting_since: new Date(firstPending).toISOString(),
        response_scope: outgoing.length ? 'next_response' : 'first_response',
        response_basis: 'persisted_message_not_delivery_receipt',
      },
    });
  }
  return sortSignals(signals).slice(0, max);
}

export function detectOverdueFollowups(tasks: RadarTaskInput[], deals: RadarDealInput[], nowMs: number, options: RadarOptions = {}): RadarSignal[] {
  const { followupHighDays: highDays, maxPerKind: max } = optionsFor(options);
  const signals: RadarSignal[] = [];
  for (const task of tasks || []) {
    if (!['open', 'in_progress'].includes(String(task.status || ''))) continue;
    if (task.completed_at) continue;
    const dueAt = finiteTime(task.due_at);
    if (dueAt === null || dueAt >= nowMs) continue;
    const overdueMs = nowMs - dueAt;
    const overdueDays = Math.floor(overdueMs / DAY_MS);
    const severity: RadarSignal['severity'] = overdueMs >= highDays * DAY_MS ? 'high' : 'medium';
    signals.push({
      id: `radar:overdue_followup:task:${task.id}`,
      kind: 'overdue_followup',
      severity,
      title: `Follow-up vencido: ${String(task.title || 'Tarefa sem título')}`,
      recommendation: `Follow-up vencido há ${overdueDays} dia${overdueDays === 1 ? '' : 's'} — conclua ou renegocie o prazo hoje.`,
      entity_type: 'task',
      entity_ref: String(task.id),
      suggested_view: 'deals',
      source: 'task_due',
      evidence: {
        title: task.title,
        due_at: task.due_at,
        overdue_days: overdueDays,
        overdue_ms: overdueMs,
        deal_id: task.deal_id,
        customer_ref: task.customer_ref,
      },
      action_query: task.deal_id ? { dealId: String(task.deal_id) } : undefined,
    });
  }
  for (const deal of deals || []) {
    if (String(deal.status || '') !== 'open') continue;
    const closeOn = String(deal.expected_close_on || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(closeOn)) continue;
    const deadline = Date.parse(`${closeOn}T23:59:59.999Z`);
    if (!Number.isFinite(deadline) || new Date(deadline).toISOString().slice(0, 10) !== closeOn || deadline >= nowMs) continue;
    const overdueMs = nowMs - deadline;
    const overdueDays = Math.floor(overdueMs / DAY_MS);
    const severity: RadarSignal['severity'] = overdueMs >= highDays * DAY_MS ? 'high' : 'medium';
    const dueLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(deadline);
    signals.push({
      id: `radar:overdue_followup:deal:${deal.id}`,
      kind: 'overdue_followup',
      severity,
      title: `Fechamento previsto passou: ${String(deal.title || 'Negócio sem título')}`,
      recommendation: `Fechamento previsto para ${dueLabel} e o negócio segue aberto — atualize a etapa ou renegocie a data.`,
      entity_type: 'deal',
      entity_ref: String(deal.id),
      suggested_view: 'deals',
      source: 'deal_expected_close',
      evidence: {
        title: deal.title,
        stage: deal.stage,
        expected_close_on: closeOn,
        overdue_days: overdueDays,
        overdue_ms: overdueMs,
        customer_ref: deal.customer_ref,
      },
    });
  }
  return sortSignals(signals).slice(0, max);
}

export function buildRadarSnapshot(
  input: { quotes?: RadarQuoteInput[]; conversations?: RadarConversationInput[]; tasks?: RadarTaskInput[]; deals?: RadarDealInput[] },
  nowMs: number,
  options: RadarOptions = {},
): RadarSnapshot {
  const proposals = detectUnansweredProposals(input.quotes || [], nowMs, options);
  const leads = detectUnattendedLeads(input.conversations || [], nowMs, options);
  const followups = detectOverdueFollowups(input.tasks || [], input.deals || [], nowMs, options);
  return {
    generated_at: new Date(nowMs).toISOString(),
    counts: {
      unanswered_proposals: proposals.length,
      unattended_leads: leads.length,
      overdue_followups: followups.length,
    },
    signals: sortSignals([...proposals, ...leads, ...followups]),
  };
}
