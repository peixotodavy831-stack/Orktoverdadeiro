import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CircleDollarSign, Loader2, RefreshCw, Save, Wallet, Plus } from 'lucide-react';
import { formatBRL } from '../../utils/format';
import type { AiModelRate, ChannelUsageCostSummary, FinanceAssumptions, FinancePlanKey, FinanceProjection, FinanceScenarioKey } from '../../../backend/finance/finance-model';

type Transaction = {
  id: string;
  transaction_type: 'revenue' | 'expense';
  category: string;
  basis: 'actual' | 'normalized';
  cash_status: 'paid' | 'forecast';
  amount_cents: number;
  occurred_on: string;
  workspace_id: string | null;
  provider: string | null;
  model: string | null;
  feature: string | null;
  note: string;
};

type DashboardData = {
  month: string;
  assumptions: { id: string; version: number; status: string; assumptions: FinanceAssumptions; change_note: string; created_at: string } | null;
  assumptionsFallback: FinanceAssumptions | null;
  assumptionsHistory: Array<{ id: string; version: number; status: string; assumptions: FinanceAssumptions; change_note: string; created_at: string }>;
  projections: Array<FinanceProjection & { projectionKey: string }>;
  actual: {
    activePlanCustomers: number; paidSubscribers: number; mrrCents: number; arrCents: number; arpaCents: number;
    technicalCogsCents: number; technicalCogsPercent: number | null; economicMarginCents: number;
    channelCostsCents: number; channelAdjustedOperatingResultCents: number; costByCategory: Record<string, number>;
    normalizedTechnicalCogsCents: number | null; normalizedTechnicalCogsPercent: number | null;
    normalizedEconomicMarginCents: number | null; normalizedChannelCostsCents: number;
    normalizedChannelAdjustedOperatingResultCents: number | null;
    aiUsageEstimate: { estimatedCostCents: number; pricedEvents: number; unpricedEvents: number; simulatedEvents: number; recordedActualCashCostCents: number | null; recordedNormalizedCostCents: number | null; foreignTrackedCostEvents: number; note: string; byModel: Array<{ provider: string; model: string; events: number; costCents: number }> } | null;
    channelUsageTelemetry: ChannelUsageCostSummary & { note: string };
    workspaceCosts: Array<{ workspaceId: string; actualTechnicalCogsCents: number; actualChannelCents: number; estimatedAiUsageCents: number }>;
    cashInCents: number; cashOutCents: number; netCashFlowCents: number; cashClosingEstimateCents: number; alerts: string[];
  };
  transactions: Transaction[];
};

const plans: Array<{ key: FinancePlanKey; label: string }> = [
  { key: 'starter', label: 'Starter' }, { key: 'pro', label: 'Pro' }, { key: 'business', label: 'Business' },
  { key: 'scale', label: 'Scale' }, { key: 'enterprise', label: 'Enterprise' }, { key:'founders',label:'Founders' }, { key:'legacy_standard',label:'Legacy Standard' },
];
const scenarios: Array<{ key: FinanceScenarioKey; label: string }> = [
  { key: 'pok', label: 'POK' }, { key: 'base', label: 'Base' }, { key: 'favorable', label: 'Favorável' },
];
const customerVolumes = [10, 100, 1000, 10000];
const categories = [
  { key: 'infrastructure', label: 'Infraestrutura' }, { key: 'ai', label: 'IA' }, { key: 'channel', label: 'Canal' },
  { key: 'payment_processor', label: 'Processador de pagamentos' }, { key: 'people', label: 'Equipe' },
  { key: 'tax', label: 'Impostos' }, { key: 'other', label: 'Outro' },
];
const fmt = (cents: number) => formatBRL(Number(cents || 0) / 100);
const moneyInput = (cents: number) => (Number(cents || 0) / 100).toFixed(2);
const centsInput = (value: string) => Math.round(Math.max(0, Number(value.replace(',', '.')) || 0) * 100);
const percent = (value: number | null) => value === null ? 'Sem base de cobrança' : `${value.toFixed(1)}%`;

function Metric({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: typeof Wallet }) {
  return <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
    <div className="mb-3 flex items-center justify-between text-xs text-zinc-500"><span>{label}</span><Icon className="h-4 w-4 text-orange-500" /></div>
    <div className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{value}</div>
    {hint && <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>}
  </section>;
}

