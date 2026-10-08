import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, Columns3, List, Plus, RefreshCw, Search, TrendingUp, X } from 'lucide-react';
import type { SavedClient } from '../types';
import { getProductErrorState, productApi } from '../product/api';
import type { ProductRequestState } from '../product/types';
import { BackendPending, ConfigurationRequired, EmptyState, ErrorState, LoadingState, PageHeader, PermissionState, StatusBadge } from '../product/ui/shared-states';

type DealStage = 'new' | 'qualification' | 'proposal' | 'negotiation' | 'won' | 'lost';
type DealView = 'list' | 'pipeline';
interface Deal {
  id: string;
  title: string;
  description: string | null;
  customer_ref: string | null;
  stage: DealStage;
  status: string;
  value_cents: number | null;
  probability_percent: number | null;
  expected_close_on: string | null;
  lost_reason: string | null;
  updated_at: string;
  stage_changed_at?: string | null;
  owner_name?: string | null;
  next_action?: string | null;
  risk?: { score: number; confidence?: number | null; reasons?: string[]; recommended_action?: string } | null;
}
interface DealHistoryEvent {
  id?: string;
  event_type?: string;
  occurred_at?: string | null;
  event_data?: Record<string, unknown> | null;
}
interface RelatedProposal {
  id: string;
  quote_number?: string | number | null;
  status?: string | null;
  total?: number | null;
  created_at?: string | null;
}
interface DealMemory {
  id: string;
  memory_type?: string | null;
  content?: unknown;
  confidence?: number | null;
  created_at?: string | null;
}
interface DealDetail extends Deal {
  history?: DealHistoryEvent[];
  proposals?: RelatedProposal[];
  contextual_memories?: DealMemory[];
}
interface DealDetailState {
  status: ProductRequestState;
  data: DealDetail | null;
  message?: string;
}
interface DealsPageProps {
  clients: SavedClient[];
  accessToken: string | null;
  initialDealId?: string | null;
  onInitialDealOpened?: () => void;
  initialCreate?: boolean;
  onInitialCreateOpened?: () => void;
  onOpenQuote?: (quoteId: string) => void;
}

const stages: Array<{ id: DealStage; label: string }> = [
  { id: 'new', label: 'Novo' },
  { id: 'qualification', label: 'Qualificação' },
  { id: 'proposal', label: 'Proposta' },
  { id: 'negotiation', label: 'Negociação' },
  { id: 'won', label: 'Ganho' },
  { id: 'lost', label: 'Perdido' },
];
const formatMoney = (cents: number | null | undefined) => typeof cents === 'number' && Number.isFinite(cents)
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
  : 'Sem valor informado';
const riskTone = (score: number) => score >= 70 ? 'critical' as const : score >= 40 ? 'attention' as const : 'info' as const;

