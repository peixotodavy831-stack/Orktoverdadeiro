import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, Check, Clock3, HandCoins, RefreshCw, ShieldCheck } from 'lucide-react';
import type { SavedClient } from '../types';

type CollectionStatus = 'OPEN' | 'CONTACTED' | 'NEGOTIATING' | 'PROMISED' | 'PAID' | 'ESCALATED' | 'CLOSED';
type CollectionTone = 'cordial' | 'standard' | 'firm';

interface CollectionEvent {
  id: string;
  event_type: string;
  note: string | null;
  occurred_at: string;
}

interface CollectionCase {
  id: string;
  customer_ref: string;
  amount_cents: number;
  due_at: string;
  status: string;
  tone: CollectionTone;
  promise_at: string | null;
  next_followup_at: string | null;
  events: CollectionEvent[];
}

interface CollectionConfig {
  targetCents?: number | null;
  defaultTone?: CollectionTone;
  escalationAfterDays?: number;
}

interface PendingContactAction {
  id: string;
  payload: { caseId?: string; messageDraft?: string; externalDelivery?: string };
}

interface CollectionPageProps {
  clients: SavedClient[];
  accessToken: string | null;
}

const statuses: CollectionStatus[] = ['OPEN', 'CONTACTED', 'NEGOTIATING', 'PROMISED', 'PAID', 'ESCALATED', 'CLOSED'];
const statusLabels: Record<CollectionStatus, string> = {
  OPEN: 'Aberto', CONTACTED: 'Contatado', NEGOTIATING: 'Em negociação', PROMISED: 'Promessa de pagamento',
  PAID: 'Pago', ESCALATED: 'Escalado', CLOSED: 'Encerrado',
};
const transitions: Record<CollectionStatus, CollectionStatus[]> = {
  OPEN: ['CONTACTED', 'PAID', 'CLOSED'],
  CONTACTED: ['NEGOTIATING', 'PROMISED', 'PAID', 'ESCALATED', 'CLOSED'],
  NEGOTIATING: ['PROMISED', 'PAID', 'ESCALATED', 'CLOSED'],
  PROMISED: ['PAID', 'ESCALATED', 'CLOSED'],
  PAID: ['CLOSED'],
  ESCALATED: ['NEGOTIATING', 'PROMISED', 'PAID', 'CLOSED'],
  CLOSED: [],
};

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const localDateTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export default function CollectionPage({ clients, accessToken }: CollectionPageProps) {
  const [cases, setCases] = useState<CollectionCase[]>([]);
  const [configuration, setConfiguration] = useState<CollectionConfig>({});
  const [pendingContactActions, setPendingContactActions] = useState<PendingContactAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CollectionStatus>('ALL');
  const [customerRef, setCustomerRef] = useState('');
  const [amount, setAmount] = useState('');
  const [dueAt, setDueAt] = useState(() => localDateTime(new Date(Date.now() + 86_400_000)));
  const [tone, setTone] = useState<CollectionTone>('standard');
  const [target, setTarget] = useState('');
  const [escalationDays, setEscalationDays] = useState('7');

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/collections', { headers });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar a Central de Cobrança.');
      setCases(payload.data || []);
      setPendingContactActions(payload.pendingActions || []);
      const nextConfig = payload.configuration?.config || {};
      setConfiguration(nextConfig);
      setTarget(nextConfig.targetCents == null ? '' : String(Number(nextConfig.targetCents) / 100));
      setEscalationDays(String(nextConfig.escalationAfterDays || 7));
      if (nextConfig.defaultTone) setTone(nextConfig.defaultTone);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a Central de Cobrança.');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { void load(); }, [load]);

  const filteredCases = cases.filter(item => statusFilter === 'ALL' || item.status.toUpperCase() === statusFilter);
  const openCases = cases.filter(item => !['paid', 'closed'].includes(item.status.toLowerCase()));
  const overdueCents = openCases.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
  const clientName = (ref: string) => clients.find(client => client.id === ref)?.name || 'Cliente não localizado';

  const createCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(''); setSuccess(''); setSaving(true);
    try {
      const amountCents = Math.round(Number(amount.replace(',', '.')) * 100);
      if (!customerRef || !Number.isFinite(amountCents) || amountCents <= 0 || !dueAt) throw new Error('Escolha um cliente, informe um valor e uma data válida.');
      const response = await fetch('/api/collections', {
        method: 'POST', headers,
        body: JSON.stringify({ customerRef, amountCents, dueAt: new Date(dueAt).toISOString(), tone, idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível abrir o caso.');
      setSuccess(payload.idempotentReplay ? 'Este caso já existia; nenhuma cobrança duplicada foi criada.' : 'Caso de acompanhamento criado. Nenhuma mensagem foi enviada ao cliente.');
      setCustomerRef(''); setAmount('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o caso.');
    } finally { setSaving(false); }
  };

  const changeStatus = async (item: CollectionCase, nextStatus: CollectionStatus) => {
    setError(''); setSuccess(''); setSaving(true);
    try {
      const note = window.prompt(`Nota interna para “${statusLabels[nextStatus]}” (opcional):`) || '';
      const body: Record<string, string> = { status: nextStatus, note };
      if (nextStatus === 'PROMISED') {
        const promiseDate = window.prompt('Data/hora prometida (opcional; formato ISO, ex.: 2026-10-02T10:00:00-03:00):');
        if (promiseDate) body.promiseAt = new Date(promiseDate).toISOString();
      }
      const response = await fetch(`/api/collections/${encodeURIComponent(item.id)}/status`, { method: 'PATCH', headers, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível atualizar o estado.');
      setSuccess(`Caso atualizado para ${statusLabels[nextStatus].toLowerCase()}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o estado.');
    } finally { setSaving(false); }
  };

  const prepareContact = async (item: CollectionCase) => {
    setError(''); setSuccess(''); setSaving(true);
    try {
      const response = await fetch(`/api/collections/${encodeURIComponent(item.id)}/prepare-contact`, { method:'POST', headers, body:JSON.stringify({}) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível preparar o contato.');
      setSuccess('Rascunho preparado para aprovação. Nenhuma cobrança foi enviada.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível preparar o contato.'); }
    finally { setSaving(false); }
  };

  const approveContactTask = async (action: PendingContactAction) => {
    setError(''); setSuccess(''); setSaving(true);
    try {
      const response = await fetch(`/api/wia/actions/${encodeURIComponent(action.id)}/approve`, { method:'POST', headers, body:JSON.stringify({ confirm:true }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível aprovar o rascunho.');
      setSuccess('Aprovação registrada e tarefa interna criada. O envio externo continua CONFIGURATION_REQUIRED até conectar um canal.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível aprovar o rascunho.'); }
    finally { setSaving(false); }
  };

  const saveConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setSuccess(''); setSaving(true);
    try {
      const parsedTarget = target.trim() ? Math.round(Number(target.replace(',', '.')) * 100) : null;
      const parsedEscalation = Number(escalationDays);
      if (parsedTarget !== null && (!Number.isFinite(parsedTarget) || parsedTarget < 0)) throw new Error('A meta precisa ser um valor válido.');
      if (!Number.isInteger(parsedEscalation) || parsedEscalation < 1 || parsedEscalation > 90) throw new Error('O prazo de escalonamento deve ficar entre 1 e 90 dias.');
      const response = await fetch('/api/collections/config', { method: 'PUT', headers, body: JSON.stringify({ targetCents: parsedTarget, defaultTone: tone, escalationAfterDays: parsedEscalation, status: 'ACTIVE' }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível salvar a configuração.');
      setConfiguration(payload.data?.config || {});
      setSuccess('Meta e política de acompanhamento salvas.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a configuração.');
    } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF9F1C]">Operação financeira · equipe</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-3xl">Central de Cobrança</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Acompanhe valores vencidos, promessas e próximos passos. Este módulo registra trabalho interno — não envia cobranças automaticamente.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Atualizar</button>
      </header>

      {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</div>}
      {success && <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200"><Check size={17} className="mt-0.5 shrink-0" />{success}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Casos em aberto" value={String(openCases.length)} detail="Exclui casos pagos e encerrados" icon={<HandCoins size={17} />} />
        <MetricCard label="Valor acompanhado" value={money(overdueCents)} detail="Soma dos casos ainda abertos" icon={<Clock3 size={17} />} />
        <MetricCard label="Meta configurada" value={configuration.targetCents == null ? 'Não definida' : money(Number(configuration.targetCents))} detail={`Escalonamento em ${configuration.escalationAfterDays || 7} dias`} icon={<ShieldCheck size={17} />} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)]">
        <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Casos de acompanhamento</h2><p className="mt-1 text-xs text-zinc-500">Atualizações registradas no histórico do workspace.</p></div>
            <select aria-label="Filtrar casos por estado" value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <option value="ALL">Todos os estados</option>{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </div>
          {loading ? <div role="status" className="flex min-h-36 items-center justify-center gap-2 text-sm text-zinc-500"><RefreshCw size={16} className="animate-spin text-[#FF9F1C]" />Carregando casos…</div>
            : filteredCases.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-300 px-5 py-10 text-center dark:border-zinc-800"><HandCoins className="mx-auto h-6 w-6 text-zinc-400" /><p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">Nenhum caso neste filtro</p><p className="mt-1 text-xs text-zinc-500">Crie um caso quando houver um pagamento vencido ou acordo a acompanhar.</p></div>
              : <div className="space-y-3">{filteredCases.map(item => {
                const status = item.status.toUpperCase() as CollectionStatus;
                return <article key={item.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{clientName(item.customer_ref)}</h3><span className="rounded-full border border-zinc-300 px-2 py-1 text-[10px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">{statusLabels[status] || item.status}</span></div><p className="mt-2 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{money(Number(item.amount_cents))}</p><p className="mt-1 text-xs text-zinc-500">Vencimento: {new Date(item.due_at).toLocaleDateString('pt-BR')} · Tom {item.tone === 'firm' ? 'firme' : item.tone === 'cordial' ? 'cordial' : 'padrão'}</p>{item.promise_at && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Promessa: {new Date(item.promise_at).toLocaleString('pt-BR')}</p>}</div>
                    {transitions[status]?.length > 0 && <select aria-label={`Atualizar estado de ${clientName(item.customer_ref)}`} defaultValue="" disabled={saving} onChange={event => { const next = event.target.value as CollectionStatus; if (next) void changeStatus(item, next); event.target.value = ''; }} className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"><option value="" disabled>Mover para…</option>{transitions[status].map(next => <option key={next} value={next}>{statusLabels[next]}</option>)}</select>}
                  </div>
                  {pendingContactActions.filter(action => action.payload?.caseId === item.id).map(action => <div key={action.id} className="mt-3 rounded-xl border border-[#FF9F1C]/30 bg-[#FF9F1C]/5 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-[#ffb54d]">Rascunho WIA · aguardando aprovação</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-700 dark:text-zinc-300">{action.payload.messageDraft}</p><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-zinc-500">Nenhuma mensagem será enviada sem canal configurado.</span><button type="button" onClick={() => void approveContactTask(action)} disabled={saving} className="min-h-9 rounded-lg bg-[#FF9F1C] px-3 text-[10px] font-bold text-zinc-950 disabled:opacity-50">Aprovar revisão e criar tarefa</button></div></div>)}
                  {!pendingContactActions.some(action => action.payload?.caseId === item.id) && !['paid','closed'].includes(item.status.toLowerCase()) && <button type="button" onClick={() => void prepareContact(item)} disabled={saving} className="mt-3 min-h-9 rounded-lg border border-[#FF9F1C]/40 px-3 text-xs font-semibold text-amber-800 hover:bg-[#FF9F1C]/10 disabled:opacity-50 dark:text-[#ffb54d]">{saving ? 'Preparando…' : 'Preparar contato com WIA'}</button>}
                  {item.events?.length > 0 && <ol className="mt-3 border-l border-zinc-200 pl-3 dark:border-zinc-800">{item.events.slice(-3).reverse().map(event => <li key={event.id} className="mb-2 text-xs text-zinc-500"><span className="font-medium text-zinc-700 dark:text-zinc-300">{event.event_type.replaceAll('_', ' ')}</span>{event.note ? ` · ${event.note}` : ''}<span className="ml-2 text-[10px]">{new Date(event.occurred_at).toLocaleString('pt-BR')}</span></li>)}</ol>}
                </article>;
              })}</div>}
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 sm:p-5">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Abrir acompanhamento</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Cria um registro interno. Nenhum cliente será contatado por esta ação.</p>
            <form onSubmit={createCase} className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Cliente<select required value={customerRef} onChange={event => setCustomerRef(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="">Selecione um cliente</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}{client.company ? ` · ${client.company}` : ''}</option>)}</select></label>
              {clients.length === 0 && <p className="text-xs text-amber-700 dark:text-amber-300">Cadastre um cliente antes de abrir um acompanhamento.</p>}
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Valor (R$)<input required min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0,00" className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></label>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Vencimento<input required type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></label>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Tom para rascunhos futuros<select value={tone} onChange={event => setTone(event.target.value as CollectionTone)} className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="cordial">Cordial</option><option value="standard">Padrão</option><option value="firm">Firme</option></select></label>
              <button type="submit" disabled={saving || loading || clients.length === 0} className="min-h-11 w-full rounded-lg bg-[#FF9F1C] px-4 text-sm font-semibold text-zinc-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Salvando…' : 'Criar acompanhamento'}</button>
            </form>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 sm:p-5">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Política da central</h2>
            <p className="mt-1 text-xs text-zinc-500">Meta e escalonamento são configurações versionadas do workspace.</p>
            <form onSubmit={saveConfig} className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Meta de cobrança (R$, opcional)<input inputMode="decimal" value={target} onChange={event => setTarget(event.target.value)} placeholder="Não definida" className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></label>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Escalonar após (dias)<input type="number" min="1" max="90" value={escalationDays} onChange={event => setEscalationDays(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></label>
              <button type="submit" disabled={saving || loading} className="min-h-10 rounded-lg border border-zinc-300 px-4 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900">Salvar política</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70"><div className="flex items-center gap-2 text-xs font-medium text-zinc-500">{icon}{label}</div><p className="mt-3 text-xl font-semibold tabular-nums text-zinc-950 dark:text-white">{value}</p><p className="mt-1 text-[11px] text-zinc-500">{detail}</p></div>;
}
