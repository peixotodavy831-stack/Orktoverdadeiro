import { useEffect, useState } from 'react';
import { ArrowRight, Radar } from 'lucide-react';
import { z } from 'zod';
import { proposalRecoveryDraft } from '../proposal-recovery-draft.js';
import { getProductErrorState, productApi } from '../api.js';
import type { ProductRequestState, RadarSignalView, RadarSnapshotView } from '../types';
import { BackendPending, ConfigurationRequired, EmptyState, ErrorState, LoadingState, PermissionState, StatusBadge } from '../ui/shared-states.js';

const snapshotSchema = z.object({
  version: z.literal('R1'), read_only: z.literal(true), generated_at: z.string().datetime(),
  counts: z.object({ unanswered_proposals: z.number().int().nonnegative(), unattended_leads: z.number().int().nonnegative(), overdue_followups: z.number().int().nonnegative() }),
  coverage: z.object({ partial: z.boolean(), limited_sources: z.array(z.string()), leads_evaluated: z.boolean() }),
  signals: z.array(z.object({
    id: z.string(), kind: z.enum(['unanswered_proposal','unattended_lead','overdue_followup']), severity: z.enum(['high','medium']),
    title: z.string(), recommendation: z.string(), entity_type: z.enum(['quote','conversation','task','deal']), entity_ref: z.string(),
    suggested_view: z.enum(['proposals','conversations','deals']), evidence: z.record(z.unknown()),
    source: z.enum(['task_due','deal_expected_close']).optional(), action_query: z.object({ dealId: z.string().optional() }).optional(),
  })),
});

export function parseRadarSnapshot(value: unknown): RadarSnapshotView {
  return snapshotSchema.parse(value) as RadarSnapshotView;
}

export function radarDestination(signal: RadarSignalView): { type: 'quote' | 'conversation' | 'deal'; id: string; label: string } | null {
  if (signal.entity_type === 'quote' && signal.suggested_view === 'proposals') return { type: 'quote', id: signal.entity_ref, label: 'Abrir proposta' };
  if (signal.entity_type === 'conversation' && signal.suggested_view === 'conversations') return { type: 'conversation', id: signal.entity_ref, label: 'Abrir conversa' };
  if (signal.entity_type === 'deal') return { type: 'deal', id: signal.entity_ref, label: 'Abrir negócio' };
  if (signal.entity_type === 'task' && signal.action_query?.dealId) return { type: 'deal', id: signal.action_query.dealId, label: 'Abrir negócio vinculado' };
  return null;
}

interface Props {
  accessToken: string | null;
  refreshKey: number;
  onSelectQuote: (id: string) => void;
  onOpenConversation: (id: string) => void;
  onOpenDeal: (id?: string) => void;
  onOpenWia?: (message: string) => void;
}

export function radarEvidenceDetails(signal: RadarSignalView): Array<[string, string]> {
  const evidence = signal.evidence;
  const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? `${new Date(value).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC` : 'Não registrado';
  if (signal.kind === 'unanswered_proposal') return [
    ['Envio registrado', date(evidence.sent_at)], ['Visualização registrada', date(evidence.viewed_at)],
    ['Espera desde envio', typeof evidence.waiting_hours === 'number' ? `${evidence.waiting_hours} h` : 'Não registrada'],
  ];
  if (signal.kind === 'unattended_lead') return [
    ['Aguardando desde', date(evidence.waiting_since)], ['Última mensagem', date(evidence.last_message_at)],
    ['SLA consultado', typeof evidence.sla_minutes === 'number' ? `${evidence.sla_minutes} min` : 'Não registrado'],
    ['Etapa', evidence.response_scope === 'first_response' ? 'Primeira resposta registrada' : evidence.response_scope === 'next_response' ? 'Próxima resposta registrada' : 'Não registrada'],
    ['Limite da evidência', 'Mensagem persistida não comprova entrega externa'],
  ];
  return signal.source === 'deal_expected_close'
    ? [['Fechamento previsto', typeof evidence.expected_close_on === 'string' ? `${evidence.expected_close_on} · fim do dia UTC` : 'Não registrado']]
    : [['Prazo da tarefa', date(evidence.due_at)]];
}