export default function DealsPage({ clients, accessToken, initialDealId, onInitialDealOpened, initialCreate, onInitialCreateOpened, onOpenQuote }: DealsPageProps) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | DealStage>('all');
  const [riskOnly, setRiskOnly] = useState(false);
  const [view, setView] = useState<DealView>('list');
  const [showForm, setShowForm] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [detailState, setDetailState] = useState<DealDetailState>({ status: 'loading', data: null });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [customerRef, setCustomerRef] = useState('');
  const [value, setValue] = useState('');
  const [expectedCloseOn, setExpectedCloseOn] = useState('');
  const detailRequestRef = useRef(0);
  const peekRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const openerDealIdRef = useRef<string | null>(null);

  const headers = useMemo(() => ({ 'Content-Type': 'application/json', ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}) }), [accessToken]);
  const load = useCallback(async () => {
    setLoading(true); setError(''); setErrorStatus(null);
    try {
      const response = await fetch('/api/deals', { headers });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { setErrorStatus(response.status); throw new Error(payload?.error || 'Não foi possível carregar os negócios.'); }
      setDeals(Array.isArray(payload?.data) ? payload.data : []);
      setSelectedDeal(current => current ? (payload.data || []).find((item: Deal) => item.id === current.id) || null : null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os negócios.'); }
    finally { setLoading(false); }
  }, [headers]);

  const loadDetail = useCallback(async (dealId: string) => {
    const requestId = ++detailRequestRef.current;
    setDetailState({ status: 'loading', data: null });
    try {
      const result = await productApi<{ data: DealDetail }>('/api/deals/' + encodeURIComponent(dealId), accessToken);
      if (requestId !== detailRequestRef.current) return;
      setDetailState({ status: 'success', data: result.data });
      setSelectedDeal(current => current?.id === dealId ? { ...current, ...result.data, risk: current.risk || result.data.risk } : current);
    } catch (cause) {
      if (requestId !== detailRequestRef.current) return;
      setDetailState({ status: getProductErrorState(cause), data: null, message: cause instanceof Error ? cause.message : 'Não foi possível carregar o detalhe do negócio.' });
    }
  }, [accessToken]);

  useEffect(() => {
    if (selectedDeal) void loadDetail(selectedDeal.id);
    else { detailRequestRef.current += 1; setDetailState({ status: 'loading', data: null }); }
  }, [loadDetail, selectedDeal?.id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!initialDealId || deals.length === 0) return;
    const found = deals.find(deal => deal.id === initialDealId);
    if (found) { setSelectedDeal(found); onInitialDealOpened?.(); }
  }, [deals, initialDealId, onInitialDealOpened]);
  useEffect(() => {
    if (!initialCreate) return;
    setShowForm(true);
    onInitialCreateOpened?.();
  }, [initialCreate, onInitialCreateOpened]);
  useEffect(() => {
    if (!selectedDeal) {
      const connectedOpener = openerRef.current?.isConnected ? openerRef.current : null;
      const refreshedOpener = openerDealIdRef.current
        ? Array.from(document.querySelectorAll<HTMLButtonElement>('[data-deal-trigger]')).find(button => button.dataset.dealTrigger === openerDealIdRef.current) || null
        : null;
      (connectedOpener || refreshedOpener)?.focus();
      openerRef.current = null;
      openerDealIdRef.current = null;
      return;
    }
    peekRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setSelectedDeal(null); }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedDeal?.id]);

  const filteredDeals = useMemo(() => deals.filter(deal => {
    const customer = clients.find(item => item.id === deal.customer_ref);
    const text = (deal.title + ' ' + (deal.description || '') + ' ' + (customer?.name || '')).toLocaleLowerCase('pt-BR');
    if (!text.includes(query.toLocaleLowerCase('pt-BR'))) return false;
    if (stageFilter !== 'all' && deal.stage !== stageFilter) return false;
    if (riskOnly && !deal.risk) return false;
    return true;
  }), [clients, deals, query, riskOnly, stageFilter]);

  const createDeal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(''); setErrorStatus(null); setNotice('');
    try {
      const valueCents = Math.round(Number(value.replace(',', '.')) * 100);
      if (!title.trim() || !Number.isFinite(valueCents) || valueCents < 0) throw new Error('Informe um título e um valor válido.');
      const response = await fetch('/api/deals', { method: 'POST', headers: { ...headers, 'x-idempotency-key': crypto.randomUUID() }, body: JSON.stringify({ title: title.trim(), customerRef: customerRef || undefined, valueCents, stage: 'new', expectedCloseOn: expectedCloseOn || undefined }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { setErrorStatus(response.status); throw new Error(payload?.error || 'Não foi possível criar o negócio.'); }
      setTitle(''); setCustomerRef(''); setValue(''); setExpectedCloseOn(''); setShowForm(false);
      await load();
      setNotice('Negócio criado e confirmado pelo servidor.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar o negócio.'); }
    finally { setSaving(false); }
  };

  const updateDeal = async (deal: Deal, patch: Record<string, unknown>) => {
    setSaving(true); setError(''); setErrorStatus(null); setNotice('');
    try {
      const response = await fetch('/api/deals/' + encodeURIComponent(deal.id), { method: 'PATCH', headers: { ...headers, 'x-idempotency-key': crypto.randomUUID() }, body: JSON.stringify(patch) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { setErrorStatus(response.status); throw new Error(payload?.error || 'Não foi possível atualizar o negócio.'); }
      await load();
      if (selectedDeal?.id === deal.id) await loadDetail(deal.id);
      setNotice(patch.stage ? 'Negócio movido para ' + (stages.find(item => item.id === patch.stage)?.label || patch.stage) + ' após confirmação do servidor.' : 'Alterações salvas pelo servidor.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o negócio.'); }
    finally { setSaving(false); }
  };

  const moveDeal = (dealId: string, nextStage: DealStage) => {
    const deal = deals.find(item => item.id === dealId);
    if (deal && ['won', 'lost'].includes(deal.stage)) {
      setError('Negócios encerrados não podem ser reabertos por esta interface.');
      setErrorStatus(423);
      setDraggedId(null);
      return;
    }
    if (deal && deal.stage !== nextStage) void updateDeal(deal, { stage: nextStage });
    setDraggedId(null);
  };

  const assessSelectedRisk = async () => {
    if (!selectedDeal?.customer_ref) return;
    setSaving(true); setError(''); setErrorStatus(null); setNotice('');
    try {
      const response = await fetch('/api/customers/' + encodeURIComponent(selectedDeal.customer_ref) + '/risk/assess', { method: 'POST', headers, body: '{}' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { setErrorStatus(response.status); throw new Error(payload?.error || 'Não foi possível avaliar o risco.'); }
      await load();
      await loadDetail(selectedDeal.id);
      setNotice('O servidor registrou uma nova avaliação. Revise os fatores retornados antes de tomar uma decisão.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível avaliar o risco.'); }
    finally { setSaving(false); }
  };

  const openPeek = (deal: Deal, trigger: HTMLElement) => {
    openerRef.current = trigger;
    openerDealIdRef.current = deal.id;
    setSelectedDeal(deal);
  };
  const archiveSelectedDeal = async () => {
    if (!selectedDeal || !window.confirm(`Arquivar “${selectedDeal.title}”? O registro poderá ser consultado no histórico administrativo.`)) return;
    const dealId = selectedDeal.id;
    setSaving(true); setError(''); setErrorStatus(null); setNotice('');
    try {
      const response = await fetch('/api/deals/' + encodeURIComponent(dealId), { method: 'DELETE', headers });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { setErrorStatus(response.status); throw new Error(payload?.error || 'Não foi possível arquivar o negócio.'); }
      if (payload?.data?.status !== 'archived') throw new Error('A API não confirmou o arquivamento do negócio.');
      setSelectedDeal(null);
      await load();
      setNotice('O negócio foi arquivado pelo servidor.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível arquivar o negócio.');
    } finally { setSaving(false); }
  };
  const totalOpen = filteredDeals.filter(deal => !['won', 'lost'].includes(deal.stage)).reduce((sum, deal) => sum + (typeof deal.value_cents === 'number' ? deal.value_cents : 0), 0);
  const missingValues = filteredDeals.some(deal => deal.value_cents == null);

  return (
    <div className="orkto-product mx-auto min-h-full w-full max-w-[1600px] space-y-5 px-4 py-5 pb-24 sm:px-6 sm:py-7 lg:px-8 lg:pb-8">
      <PageHeader eyebrow="Operação comercial" title="Negócios" description="Acompanhe oportunidades pela lista; use o pipeline quando precisar reorganizar etapas." actions={<><button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-medium orkto-product-border orkto-product-control"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Atualizar</button><button type="button" onClick={() => setShowForm(open => !open)} className="orkto-product-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-xs font-semibold"><Plus size={15} />Novo negócio</button></>} />

      {error && (errorStatus === 401 || errorStatus === 403 ? <PermissionState message={error} /> : errorStatus === 404 || errorStatus === 501 ? <BackendPending title="Negócios pendente neste ambiente" message={error} /> : <ErrorState title="Não foi possível concluir a operação" message={error} onRetry={() => void load()} />)}
      {notice && <div role="status" className="rounded-lg border p-3 text-sm orkto-product-border orkto-product-surface-muted">{notice}</div>}

      {showForm && <form onSubmit={createDeal} className="grid gap-3 rounded-xl border p-4 orkto-product-border orkto-product-surface sm:grid-cols-2 xl:grid-cols-5" aria-label="Criar negócio">
        <label className="text-xs font-medium sm:col-span-2 xl:col-span-2">Nome do negócio<input autoFocus required maxLength={180} value={title} onChange={event => setTitle(event.target.value)} placeholder="Nome da oportunidade" className="orkto-product-control mt-1.5 min-h-11 w-full rounded-lg px-3 text-sm" /></label>
        <label className="text-xs font-medium">Cliente<select value={customerRef} onChange={event => setCustomerRef(event.target.value)} className="orkto-product-control mt-1.5 min-h-11 w-full rounded-lg px-3 text-sm"><option value="">Sem cliente vinculado</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <label className="text-xs font-medium">Valor esperado (R$)<input required min="0" step="0.01" inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} placeholder="0,00" className="orkto-product-control mt-1.5 min-h-11 w-full rounded-lg px-3 text-sm" /></label>
        <label className="text-xs font-medium">Previsão de fechamento<input type="date" value={expectedCloseOn} onChange={event => setExpectedCloseOn(event.target.value)} className="orkto-product-control mt-1.5 min-h-11 w-full rounded-lg px-3 text-sm" /></label>
        <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-5"><button type="submit" disabled={saving} className="orkto-product-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-xs font-semibold disabled:opacity-60">{saving ? 'Salvando…' : 'Criar negócio'}</button><button type="button" onClick={() => setShowForm(false)} className="orkto-product-control min-h-11 rounded-lg px-4 text-xs">Cancelar</button></div>
      </form>}

      <section className="flex flex-col gap-3 rounded-xl border p-3 orkto-product-border orkto-product-surface sm:flex-row sm:items-center sm:justify-between" aria-label="Buscar e filtrar negócios">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row"><label className="relative block w-full sm:w-64"><span className="sr-only">Buscar negócio ou cliente</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 orkto-product-subtle" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar negócio ou cliente" className="orkto-product-control min-h-11 w-full rounded-lg pl-9 pr-3 text-sm" /></label><label><span className="sr-only">Filtrar etapa</span><select value={stageFilter} onChange={event => setStageFilter(event.target.value as 'all' | DealStage)} className="orkto-product-control min-h-11 w-full rounded-lg px-3 text-xs sm:w-44"><option value="all">Todas as etapas</option>{stages.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label><button type="button" onClick={() => setRiskOnly(value => !value)} aria-pressed={riskOnly} className={'min-h-11 rounded-lg border px-3 text-xs font-medium orkto-product-border ' + (riskOnly ? 'orkto-product-nav-active' : 'orkto-product-control')}>Com avaliação de risco</button></div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end"><p className="text-xs orkto-product-muted">{filteredDeals.length} negócio{filteredDeals.length === 1 ? '' : 's'} · Em aberto: <strong className="font-semibold tabular-nums">{formatMoney(totalOpen)}{missingValues ? ' + valores ausentes' : ''}</strong></p><div className="flex rounded-lg border p-1 orkto-product-border orkto-product-surface-muted" role="group" aria-label="Modo de visualização"><button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} className={'inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-xs ' + (view === 'list' ? 'orkto-product-nav-active' : 'orkto-product-muted')}><List size={15} />Lista</button><button type="button" onClick={() => setView('pipeline')} aria-pressed={view === 'pipeline'} className={'inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-xs ' + (view === 'pipeline' ? 'orkto-product-nav-active' : 'orkto-product-muted')}><Columns3 size={15} />Pipeline</button></div></div>
      </section>

      {loading ? <LoadingState rows={6} label="Carregando negócios" /> : error && !deals.length ? null : filteredDeals.length === 0 ? <EmptyState title={query || stageFilter !== 'all' || riskOnly ? 'Nenhum negócio neste filtro' : 'Seu pipeline está vazio'} description={query || stageFilter !== 'all' || riskOnly ? 'Ajuste ou limpe os filtros para ver outros negócios.' : 'Registre a primeira oportunidade para começar a acompanhar suas etapas.'} action={query || stageFilter !== 'all' || riskOnly ? <button type="button" onClick={() => { setQuery(''); setStageFilter('all'); setRiskOnly(false); }} className="orkto-product-control min-h-11 rounded-lg px-3 text-xs">Limpar filtros</button> : <button type="button" onClick={() => setShowForm(true)} className="orkto-product-primary min-h-11 rounded-lg px-4 text-xs font-semibold">Criar primeiro negócio</button>} /> : view === 'list' ? (
        <section aria-label="Lista de negócios" className="overflow-hidden rounded-xl border orkto-product-border orkto-product-surface">
          <div className="hidden grid-cols-[minmax(240px,2fr)_minmax(120px,0.8fr)_minmax(130px,1fr)_minmax(130px,1fr)_minmax(180px,1.5fr)] gap-3 border-b px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] orkto-product-border orkto-product-subtle md:grid"><span>Cliente / negócio</span><span>Valor</span><span>Etapa</span><span>Atualização</span><span>Sinal</span></div>
          <ul className="divide-y orkto-product-border">{filteredDeals.map(deal => {
            const client = clients.find(item => item.id === deal.customer_ref);
            const reasons = deal.risk?.reasons || [];
            return <li key={deal.id}><button type="button" data-deal-trigger={deal.id} onClick={event => openPeek(deal, event.currentTarget)} aria-label={'Abrir negócio ' + deal.title + (client?.name ? ', cliente ' + client.name : '') + ', ' + (stages.find(stage => stage.id === deal.stage)?.label || deal.stage) + ', valor ' + formatMoney(deal.value_cents)} className="grid min-h-[68px] w-full grid-cols-1 gap-2 px-4 py-3 text-left transition-colors hover:orkto-product-surface-muted md:grid-cols-[minmax(240px,2fr)_minmax(120px,0.8fr)_minmax(130px,1fr)_minmax(130px,1fr)_minmax(180px,1.5fr)] md:items-center md:gap-3">
              <span className="min-w-0"><span className="block truncate text-sm font-semibold">{client?.name || deal.title}</span><span className="mt-0.5 block truncate text-xs orkto-product-muted">{client?.name ? deal.title : 'Cliente não vinculado'}</span></span>
              <span className="flex items-center justify-between gap-3 text-sm font-medium tabular-nums md:block">{formatMoney(deal.value_cents)}<span className="text-[10px] font-normal orkto-product-subtle md:hidden">Valor</span></span>
              <span className="flex items-center justify-between gap-3"><StatusBadge>{stages.find(stage => stage.id === deal.stage)?.label || deal.stage}</StatusBadge><span className="text-[10px] orkto-product-subtle md:hidden">Etapa</span></span>
              <span className="flex items-center justify-between gap-3 text-xs orkto-product-muted">{deal.updated_at ? new Date(deal.updated_at).toLocaleDateString('pt-BR') : 'Sem data'}<span className="text-[10px] orkto-product-subtle md:hidden">Atualizado</span></span>
              <span className="min-w-0">{deal.risk ? <span className="flex flex-wrap items-center gap-2"><StatusBadge tone={riskTone(deal.risk.score)}>Avaliação de risco</StatusBadge><span className="truncate text-[11px] orkto-product-muted">{reasons[0] || 'Fatores explicativos não retornados'}</span></span> : <span className="text-xs orkto-product-subtle">Sem avaliação registrada</span>}</span>
            </button></li>;
          })}</ul>
        </section>
      ) : (
        <div className="grid auto-cols-[minmax(250px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-3" aria-label="Pipeline de negócios">{stages.map(stage => {
          const stageDeals = filteredDeals.filter(deal => deal.stage === stage.id);
          return <section key={stage.id} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain') || draggedId; if (id) moveDeal(id, stage.id); }} className="min-h-52 rounded-xl border p-3 orkto-product-border orkto-product-surface-muted" aria-label={stage.label + ', ' + stageDeals.length + ' negócios'}>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-semibold">{stage.label}</h2><span className="text-xs orkto-product-muted">{stageDeals.length}</span></div>
            {stageDeals.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-center text-xs orkto-product-border orkto-product-subtle">Sem negócios nesta etapa.</p> : <div className="space-y-2">{stageDeals.map(deal => {
              const client = clients.find(item => item.id === deal.customer_ref);
              const terminal = ['won', 'lost'].includes(deal.stage);
              return <article key={deal.id} draggable={!saving && !terminal} onDragStart={event => { event.dataTransfer.setData('text/plain', deal.id); setDraggedId(deal.id); }} onDragEnd={() => setDraggedId(null)} className="rounded-lg border p-3 orkto-product-border orkto-product-surface">
                <button type="button" data-deal-trigger={deal.id} onClick={event => openPeek(deal, event.currentTarget)} className="min-h-11 w-full text-left"><span className="block truncate text-sm font-semibold">{client?.name || deal.title}</span><span className="mt-1 block truncate text-xs orkto-product-muted">{client?.name ? deal.title : 'Cliente não vinculado'}</span><span className="mt-2 block text-xs font-medium tabular-nums">{formatMoney(deal.value_cents)}</span></button>
                <label className="mt-2 block text-[10px] font-medium orkto-product-muted">{terminal ? 'Negócio encerrado' : 'Mover para…'}<select value={deal.stage} disabled={saving || terminal} onChange={event => moveDeal(deal.id, event.target.value as DealStage)} className="orkto-product-control mt-1 min-h-10 w-full rounded-lg px-2 text-xs">{stages.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              </article>;
            })}</div>}
          </section>;
        })}</div>
      )}

      {selectedDeal && <div className="fixed inset-0 z-[120] flex justify-end" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedDeal(null); }}>
        <button type="button" onClick={() => setSelectedDeal(null)} aria-label="Fechar detalhe do negócio" className="absolute inset-0 bg-[var(--orkto-overlay)]" />
        <aside ref={peekRef} role="dialog" aria-modal="true" aria-labelledby="deal-detail-title" tabIndex={-1} onKeyDown={event => { if (event.key === 'Escape') setSelectedDeal(null); }} className="relative h-full w-full overflow-y-auto border-l p-5 shadow-[var(--orkto-shadow-panel)] outline-none orkto-product-border orkto-product-surface sm:max-w-[440px]">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--orkto-brand-text)' }}>Prévia do negócio</p><h2 id="deal-detail-title" className="mt-1 text-lg font-semibold">{selectedDeal.title}</h2></div><button type="button" onClick={() => setSelectedDeal(null)} aria-label="Fechar prévia" className="flex h-11 w-11 items-center justify-center rounded-lg orkto-product-muted hover:orkto-product-surface-muted"><X size={18} /></button></div>
          <dl className="mt-5 divide-y orkto-product-border"><div className="flex justify-between gap-4 py-3 text-xs"><dt className="orkto-product-muted">Cliente</dt><dd className="text-right">{clients.find(item => item.id === selectedDeal.customer_ref)?.name || 'Sem cliente vinculado'}</dd></div><div className="flex justify-between gap-4 py-3 text-xs"><dt className="orkto-product-muted">Valor esperado</dt><dd className="text-right font-medium tabular-nums">{formatMoney(selectedDeal.value_cents)}</dd></div><div className="flex justify-between gap-4 py-3 text-xs"><dt className="orkto-product-muted">Etapa</dt><dd className="text-right">{stages.find(stage => stage.id === selectedDeal.stage)?.label || selectedDeal.stage}</dd></div><div className="flex justify-between gap-4 py-3 text-xs"><dt className="orkto-product-muted">Probabilidade</dt><dd className="text-right">{selectedDeal.probability_percent == null ? 'Não definida' : String(selectedDeal.probability_percent) + '%'}</dd></div><div className="flex justify-between gap-4 py-3 text-xs"><dt className="orkto-product-muted">Previsão</dt><dd className="text-right">{selectedDeal.expected_close_on ? new Date(selectedDeal.expected_close_on + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não definida'}</dd></div>{selectedDeal.owner_name && <div className="flex justify-between gap-4 py-3 text-xs"><dt className="orkto-product-muted">Responsável</dt><dd className="text-right">{selectedDeal.owner_name}</dd></div>}{selectedDeal.next_action && <div className="flex justify-between gap-4 py-3 text-xs"><dt className="orkto-product-muted">Próxima ação</dt><dd className="max-w-[60%] text-right">{selectedDeal.next_action}</dd></div>}</dl>
          {selectedDeal.description && <section className="mt-4"><h3 className="text-xs font-semibold">Descrição</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 orkto-product-muted">{selectedDeal.description}</p></section>}
          {selectedDeal.risk && <section className="mt-4 rounded-lg border p-3 orkto-product-border orkto-product-surface-muted" aria-labelledby="deal-risk-title"><div className="flex flex-wrap items-center justify-between gap-2"><h3 id="deal-risk-title" className="text-xs font-semibold">Avaliação de risco</h3><StatusBadge tone={riskTone(selectedDeal.risk.score)}>Score retornado: {selectedDeal.risk.score}/100</StatusBadge></div>{selectedDeal.risk.reasons?.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 orkto-product-muted">{selectedDeal.risk.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul> : <p className="mt-2 text-xs leading-5 orkto-product-muted">O servidor não retornou fatores explicativos; trate o score como incompleto.</p>}{selectedDeal.risk.confidence != null && <p className="mt-2 text-[11px] orkto-product-subtle">Confiança retornada: {Math.round(selectedDeal.risk.confidence * 100)}%</p>}{selectedDeal.risk.recommended_action && <p className="mt-2 text-xs leading-5">Ação recomendada: {selectedDeal.risk.recommended_action}</p>}</section>}
          {detailState.status === 'loading' && <section className="mt-5" aria-label="Carregando relações e histórico"><LoadingState rows={2} label="Carregando detalhe do negócio" /></section>}
          {detailState.status === 'permission_denied' && <div className="mt-5"><PermissionState message="Seu acesso não permite consultar relações e histórico deste negócio." /></div>}
          {detailState.status === 'configuration_required' && <div className="mt-5"><ConfigurationRequired title="Detalhe indisponível por configuração" message={detailState.message || 'A consulta do detalhe exige uma configuração do workspace.'} /></div>}
          {detailState.status === 'backend_pending' && <div className="mt-5"><BackendPending title="Detalhe pendente neste ambiente" message={detailState.message || 'O contrato de detalhe ainda não está disponível.'} /></div>}
          {(detailState.status === 'error' || detailState.status === 'offline') && <div className="mt-5"><ErrorState title="Não foi possível carregar o detalhe completo" message={detailState.message || 'Tente novamente para confirmar histórico e relações.'} onRetry={() => void loadDetail(selectedDeal.id)} /></div>}
          {detailState.status === 'success' && <>
            <section className="mt-5 border-t pt-4 orkto-product-border" aria-labelledby="deal-related-proposals">
              <h3 id="deal-related-proposals" className="text-xs font-semibold">Propostas relacionadas</h3>
              {detailState.data?.proposals?.length ? <ul className="mt-2 divide-y orkto-product-border">{detailState.data.proposals.map(proposal => <li key={proposal.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-xs font-medium">Proposta {proposal.quote_number ?? 'sem número retornado'}</p><p className="mt-1 text-[11px] orkto-product-muted">{proposal.status || 'Status não informado'}{proposal.created_at ? ` · ${new Date(proposal.created_at).toLocaleDateString('pt-BR')}` : ''}</p></div><div className="flex shrink-0 items-center gap-2">{typeof proposal.total === 'number' && <span className="text-xs tabular-nums">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proposal.total)}</span>}{onOpenQuote && <button type="button" onClick={() => { setSelectedDeal(null); onOpenQuote(proposal.id); }} className="min-h-11 rounded-lg border px-3 text-xs font-medium orkto-product-border orkto-product-control">Abrir</button>}</div></li>)}</ul> : <p className="mt-2 text-xs leading-5 orkto-product-muted">Nenhuma proposta relacionada foi retornada pela API.</p>}
            </section>
            <section className="mt-4 border-t pt-4 orkto-product-border" aria-labelledby="deal-activity-history">
              <h3 id="deal-activity-history" className="text-xs font-semibold">Atividade recente</h3>
              {detailState.data?.history?.length ? <ol className="mt-2 space-y-2">{[...detailState.data.history].reverse().slice(0, 8).map((event, index) => <li key={event.id || `${event.event_type || 'event'}-${index}`} className="rounded-lg border p-3 orkto-product-border orkto-product-surface-muted"><p className="text-xs font-medium">{(event.event_type || 'Atividade registrada').replaceAll('_', ' ')}</p><p className="mt-1 text-[11px] orkto-product-subtle">{event.occurred_at ? new Date(event.occurred_at).toLocaleString('pt-BR') : 'Data não retornada'}</p></li>)}</ol> : <p className="mt-2 text-xs leading-5 orkto-product-muted">Nenhuma atividade vinculada foi retornada.</p>}
            </section>
            {detailState.data?.contextual_memories?.length ? <details className="mt-4 border-t pt-4 orkto-product-border"><summary className="cursor-pointer text-xs font-semibold">Memória comercial relacionada ({detailState.data.contextual_memories.length})</summary><ul className="mt-2 space-y-2">{detailState.data.contextual_memories.map(memory => <li key={memory.id} className="rounded-lg border p-3 orkto-product-border orkto-product-surface-muted"><p className="text-xs font-medium">{memory.memory_type?.replaceAll('_', ' ') || 'Memória relacionada'}</p><p className="mt-1 text-[11px] orkto-product-muted">{typeof memory.content === 'string' ? memory.content : 'Conteúdo estruturado retornado pela memória comercial.'}</p><p className="mt-1 text-[10px] orkto-product-subtle">{memory.created_at ? new Date(memory.created_at).toLocaleString('pt-BR') : 'Data não retornada'}{memory.confidence != null ? ` · confiança ${Math.round(memory.confidence * 100)}%` : ''}</p></li>)}</ul></details> : null}
          </>}
          <label className="mt-5 block text-xs font-medium">{['won', 'lost'].includes(selectedDeal.stage) ? 'Negócio encerrado' : 'Mover para…'}<select value={selectedDeal.stage} disabled={saving || ['won', 'lost'].includes(selectedDeal.stage)} onChange={event => void updateDeal(selectedDeal, { stage: event.target.value })} className="orkto-product-control mt-1.5 min-h-11 w-full rounded-lg px-3 text-sm">{stages.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          {selectedDeal.customer_ref && <button type="button" onClick={() => void assessSelectedRisk()} disabled={saving} className="mt-3 min-h-11 rounded-lg border px-3 text-xs font-medium orkto-product-border orkto-product-control disabled:opacity-55">{saving ? 'Avaliando…' : selectedDeal.risk ? 'Reavaliar risco' : 'Solicitar avaliação de risco'}</button>}
          <p className="mt-4 text-[11px] leading-5 orkto-product-subtle">O tempo na etapa não foi informado pelo contrato atual.</p>
          {error && <div className="mt-4" role="alert"><ErrorState title="A alteração não foi confirmada" message={error} /></div>}
          <div className="sr-only" aria-live="polite">{notice}</div>
          <button type="button" onClick={() => void archiveSelectedDeal()} disabled={saving} className="mt-5 min-h-11 w-full rounded-lg border px-3 text-xs font-medium orkto-product-border orkto-product-control disabled:opacity-55">{saving ? 'Aguarde…' : 'Arquivar negócio'}</button>
        </aside>
      </div>}
    </div>
  );
}