function ProjectionCard({ projection, label }: { projection: FinanceProjection; label: string }) {
  return <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
    <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{label}</h3><span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{projection.customers.toLocaleString('pt-BR')} clientes</span></div>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <dt className="text-zinc-500">MRR projetado</dt><dd className="text-right font-medium">{fmt(projection.mrrCents)}</dd>
      <dt className="text-zinc-500">ARR projetado</dt><dd className="text-right font-medium">{fmt(projection.arrCents)}</dd>
      <dt className="text-zinc-500">COGS técnico</dt><dd className="text-right font-medium">{fmt(projection.technicalCogsCents)} · {percent(projection.technicalCogsPercent)}</dd>
      <dt className="text-zinc-500">Margem econômica</dt><dd className="text-right font-medium">{fmt(projection.economicMarginCents)}</dd>
      <dt className="text-zinc-500">Canal (separado)</dt><dd className="text-right font-medium">{fmt(projection.channelCostsCents)}</dd>
      <dt className="text-zinc-500">Caixa projetado</dt><dd className="text-right font-medium">{fmt(projection.pokCashEndCents)}</dd>
      <dt className="text-zinc-500">Clientes para equilíbrio</dt><dd className="text-right font-medium">{projection.breakEvenCustomers?.toLocaleString('pt-BR') ?? 'Não calculável'}</dd>
    </dl>
    {projection.alerts.map(alert => <p key={alert} className="mt-3 flex gap-2 text-[11px] text-amber-600 dark:text-amber-400"><AlertTriangle className="h-4 w-4 shrink-0" />{alert}</p>)}
  </div>;
}