export function RadarResults({ snapshot, onOpen, onOpenWia }: { snapshot: RadarSnapshotView; onOpen: (signal: RadarSignalView) => void; onOpenWia?: (message: string) => void }) {
  return <>
    <p className="text-xs orkto-product-muted">{snapshot.signals.length} sinais na consulta · somente leitura · R1</p>
    {snapshot.coverage.partial && <p role="status" className="text-sm orkto-product-muted">Consulta parcial: alguns dados atingiram o limite de leitura. Os números não representam todos os registros.{!snapshot.coverage.leads_evaluated && ' Leads não foram avaliados porque o histórico de mensagens está incompleto.'}</p>}
    {snapshot.signals.length === 0 && <EmptyState title={snapshot.coverage.partial ? 'Nenhum sinal confirmado nesta consulta parcial' : 'Nenhum sinal nos dados consultados'} description="Radar procura propostas sem decisão registrada, conversas aguardando resposta e prazos vencidos. Nenhuma ação é executada." />}
    <ul className="divide-y orkto-product-border">
      {snapshot.signals.slice(0, 6).map(signal => {
        const destination = radarDestination(signal);
        const recoveryDraft = proposalRecoveryDraft(signal);
        const source = signal.entity_type === 'quote' ? 'Proposta' : signal.entity_type === 'conversation' ? 'Mensagens registradas' : signal.source === 'deal_expected_close' ? 'Data prevista de fechamento (UTC)' : 'Tarefa agendada';
        return <li key={signal.id} className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-semibold">{signal.title}</h3><StatusBadge tone={signal.severity === 'high' ? 'critical' : 'attention'}>{signal.severity === 'high' ? 'Prioridade alta' : 'Atenção'}</StatusBadge></div>
            <p className="mt-1 text-sm leading-6 orkto-product-muted">{signal.recommendation}</p>
            <p className="mt-1 text-xs orkto-product-subtle">Fonte: {source}{signal.entity_type === 'task' && !destination ? ' · sem negócio vinculado' : ''}</p>
            <details className="mt-1 text-xs orkto-product-muted">
              <summary className="min-h-11 cursor-pointer py-3">Evidências da recomendação</summary>
              <dl className="space-y-2 pb-2">{radarEvidenceDetails(signal).map(([label, value]) => <div key={label} className="break-words"><dt className="font-semibold">{label}</dt><dd>{value}</dd></div>)}</dl>
            </details>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1 sm:max-w-48">
            {destination && <button type="button" onClick={() => onOpen(signal)} className="today-text-action min-h-11">{destination.label}<ArrowRight size={14} aria-hidden="true" /></button>}
            {recoveryDraft && onOpenWia && <>
              <button type="button" onClick={() => onOpenWia(recoveryDraft)} className="today-text-action min-h-11 text-left">Preparar com a WIA<ArrowRight size={14} aria-hidden="true" /></button>
              <p className="text-xs leading-5 orkto-product-subtle">Abre um rascunho. Você revisa e envia o pedido; nenhum contato é disparado.</p>
            </>}
          </div>
        </li>;
      })}
    </ul>
    {snapshot.signals.length > 6 && <p className="text-xs orkto-product-muted">Exibindo os 6 primeiros de {snapshot.signals.length} sinais retornados, por prioridade e espera.</p>}
  </>;
}

export default function TodayRadarPanel({ accessToken, refreshKey, onSelectQuote, onOpenConversation, onOpenDeal, onOpenWia }: Props) {
  const [retry, setRetry] = useState(0);
  const [feed, setFeed] = useState<{ token: string | null; status: ProductRequestState; data?: RadarSnapshotView; message?: string }>({ token: null, status: 'loading' });
  useEffect(() => {
    let active = true;
    if (!accessToken) { setFeed({ token: null, status: 'permission_denied' }); return; }
    setFeed({ token: accessToken, status: 'loading' });
    void productApi<{ data: unknown }>('/api/radar', accessToken).then(result => {
      const data = parseRadarSnapshot(result.data);
      if (active) setFeed({ token: accessToken, status: 'success', data });
    }).catch(error => {
      if (active) setFeed({ token: accessToken, status: getProductErrorState(error), message: 'Não foi possível confirmar os sinais comerciais.' });
    });
    return () => { active = false; };
  }, [accessToken, refreshKey, retry]);
  const status = feed.token === accessToken ? feed.status : 'loading';
  const open = (signal: RadarSignalView) => {
    const target = radarDestination(signal); if (!target) return;
    if (target.type === 'quote') onSelectQuote(target.id);
    else if (target.type === 'conversation') onOpenConversation(target.id);
    else onOpenDeal(target.id);
  };
  return <section aria-labelledby="today-radar-title" className="today-glass-panel my-5 space-y-3 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="today-radar-title" className="today-section-title flex items-center gap-2"><Radar size={18} aria-hidden="true" />Radar comercial</h2><button type="button" className="today-text-action min-h-11" onClick={() => setRetry(value => value + 1)}>Atualizar Radar</button></div>
    {status === 'loading' && <LoadingState rows={2} label="Consultando sinais do Radar" />}
    {(status === 'error' || status === 'offline') && <ErrorState title="O Radar não carregou" message={feed.message || 'Tente consultar novamente.'} onRetry={() => setRetry(value => value + 1)} />}
    {status === 'permission_denied' && <PermissionState message="O Radar exige sessão e membership ativa neste workspace." />}
    {status === 'configuration_required' && <ConfigurationRequired title="Radar indisponível neste ambiente" message="Confira a configuração do banco antes de consultar os sinais." />}
    {status === 'backend_pending' && <BackendPending title="Radar ainda não disponível" message="Este ambiente ainda não possui o contrato Radar R1." />}
    {status === 'success' && feed.data && <RadarResults snapshot={feed.data} onOpen={open} onOpenWia={onOpenWia} />}
  </section>;
}
