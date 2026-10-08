import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BriefcaseBusiness, Clock3, Inbox, RefreshCw, Sparkles } from 'lucide-react';
import type { Quote, SavedClient, UserProfile } from '../../types';
import { getProductErrorState, productApi } from '../api';
import type { DealView, InboxConversationView, ProductRequestState, WiaActionView } from '../types';
import { BackendPending, ConfigurationRequired, EmptyState, ErrorState, LoadingState, Metric, PageHeader, PermissionState, StatusBadge } from '../ui/shared-states';

interface TodayV2PageProps {
  user?: { displayName?: string | null } | null;
  userProfile: UserProfile | null;
  quotes: Quote[];
  clients: SavedClient[];
  accessToken: string | null;
  dataLoading: boolean;
  dataError?: string | null;
  onRetryAppData?: () => void;
  onOpenSettings?: () => void;
  onSelectQuote: (quoteId: string) => void;
  onCreateQuote: () => void;
  onOpenDeal: (dealId?: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenWia: () => void;
}

interface FeedState<T> {
  status: ProductRequestState;
  data: T[];
  message?: string;
}

const blankFeed = <T,>(): FeedState<T> => ({ status: 'loading', data: [] });

function formatActionStatus(status: string) {
  if (status === 'awaiting_approval') return 'Aguardando aprovação';
  if (status === 'prepared') return 'Ação preparada';
  if (status === 'executed') return 'Executado';
  if (status === 'failed') return 'Falhou';
  if (status === 'rejected') return 'Rejeitado';
  return status.replaceAll('_', ' ');
}

function actionSummary(action: WiaActionView) {
  const draft = action.payload?.messageDraft;
  if (typeof draft === 'string' && draft.trim()) return draft.trim();
  return action.action_type.replaceAll('_', ' ');
}

function priorityReason(item: InboxConversationView) {
  if (Array.isArray(item.priority_reason)) return item.priority_reason.filter(Boolean).join(' · ');
  return item.priority_reason || 'Motivo não retornado pela fila da Inbox.';
}

export default function TodayV2Page({
  user,
  userProfile,
  quotes,
  clients,
  accessToken,
  dataLoading,
  dataError,
  onRetryAppData,
  onOpenSettings,
  onSelectQuote,
  onCreateQuote,
  onOpenDeal,
  onOpenConversation,
  onOpenWia,
}: TodayV2PageProps) {
  const [inbox, setInbox] = useState<FeedState<InboxConversationView>>(blankFeed);
  const [deals, setDeals] = useState<FeedState<DealView>>(blankFeed);
  const [wia, setWia] = useState<FeedState<WiaActionView>>(blankFeed);
  const [retryVersion, setRetryVersion] = useState(0);

  const loadInbox = useCallback(async () => {
    setInbox({ status: 'loading', data: [] });
    try {
      const result = await productApi<{ data: InboxConversationView[] }>('/api/priority/inbox', accessToken);
      setInbox({ status: 'success', data: Array.isArray(result.data) ? result.data : [] });
    } catch (error) {
      setInbox({ status: getProductErrorState(error), data: [], message: error instanceof Error ? error.message : 'A fila de atenção não pôde ser carregada.' });
    }
  }, [accessToken]);

  const loadDeals = useCallback(async () => {
    setDeals({ status: 'loading', data: [] });
    try {
      const result = await productApi<{ data: DealView[] }>('/api/deals', accessToken);
      setDeals({ status: 'success', data: Array.isArray(result.data) ? result.data : [] });
    } catch (error) {
      setDeals({ status: getProductErrorState(error), data: [], message: error instanceof Error ? error.message : 'Os negócios não puderam ser carregados.' });
    }
  }, [accessToken]);

  const loadWia = useCallback(async () => {
    setWia({ status: 'loading', data: [] });
    try {
      const statuses = ['awaiting_approval', 'prepared', 'executed', 'failed'];
      const results = await Promise.all(statuses.map(status => productApi<{ data: WiaActionView[] }>(`/api/wia/actions?status=${status}`, accessToken)));
      const actions = results.flatMap(result => Array.isArray(result.data) ? result.data : []).sort((left, right) => Date.parse(right.created_at || '') - Date.parse(left.created_at || ''));
      setWia({ status: 'success', data: actions.slice(0, 5) });
    } catch (error) {
      setWia({ status: getProductErrorState(error), data: [], message: error instanceof Error ? error.message : 'A atividade da WIA não pôde ser carregada.' });
    }
  }, [accessToken]);

  useEffect(() => { void loadInbox(); void loadDeals(); void loadWia(); }, [loadInbox, loadDeals, loadWia, retryVersion]);

  const pendingQuotes = useMemo(() => quotes.filter(quote => quote.status === 'pending'), [quotes]);
  const attentionConversations = useMemo(() => inbox.data.filter(item => {
    const priority = String(item.priority || '').toLowerCase();
    return Number(item.unread_count || 0) > 0 || priority === 'urgent' || priority === 'high';
  }), [inbox.data]);
  const riskDeals = useMemo(() => deals.data.filter(deal =>
    deal.status === 'open' && deal.risk?.recommended_action && deal.risk.recommended_action !== 'continue_normally'
  ), [deals.data]);
  const approvalActions = useMemo(() => wia.data.filter(action => action.status === 'awaiting_approval'), [wia.data]);
  const attentionCountReady = !dataLoading && !dataError && inbox.status === 'success' && deals.status === 'success' && wia.status === 'success';
  const displayName = user?.displayName?.trim().split(/\s+/)[0] || userProfile?.companyName || 'Olá';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const handleRetryAll = () => {
    setRetryVersion(version => version + 1);
    onRetryAppData?.();
  };

  return (
    <div className="orkto-product orkto-today mx-auto min-h-full w-full max-w-[1600px] space-y-7 px-4 py-5 pb-24 sm:px-6 sm:py-7 lg:px-8 lg:pb-8">
      <PageHeader eyebrow={dateLabel} title={`${greeting}, ${displayName}`} description="Veja o que precisa de atenção e escolha o próximo passo." actions={<button type="button" onClick={handleRetryAll} aria-label="Atualizar Hoje" className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-medium orkto-product-border orkto-product-surface hover:orkto-product-surface-muted"><RefreshCw size={15} />Atualizar</button>} />

      <section aria-labelledby="today-attention-title" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--orkto-brand-text)' }}>Primeiro, resolva o que está parado</p><h2 id="today-attention-title" className="mt-1 text-xl font-semibold">Precisa de você</h2></div>
          {attentionCountReady && <span className="text-xs orkto-product-muted">{attentionConversations.length + riskDeals.length + pendingQuotes.length + approvalActions.length} itens identificados</span>}
        </div>

        {inbox.status === 'loading' || deals.status === 'loading' || dataLoading ? <LoadingState rows={3} label="Carregando itens que precisam de atenção" /> : null}
        {dataError && <ErrorState title="Os dados operacionais não foram carregados" message={dataError} onRetry={onRetryAppData} />}
        {inbox.status === 'error' || inbox.status === 'offline' ? <ErrorState title="A fila da Inbox não carregou" message={inbox.message || 'Não foi possível confirmar as conversas prioritárias.'} onRetry={() => void loadInbox()} /> : null}
        {inbox.status === 'permission_denied' && <PermissionState message="A fila de conversas exige acesso ao workspace. Nenhum conteúdo da Inbox foi exibido." />}
        {inbox.status === 'configuration_required' && <ConfigurationRequired title="Inbox precisa de configuração" message={inbox.message || 'Verifique a configuração do canal para carregar as conversas.'} action={onOpenSettings && <button type="button" onClick={onOpenSettings} className="orkto-product-control min-h-11 rounded-lg px-3 text-xs font-semibold">Abrir configurações</button>} />}
        {inbox.status === 'backend_pending' && <BackendPending title="Fila da Inbox pendente neste ambiente" message="O contrato necessário para carregar a fila não está disponível aqui." />}
        {deals.status === 'error' || deals.status === 'offline' ? <ErrorState title="Os sinais de negócios não carregaram" message={deals.message || 'Não foi possível consultar negócios e avaliações de risco.'} onRetry={() => void loadDeals()} /> : null}
        {deals.status === 'permission_denied' && <PermissionState message="A lista de negócios exige acesso ao workspace. Nenhum negócio foi exibido." />}
        {deals.status === 'configuration_required' && <ConfigurationRequired title="Negócios precisam de configuração" message={deals.message || 'A configuração necessária para consultar negócios está ausente.'} action={onOpenSettings && <button type="button" onClick={onOpenSettings} className="orkto-product-control min-h-11 rounded-lg px-3 text-xs font-semibold">Abrir configurações</button>} />}
        {deals.status === 'backend_pending' && <BackendPending title="Consulta de negócios pendente neste ambiente" message="A lista de negócios ainda não está disponível neste ambiente." />}

        {!dataLoading && !dataError && inbox.status === 'success' && deals.status === 'success' && wia.status === 'success' && attentionConversations.length === 0 && riskDeals.length === 0 && pendingQuotes.length === 0 && approvalActions.length === 0 && <EmptyState title="Nada parado por aqui" description="Inbox, negócios, propostas e ações da WIA foram consultados. Nenhum item retornou uma próxima ação pendente." />}

        <div className="divide-y rounded-xl border orkto-product-border orkto-product-surface">
          {approvalActions.slice(0, 3).map(action => <article key={action.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg orkto-product-surface-muted" style={{ color: 'var(--orkto-brand-text)' }}><Sparkles size={17} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">Ação da WIA aguarda aprovação</h3><StatusBadge tone="attention">Aguardando aprovação</StatusBadge></div><p className="mt-1 line-clamp-2 text-[13px] leading-5 orkto-product-muted">{actionSummary(action)}</p><p className="mt-1 text-[11px] orkto-product-subtle">{action.created_at ? new Date(action.created_at).toLocaleString('pt-BR') : 'Data não retornada'}</p></div></div>
            <button type="button" onClick={onOpenWia} className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg px-3 text-xs font-semibold sm:self-auto" style={{ color: 'var(--orkto-brand-text)' }}>Revisar ação <ArrowRight size={15} /></button>
          </article>)}
          {attentionConversations.slice(0, Math.max(0, 5 - Math.min(approvalActions.length, 3))).map(item => <article key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg orkto-product-surface-muted orkto-product-muted"><Inbox size={17} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{item.contact_name || 'Conversa sem nome'}</h3>{Number(item.unread_count || 0) > 0 && <StatusBadge tone="info">{item.unread_count} não lida{Number(item.unread_count) === 1 ? '' : 's'}</StatusBadge>}{item.priority && <StatusBadge tone={['urgent', 'high'].includes(String(item.priority).toLowerCase()) ? 'critical' : 'neutral'}>Prioridade {item.priority}</StatusBadge>}</div><p className="mt-1 line-clamp-1 text-[13px] orkto-product-muted">{item.last_message || priorityReason(item)}</p><p className="mt-1 text-[11px] orkto-product-subtle">{item.last_message_at ? new Date(item.last_message_at).toLocaleString('pt-BR') : 'Horário não retornado'}{item.source_channel ? ` · ${item.source_channel}` : ''}</p></div></div>
            <button type="button" onClick={() => onOpenConversation(item.id)} className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg px-3 text-xs font-semibold sm:self-auto" style={{ color: 'var(--orkto-brand-text)' }}>Abrir conversa <ArrowRight size={15} /></button>
          </article>)}
          {riskDeals.slice(0, 3).map(deal => {
            const reasons = (deal.risk?.reasons || []).filter(Boolean).slice(0, 2);
            const recommendation = deal.risk?.recommended_action === 'pause_contact'
              ? 'A recomendação do servidor é pausar o contato.'
              : 'A recomendação do servidor é revisar com uma pessoa.';
            return <article key={deal.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg orkto-product-surface-muted" style={{ color: 'var(--orkto-critical)' }}><AlertTriangle size={17} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{deal.title}</h3><StatusBadge tone="critical">Avaliação de risco</StatusBadge></div><p className="mt-1 text-[13px] leading-5 orkto-product-muted">{recommendation}{reasons.length ? ` Motivos: ${reasons.join(' · ')}` : ' O servidor não retornou os motivos.'}</p><p className="mt-1 text-[11px] orkto-product-subtle">Pontuação registrada: {deal.risk?.score}{deal.risk?.confidence != null ? ` · confiança ${Math.round(deal.risk.confidence * 100)}%` : ''}{deal.risk?.assessed_at ? ` · avaliado ${new Date(deal.risk.assessed_at).toLocaleString('pt-BR')}` : ''}</p></div></div>
              <button type="button" onClick={() => onOpenDeal(deal.id)} className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg px-3 text-xs font-semibold sm:self-auto" style={{ color: 'var(--orkto-brand-text)' }}>Revisar negócio <ArrowRight size={15} /></button>
            </article>;
          })}
          {pendingQuotes.slice(0, 3).map(quote => <article key={quote.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg orkto-product-surface-muted orkto-product-muted"><Clock3 size={17} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">Proposta aguardando resposta</h3><StatusBadge tone="attention">Pendente</StatusBadge></div><p className="mt-1 text-[13px] orkto-product-muted">{quote.clientName || 'Cliente sem nome'} · #{quote.quoteNumber}</p></div></div>
            <button type="button" onClick={() => onSelectQuote(quote.id)} className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg px-3 text-xs font-semibold sm:self-auto" style={{ color: 'var(--orkto-brand-text)' }}>Abrir proposta <ArrowRight size={15} /></button>
          </article>)}
        </div>
      </section>

      <section aria-labelledby="today-wia-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--orkto-brand-text)' }}>Atividade persistida</p><h2 id="today-wia-title" className="mt-1 text-lg font-semibold">WIA trabalhou por você</h2></div><button type="button" onClick={onOpenWia} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold" style={{ color: 'var(--orkto-brand-text)' }}>Abrir workspace <ArrowRight size={14} /></button></div>
        {wia.status === 'loading' && <LoadingState rows={2} label="Carregando ações persistidas da WIA" />}
        {(wia.status === 'error' || wia.status === 'offline') && <ErrorState title="A atividade da WIA não carregou" message={wia.message || 'Não foi possível confirmar ações recentes.'} onRetry={() => void loadWia()} />}
        {wia.status === 'permission_denied' && <PermissionState message="A atividade da WIA exige acesso autorizado. Nenhuma execução foi exibida." />}
        {wia.status === 'configuration_required' && <ConfigurationRequired title="WIA precisa de configuração" message={wia.message || 'A configuração necessária para consultar esta atividade está ausente.'} action={onOpenSettings && <button type="button" onClick={onOpenSettings} className="orkto-product-control min-h-11 rounded-lg px-3 text-xs font-semibold">Abrir configurações</button>} />}
        {wia.status === 'backend_pending' && <BackendPending title="Atividade da WIA pendente neste ambiente" message="A consulta de ações persistidas não está disponível aqui." />}
        {wia.status === 'success' && wia.data.length === 0 && <EmptyState title="Nenhuma ação recente registrada" description="A lista de ações da WIA retornou vazia. A conversa e as análises continuam disponíveis no workspace." />}
        {wia.status === 'success' && wia.data.length > 0 && <ol className="divide-y rounded-xl border orkto-product-border orkto-product-surface">
          {wia.data.slice(0, 4).map(action => <li key={action.id} className="flex items-start gap-3 p-4"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: action.status === 'executed' ? 'var(--orkto-success)' : action.status === 'failed' ? 'var(--orkto-critical)' : 'var(--orkto-brand)' }} aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium">{actionSummary(action)}</h3><StatusBadge tone={action.status === 'executed' ? 'success' : action.status === 'failed' ? 'critical' : 'attention'}>{formatActionStatus(action.status)}</StatusBadge></div><p className="mt-1 text-[11px] orkto-product-subtle">{action.created_at ? new Date(action.created_at).toLocaleString('pt-BR') : 'Data não retornada'}{action.rationale ? ` · ${action.rationale}` : ''}</p></div></li>)}
        </ol>}
      </section>

      <section aria-labelledby="today-work-title" className="space-y-3">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] orkto-product-subtle">Fila e andamento</p><h2 id="today-work-title" className="mt-1 text-lg font-semibold">Operação agora</h2></div>
        <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5 orkto-product-border orkto-product-surface">
          <Metric label="Conversas com prioridade" value={inbox.status === 'success' ? attentionConversations.length : '—'} note={inbox.status === 'success' ? 'Fila confirmada pela Inbox' : 'Aguardando a Inbox'} icon={<Inbox size={17} />} />
          <Metric label="Negócios em andamento" value={deals.status === 'success' ? deals.data.filter(deal => deal.status === 'open').length : '—'} note={deals.status === 'success' ? 'Status aberto retornado pela API' : 'Aguardando negócios'} icon={<BriefcaseBusiness size={17} />} />
          <Metric label="Propostas pendentes" value={dataLoading || dataError ? '—' : pendingQuotes.length} note={dataError ? 'Dados indisponíveis' : 'Com status pendente'} icon={<Clock3 size={17} />} />
          <Metric label="Clientes no workspace" value={dataLoading || dataError ? '—' : clients.length} note={dataError ? 'Dados indisponíveis' : 'Registros carregados'} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onOpenDeal()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-medium orkto-product-border orkto-product-surface hover:orkto-product-surface-muted">Ver negócios <ArrowRight size={14} /></button>
          <button type="button" onClick={onCreateQuote} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold orkto-product-primary">Criar proposta <ArrowRight size={14} /></button>
        </div>
      </section>
    </div>
  );
}