export default function FinanceDashboard({ accessToken }: { accessToken: string | null }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [assumptions, setAssumptions] = useState<FinanceAssumptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scenario, setScenario] = useState<FinanceScenarioKey>('base');
  const [customers, setCustomers] = useState(100);
  const [changeNote, setChangeNote] = useState('');
  const [transactionType, setTransactionType] = useState<'expense' | 'revenue'>('expense');
  const [category, setCategory] = useState('ai');
  const [basis, setBasis] = useState<'actual' | 'normalized'>('actual');
  const [cashStatus, setCashStatus] = useState<'paid' | 'forecast'>('paid');
  const [amount, setAmount] = useState('');
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [workspaceId, setWorkspaceId] = useState('');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [feature, setFeature] = useState('');
  const [note, setNote] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);
  const [rateProvider, setRateProvider] = useState('gemini');
  const [rateModel, setRateModel] = useState('');
  const [rateInput, setRateInput] = useState('');
  const [rateCachedInput, setRateCachedInput] = useState('');
  const [rateOutput, setRateOutput] = useState('');
  const [rateEffectiveFrom, setRateEffectiveFrom] = useState(new Date().toISOString().slice(0,10));

  const load = useCallback(async () => {
    if (!accessToken) { setError('Sessão necessária para carregar o financeiro interno.'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/internal/finance/dashboard', { headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar os dados.');
      setData(payload);
      setAssumptions(payload.assumptions?.assumptions || payload.assumptionsFallback || null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro de conexão.'); }
    finally { setLoading(false); }
  }, [accessToken]);
  useEffect(() => { void load(); }, [load]);

  const headers = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken || ''}` }), [accessToken]);
  const update = <K extends keyof FinanceAssumptions>(key: K, value: FinanceAssumptions[K]) => setAssumptions(current => current ? { ...current, [key]: value } : current);
  const projections = useMemo(() => data?.projections.filter(item => item.customers === customers) || [], [data, customers]);

  const saveAssumptions = async () => {
    if (!assumptions || !accessToken) return;
    setSaving(true); setNotice(''); setError('');
    try {
      const response = await fetch('/api/internal/finance/assumptions', { method: 'POST', headers, body: JSON.stringify({ assumptions, changeNote }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar as premissas.');
      setNotice(`Premissas salvas como versão ${payload.version} (rascunho).`);
      setChangeNote(''); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const addTransaction = async (event: React.FormEvent) => {
    event.preventDefault(); if (!accessToken) return;
    setSavingEntry(true); setNotice(''); setError('');
    try {
      const response = await fetch('/api/internal/finance/transactions', { method: 'POST', headers, body: JSON.stringify({
        transactionType, category: transactionType === 'revenue' ? 'other' : category, basis, cashStatus,
        amountCents: centsInput(amount), occurredOn, workspaceId: workspaceId || null,
        provider, model, feature, note,
      }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível registrar o lançamento.');
      setNotice('Lançamento registrado.'); setAmount(''); setNote(''); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao registrar lançamento.'); }
    finally { setSavingEntry(false); }
  };

  const setPlanField = (field: 'planPricesCents' | 'planMixPercent', key: FinancePlanKey, value: number) => {
    if (!assumptions) return;
    setAssumptions({ ...assumptions, [field]: { ...assumptions[field], [key]: Math.max(0, Math.round(value)) } });
  };
  const setScenarioField = (key: FinanceScenarioKey, field: 'revenueFactor' | 'costFactor', value: number) => {
    if (!assumptions) return;
    setAssumptions({ ...assumptions, scenarios: { ...assumptions.scenarios, [key]: { ...assumptions.scenarios[key], [field]: Math.max(0, value) } } });
  };
  const addModelRate = () => {
    if (!assumptions || !rateProvider.trim() || !rateModel.trim()) return;
    const nextRate: AiModelRate = {
      provider: rateProvider.trim(), model: rateModel.trim(),
      inputUsdPerMillionTokens: Number(rateInput) || 0,
      cachedInputUsdPerMillionTokens: Number(rateCachedInput) || 0,
      outputUsdPerMillionTokens: Number(rateOutput) || 0, active: true,
      effectiveFrom: new Date(`${rateEffectiveFrom}T00:00:00.000Z`).toISOString(),
    };
    update('aiModelRates', [...(assumptions.aiModelRates || []), nextRate]);
    setRateModel(''); setRateInput(''); setRateCachedInput(''); setRateOutput('');
  };

  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.18em] text-orange-500">ORKTO · uso interno</p><h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">Financeiro</h1><p className="mt-1 text-sm text-zinc-500">POK Caixa, POK Econômico, custos e premissas versionadas.</p></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium dark:border-zinc-700"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</button>
    </header>
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
      Dados observados são derivados de pagamentos de assinatura identificáveis e lançamentos marcados como realizados. Simulações e preços abaixo são hipóteses editáveis, não preço aprovado nem previsão contábil. Canal fica fora do COGS técnico e aparece separadamente. Cobranças sintéticas do checkout recorrente estão temporariamente excluídas até conciliação por ID; o primeiro MRR/caixa pode ficar subcontado.
    </div>
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div className="flex-1">{error}</div><button onClick={() => void load()} className="underline">Tentar novamente</button></div>}
    {notice && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
    {loading && !data ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" />Carregando dados financeiros…</div> : data && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="MRR observado" value={fmt(data.actual.mrrCents)} hint={`${data.actual.paidSubscribers} assinantes com cobrança identificável`} icon={CircleDollarSign} />
        <Metric label="ARR observado" value={fmt(data.actual.arrCents)} hint="MRR atual × 12; run-rate, não receita recebida" icon={ArrowUpRight} />
        <Metric label="ARPA observado" value={fmt(data.actual.arpaCents)} hint="MRR observado ÷ assinantes conciliados" icon={Wallet} />
        <Metric label="POK Econômico · proxy" value={fmt(data.actual.economicMarginCents)} hint={`MRR − COGS técnico · ${percent(data.actual.technicalCogsPercent)}`} icon={ArrowDownRight} />
        <Metric label="POK Caixa · estimado" value={fmt(data.actual.cashClosingEstimateCents)} hint="Abertura + entradas pagas − saídas pagas" icon={Wallet} />
        <Metric label="Fluxo de caixa no mês" value={fmt(data.actual.netCashFlowCents)} hint={`Entradas ${fmt(data.actual.cashInCents)} · saídas ${fmt(data.actual.cashOutCents)}`} icon={CircleDollarSign} />
      </section>
      <p className="-mt-3 text-[11px] text-zinc-500">Fórmulas gerenciais provisórias para acompanhamento interno. “POK Econômico” não é lucro contábil; a definição comercial oficial da sigla POK ainda precisa ser aprovada.</p>
      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Custos do mês · {data.month}</h2><p className="mt-1 text-xs text-zinc-500">COGS técnico: {fmt(data.actual.technicalCogsCents)} · meta ≤15% · hard cap 20%</p></div>{data.actual.technicalCogsPercent !== null && <span className={`rounded-full px-2.5 py-1 text-xs ${data.actual.technicalCogsPercent > 20 ? 'bg-red-500/10 text-red-500' : data.actual.technicalCogsPercent > 15 ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>{percent(data.actual.technicalCogsPercent)} da assinatura</span>}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map(item => <div key={item.key} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2.5 text-xs dark:bg-zinc-800/60"><span className="text-zinc-500">{item.label}{item.key === 'channel' ? ' · fora do COGS' : ''}</span><strong>{fmt(data.actual.costByCategory[item.key] || 0)}</strong></div>)}
          </div>
          <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>Uso de IA estimado · não é fatura</strong><span>{data.actual.aiUsageEstimate ? fmt(data.actual.aiUsageEstimate.estimatedCostCents) : 'Indisponível'}</span></div>
            {data.actual.aiUsageEstimate && <p className="mt-1 text-zinc-500">{data.actual.aiUsageEstimate.pricedEvents} chamadas tarifadas · {data.actual.aiUsageEstimate.unpricedEvents} sem tarifa · {data.actual.aiUsageEstimate.simulatedEvents} simuladas. Não somado ao COGS conciliado.</p>}
            {data.actual.aiUsageEstimate?.recordedActualCashCostCents !== null && data.actual.aiUsageEstimate?.recordedActualCashCostCents !== undefined && <p className="mt-1 text-zinc-500">Caixa real registrado na telemetria: {fmt(data.actual.aiUsageEstimate.recordedActualCashCostCents)} · separado do ledger.</p>}
            {data.actual.aiUsageEstimate?.recordedNormalizedCostCents !== null && data.actual.aiUsageEstimate?.recordedNormalizedCostCents !== undefined && <p className="mt-1 text-zinc-500">Custo normalizado registrado: {fmt(data.actual.aiUsageEstimate.recordedNormalizedCostCents)} · separado do ledger.</p>}
            {!!data.actual.aiUsageEstimate?.foreignTrackedCostEvents && <p className="mt-1 text-amber-600">{data.actual.aiUsageEstimate.foreignTrackedCostEvents} custo(s) de telemetria em moeda diferente de BRL não foram convertidos nem somados.</p>}
            {data.actual.aiUsageEstimate?.byModel.map(item => <p key={`${item.provider}:${item.model}`} className="mt-1 text-zinc-500">{item.provider} / {item.model}: {fmt(item.costCents)} · {item.events} chamadas</p>)}
          </div>
          <div className="mt-3 rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>Telemetria de canais · fora do ledger</strong><span>{data.actual.channelUsageTelemetry.eventCount} registros</span></div>
            {data.actual.channelUsageTelemetry.eventCount === 0 ? <p className="mt-1 text-zinc-500">Sem dados de uso de canal neste período.</p> : <>
              <p className="mt-1 text-zinc-500">Caixa: {data.actual.channelUsageTelemetry.actualCashCostCents === null ? 'Sem dados' : fmt(data.actual.channelUsageTelemetry.actualCashCostCents)} · normalizado: {data.actual.channelUsageTelemetry.normalizedCostCents === null ? 'Sem dados' : fmt(data.actual.channelUsageTelemetry.normalizedCostCents)} · alocação de infraestrutura: {data.actual.channelUsageTelemetry.infrastructureAllocationCents === null ? 'Sem dados' : fmt(data.actual.channelUsageTelemetry.infrastructureAllocationCents)}.</p>
              {data.actual.channelUsageTelemetry.legacyReportedCostCents > 0 && <p className="mt-1 text-amber-600">Custo legado reportado: {fmt(data.actual.channelUsageTelemetry.legacyReportedCostCents)}; sem classificação econômica, não somado ao POK.</p>}
              {data.actual.channelUsageTelemetry.foreignCurrencyEvents > 0 && <p className="mt-1 text-amber-600">{data.actual.channelUsageTelemetry.foreignCurrencyEvents} registro(s) em moeda não-BRL não foram convertidos nem somados.</p>}
            </>}
            <p className="mt-1 text-[10px] text-zinc-500">{data.actual.channelUsageTelemetry.note}</p>
          </div>
          <div className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <strong className="text-xs">Custos associados por workspace</strong>
            {data.actual.workspaceCosts.length > 0 ? <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">{data.actual.workspaceCosts.map(row => <div key={row.workspaceId} className="grid gap-1 py-2 text-[11px] sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"><span className="truncate font-mono text-zinc-500" title={row.workspaceId}>{row.workspaceId}</span><span>COGS lançado {fmt(row.actualTechnicalCogsCents)}</span><span>Canal {fmt(row.actualChannelCents)}</span><span>IA estimada {fmt(row.estimatedAiUsageCents)}</span></div>)}</div> : <p className="mt-1 text-[11px] text-zinc-500">Associe um lançamento a um workspace para vê-lo aqui; chamadas de IA entram quando houver rate card ativo.</p>}
          </div>
          <div className="mt-4 space-y-1 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
            <p>Base atual: margem econômica {fmt(data.actual.economicMarginCents)} · resultado após canais {fmt(data.actual.channelAdjustedOperatingResultCents)}.</p>
            <p>Base normalizada: {data.actual.normalizedTechnicalCogsCents === null
              ? 'sem lançamentos normalizados neste mês'
              : `COGS ${fmt(data.actual.normalizedTechnicalCogsCents)} (${percent(data.actual.normalizedTechnicalCogsPercent)}) · margem econômica ${fmt(data.actual.normalizedEconomicMarginCents)} · canais ${fmt(data.actual.normalizedChannelCostsCents)} · resultado após canais ${fmt(data.actual.normalizedChannelAdjustedOperatingResultCents)}`}</p>
            <p>Caixa final estimado: {fmt(data.actual.cashClosingEstimateCents)} · planos pagos no perfil: {data.actual.activePlanCustomers}</p>
          </div>
          {data.actual.alerts.map(alert => <p key={alert} className="mt-3 flex gap-2 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="h-4 w-4 shrink-0" />{alert}</p>)}
          {data.transactions.length === 0 && <p className="mt-4 rounded-lg border border-dashed border-zinc-300 p-3 text-xs text-zinc-500 dark:border-zinc-700">Sem lançamentos manuais neste mês. Pagamentos de clientes finais em orçamentos não entram como receita da ORKTO.</p>}
        </div>
        <form onSubmit={addTransaction} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div><h2 className="font-semibold">Registrar lançamento</h2><p className="mt-1 text-xs text-zinc-500">Custos podem ser associados a workspace, provider, modelo e feature.</p></div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-zinc-500">Tipo<select value={transactionType} onChange={event => setTransactionType(event.target.value as 'expense' | 'revenue')} className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent p-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-white"><option value="expense">Despesa / custo</option><option value="revenue">Outra receita</option></select></label>
            {transactionType === 'expense' && <label className="text-xs text-zinc-500">Categoria<select value={category} onChange={event => setCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent p-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-white">{categories.map(item => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label>}
            <label className="text-xs text-zinc-500">Valor (R$)<input required min="0.01" step="0.01" type="number" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent p-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-white" /></label>
            <label className="text-xs text-zinc-500">Data<input required type="date" value={occurredOn} onChange={event => setOccurredOn(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent p-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-white" /></label>
            {transactionType === 'expense' && <><label className="text-xs text-zinc-500">Base<select value={basis} onChange={event => setBasis(event.target.value as 'actual' | 'normalized')} className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent p-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-white"><option value="actual">Custo atual</option><option value="normalized">Custo normalizado</option></select></label><label className="text-xs text-zinc-500">Caixa<select value={cashStatus} onChange={event => setCashStatus(event.target.value as 'paid' | 'forecast')} className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent p-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-white"><option value="paid">Realizado / pago</option><option value="forecast">Previsto</option></select></label></>}
          </div>
          {transactionType === 'expense' && <div className="grid grid-cols-2 gap-2"><input aria-label="ID do workspace" placeholder="Workspace (UUID, opcional)" value={workspaceId} onChange={event => setWorkspaceId(event.target.value)} className="rounded-lg border border-zinc-200 bg-transparent p-2 text-xs dark:border-zinc-700" /><input aria-label="Provider" placeholder="Provider, ex.: Gemini" value={provider} onChange={event => setProvider(event.target.value)} className="rounded-lg border border-zinc-200 bg-transparent p-2 text-xs dark:border-zinc-700" /><input aria-label="Modelo" placeholder="Modelo" value={model} onChange={event => setModel(event.target.value)} className="rounded-lg border border-zinc-200 bg-transparent p-2 text-xs dark:border-zinc-700" /><input aria-label="Feature" placeholder="Feature / ação" value={feature} onChange={event => setFeature(event.target.value)} className="rounded-lg border border-zinc-200 bg-transparent p-2 text-xs dark:border-zinc-700" /></div>}
          <input placeholder="Observação e referência" value={note} onChange={event => setNote(event.target.value)} className="w-full rounded-lg border border-zinc-200 bg-transparent p-2 text-xs dark:border-zinc-700" />
          <button disabled={savingEntry || !amount} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50"><Plus className="h-4 w-4" />{savingEntry ? 'Salvando…' : 'Registrar'}</button>
        </form>
      </section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-semibold">Simulador de cenários</h2><p className="mt-1 text-xs text-zinc-500">Projeção de receita não é lucro; canais e margem aparecem separados.</p></div><label className="text-xs text-zinc-500">Carteira de clientes<select value={customers} onChange={event => setCustomers(Number(event.target.value))} className="ml-2 rounded-lg border border-zinc-200 bg-transparent p-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-white">{customerVolumes.map(count => <option key={count} value={count}>{count.toLocaleString('pt-BR')}</option>)}</select></label></div>
        <div className="mb-4 flex flex-wrap gap-2">{scenarios.map(item => <button key={item.key} onClick={() => setScenario(item.key)} className={`rounded-full border px-3 py-1.5 text-xs ${scenario === item.key ? 'border-orange-500 bg-orange-500/10 text-orange-600' : 'border-zinc-200 text-zinc-500 dark:border-zinc-700'}`}>{item.label}</button>)}<span className="self-center text-[11px] text-zinc-500">A seleção destaca o cenário de referência; compare os três abaixo.</span></div>
        <div className="grid gap-3 lg:grid-cols-3">{projections.map(projection => <ProjectionCard key={projection.scenario} projection={projection} label={scenarios.find(item => item.key === projection.scenario)!.label} />)}</div>
      </section>
      {assumptions && <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Premissas · versão {data.assumptions?.version ?? 'inicial'}</h2><p className="mt-1 text-xs text-zinc-500">Salvar cria um novo rascunho versionado; a cobrança pública não é alterada.</p></div><span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium uppercase text-amber-600">Hipótese · não aprovado</span></div>
        <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <div className="space-y-3"><h3 className="text-sm font-medium">Planos e distribuição hipotética (%)</h3><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-xs"><thead><tr className="text-left text-zinc-500"><th className="pb-2">Plano</th><th className="pb-2">Preço base (R$)</th><th className="pb-2">Mix (%)</th></tr></thead><tbody>{plans.map(plan => <tr key={plan.key} className="border-t border-zinc-100 dark:border-zinc-800"><td className="py-2.5">{plan.label}</td><td><input aria-label={`Preço ${plan.label}`} type="number" min="0" step="0.01" value={moneyInput(assumptions.planPricesCents[plan.key])} onChange={event => setPlanField('planPricesCents', plan.key, centsInput(event.target.value))} className="w-32 rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 dark:border-zinc-700" /></td><td><input aria-label={`Mix ${plan.label}`} type="number" min="0" max="100" step="0.1" value={assumptions.planMixPercent[plan.key]} onChange={event => setPlanField('planMixPercent', plan.key, Number(event.target.value) || 0)} className="w-24 rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 dark:border-zinc-700" /></td></tr>)}</tbody></table></div><p className="text-[11px] text-zinc-500">A soma do mix precisa ser 100%. A tabela pública segue separada até aprovação comercial.</p></div>
          <div className="space-y-3"><h3 className="text-sm font-medium">Custos e metas econômicas</h3><div className="grid grid-cols-2 gap-2">{[
            ['monthlyFixedPlatformCostCents', 'Custo fixo mensal (R$)'], ['infrastructurePerWorkspaceCents', 'Infra por workspace/mês (R$)'],
            ['aiPerWorkspaceCents', 'IA por workspace/mês (R$)'], ['channelPerWorkspaceCents', 'Canal por workspace/mês (R$)'],
            ['openingCashCents', 'Caixa de abertura (R$)'],
          ].map(([key, label]) => <label key={key} className="text-[11px] text-zinc-500">{label}<input type="number" min="0" step="0.01" value={moneyInput(assumptions[key as keyof FinanceAssumptions] as number)} onChange={event => update(key as keyof FinanceAssumptions, centsInput(event.target.value) as never)} className="mt-1 w-full rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-white" /></label>)}
            <label className="text-[11px] text-zinc-500">Taxa do processador (%)<input type="number" min="0" max="100" step="0.01" value={assumptions.paymentProcessingPercent} onChange={event => update('paymentProcessingPercent', Number(event.target.value) || 0)} className="mt-1 w-full rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700" /></label>
            <label className="text-[11px] text-zinc-500">Meta COGS (%)<input type="number" min="0" max="100" value={assumptions.cogsTargetPercent} onChange={event => update('cogsTargetPercent', Number(event.target.value) || 0)} className="mt-1 w-full rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700" /></label>
            <label className="text-[11px] text-zinc-500">Hard cap COGS (%)<input type="number" min="0" max="100" value={assumptions.cogsHardCapPercent} onChange={event => update('cogsHardCapPercent', Number(event.target.value) || 0)} className="mt-1 w-full rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700" /></label>
          </div>
          <div className="mt-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="text-sm font-medium">Tarifas de IA · premissas versionadas</h3>
            <p className="mt-1 text-[11px] text-zinc-500">Informe os valores da sua conta/provedor em USD por 1 milhão de tokens. O cálculo é estimativo e separado da despesa conciliada.</p>
            <label className="mt-3 block max-w-xs text-[11px] text-zinc-500">Câmbio assumido (R$ por US$)<input type="number" min="0" max="1000" step="0.0001" value={assumptions.usdBrlExchangeRate || 0} onChange={event => update('usdBrlExchangeRate', Number(event.target.value) || 0)} className="mt-1 w-full rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700" /></label>
            <div className="mt-3 space-y-2">{(assumptions.aiModelRates || []).map((rate, index) => <div key={`${rate.provider}:${rate.model}:${rate.effectiveFrom || 'legacy'}`} className="grid gap-2 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-800/60 sm:grid-cols-[1fr_1fr_auto_auto_auto]"><span className="self-center font-medium">{rate.provider} · {rate.model}</span><span className="self-center text-zinc-500">Entrada ${rate.inputUsdPerMillionTokens}/M · cache ${rate.cachedInputUsdPerMillionTokens ?? rate.inputUsdPerMillionTokens}/M · saída ${rate.outputUsdPerMillionTokens}/M · desde {rate.effectiveFrom ? new Date(rate.effectiveFrom).toLocaleDateString('pt-BR') : 'legado'}</span><label className="flex items-center gap-1 text-zinc-500"><input type="checkbox" checked={rate.active} onChange={event => update('aiModelRates', assumptions.aiModelRates.map((item, itemIndex) => itemIndex === index ? { ...item, active: event.target.checked } : item))} />Ativa</label><button type="button" onClick={() => update('aiModelRates', assumptions.aiModelRates.filter((_, itemIndex) => itemIndex !== index))} className="text-red-500">Remover</button></div>)}</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-6">
              <input aria-label="Provider da tarifa" value={rateProvider} onChange={event => setRateProvider(event.target.value)} placeholder="Provider" className="rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-xs dark:border-zinc-700" />
              <input aria-label="Modelo da tarifa" value={rateModel} onChange={event => setRateModel(event.target.value)} placeholder="Modelo exato" className="rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-xs dark:border-zinc-700" />
              <input aria-label="Preço de entrada por milhão de tokens em dólar" type="number" min="0" step="0.000001" value={rateInput} onChange={event => setRateInput(event.target.value)} placeholder="Entrada USD / 1M" className="rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-xs dark:border-zinc-700" />
              <input aria-label="Preço de tokens em cache por milhão em dólar" type="number" min="0" step="0.000001" value={rateCachedInput} onChange={event => setRateCachedInput(event.target.value)} placeholder="Cache USD / 1M" className="rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-xs dark:border-zinc-700" />
              <input aria-label="Preço de saída por milhão de tokens em dólar" type="number" min="0" step="0.000001" value={rateOutput} onChange={event => setRateOutput(event.target.value)} placeholder="Saída USD / 1M" className="rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-xs dark:border-zinc-700" />
              <input aria-label="Data de início da tarifa" type="date" value={rateEffectiveFrom} onChange={event => setRateEffectiveFrom(event.target.value)} className="rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-xs dark:border-zinc-700" />
              <button type="button" onClick={addModelRate} disabled={!rateModel.trim()} className="rounded-md border border-zinc-200 px-2 py-1.5 text-xs disabled:opacity-40 dark:border-zinc-700">Adicionar tarifa</button>
            </div>
          </div>
          <h3 className="pt-2 text-sm font-medium">Fatores dos cenários · POK/Base/Favorável</h3><div className="space-y-2">{scenarios.map(item => <div key={item.key} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 text-[11px]"><span className="text-zinc-500">{item.label}</span><label className="text-zinc-500">Receita ×<input type="number" min="0" step="0.01" value={assumptions.scenarios[item.key].revenueFactor} onChange={event => setScenarioField(item.key, 'revenueFactor', Number(event.target.value) || 0)} className="mt-1 w-full rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700" /></label><label className="text-zinc-500">Custo ×<input type="number" min="0" step="0.01" value={assumptions.scenarios[item.key].costFactor} onChange={event => setScenarioField(item.key, 'costFactor', Number(event.target.value) || 0)} className="mt-1 w-full rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700" /></label></div>)}</div></div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={changeNote} onChange={event => setChangeNote(event.target.value)} placeholder="Motivo desta versão das premissas" className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs dark:border-zinc-700" /><button onClick={() => void saveAssumptions()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Salvando…' : 'Salvar nova versão'}</button></div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-zinc-500">Versões salvas: {data.assumptionsHistory.map(item => <span key={item.id} className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">v{item.version} · {item.status} · {new Date(item.created_at).toLocaleDateString('pt-BR')}</span>)}</div>
      </section>}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70"><h2 className="mb-3 font-semibold">Últimos lançamentos</h2>{data.transactions.length ? <div className="divide-y divide-zinc-100 dark:divide-zinc-800">{data.transactions.slice(0, 12).map(row => <div key={row.id} className="grid grid-cols-[1fr_auto] gap-2 py-2.5 text-xs sm:grid-cols-[1fr_auto_auto_auto]"><div><strong className="font-medium">{categories.find(item => item.key === row.category)?.label || (row.transaction_type === 'revenue' ? 'Outra receita' : row.category)}</strong><span className="ml-2 text-zinc-500">{row.note || row.feature || 'Sem observação'}</span>{row.workspace_id && <p className="mt-0.5 text-[10px] text-zinc-500">Workspace {row.workspace_id}</p>}</div><span className={row.transaction_type === 'revenue' ? 'text-emerald-600' : ''}>{row.transaction_type === 'expense' ? '−' : '+'}{fmt(Number(row.amount_cents))}</span><span className="text-zinc-500">{row.basis === 'normalized' ? 'Normalizado' : 'Atual'} · {row.cash_status === 'paid' ? 'Pago' : 'Previsto'}</span><time className="text-zinc-500">{new Date(`${row.occurred_on}T12:00:00`).toLocaleDateString('pt-BR')}</time></div>)}</div> : <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-xs text-zinc-500 dark:border-zinc-700">O histórico ficará visível aqui quando o primeiro lançamento for registrado.</p>}</section>
    </>}
  </div>;
}
