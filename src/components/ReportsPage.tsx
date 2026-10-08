import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, BarChart3, CalendarDays, Check, ClipboardList, FileCheck2, MessageSquareQuote, RefreshCw, Share2, Sparkles } from 'lucide-react';

type ReportType = 'DAILY_OPERATIONAL' | 'WEEKLY_TACTICAL' | 'MONTHLY_STRATEGIC' | 'ANNUAL_STRATEGIC';
interface Report { id: string; report_type: ReportType; period_start: string; period_end: string; metrics: any; interpretation: string | null; generated_at: string }
interface ReplayRecord { id: string; objection_type: string; response_strategy: string; outcome: string; evidence: Record<string, any>; recommendation: any; version: number; created_at: string }
interface WrappedRecord { id: string; period_start: string; period_end: string; metrics: any; shared_at: string | null; created_at: string }
interface CaseStudy { id: string; baseline: any; after_metrics: any; comparison: any; status: string; review_notes: string; created_at: string }
interface ReportsPageProps { accessToken: string | null }
const reportTypes: Array<{ id: ReportType; label: string; days: number }> = [
  { id: 'DAILY_OPERATIONAL', label: 'Operacional diário', days: 1 },
  { id: 'WEEKLY_TACTICAL', label: 'Tático semanal', days: 7 },
  { id: 'MONTHLY_STRATEGIC', label: 'Estratégico mensal', days: 30 },
  { id: 'ANNUAL_STRATEGIC', label: 'Estratégico anual', days: 365 },
];
const toDateInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const formatMoney = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const typeName = (type: ReportType) => reportTypes.find(item => item.id === type)?.label || type;
const dateAgo = (days: number) => { const date = new Date(); date.setDate(date.getDate() - days); return toDateInput(date); };

export default function ReportsPage({ accessToken }: ReportsPageProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [type, setType] = useState<ReportType>('WEEKLY_TACTICAL');
  const [periodEnd, setPeriodEnd] = useState(() => toDateInput(new Date()));
  const [periodStart, setPeriodStart] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 6); return toDateInput(date); });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [advancedLoading, setAdvancedLoading] = useState(true);
  const [advancedSaving, setAdvancedSaving] = useState(false);
  const [replayRecords, setReplayRecords] = useState<ReplayRecord[]>([]);
  const [wrappedRecords, setWrappedRecords] = useState<WrappedRecord[]>([]);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [canShareWrapped, setCanShareWrapped] = useState(false);
  const [canReviewCases, setCanReviewCases] = useState(false);
  const [casePublicationState, setCasePublicationState] = useState('BLOCKED_LEGAL_VALIDATION');
  const [sharedLink, setSharedLink] = useState('');
  const [replayDraft, setReplayDraft] = useState({ objectionType: '', responseStrategy: '', responseText: '', customerRef: '', outcome: 'unknown' as 'won' | 'lost' | 'pending' | 'unknown' });
  const [wrappedStart, setWrappedStart] = useState(() => dateAgo(29));
  const [wrappedEnd, setWrappedEnd] = useState(() => dateAgo(0));
  const [caseDates, setCaseDates] = useState(() => ({ baselineStart: dateAgo(59), baselineEnd: dateAgo(30), afterStart: dateAgo(29), afterEnd: dateAgo(0) }));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const headers = useMemo(() => ({ 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }), [accessToken]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/reports', { headers }); const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar o histórico de relatórios.');
      const rows: Report[] = payload.data || []; setReports(rows); setSelected(current => current ? rows.find(report => report.id === current.id) || null : rows[0] || null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o histórico de relatórios.'); }
    finally { setLoading(false); }
  }, [headers]);
  useEffect(() => { void load(); }, [load]);

  const loadAdvanced = useCallback(async () => {
    setAdvancedLoading(true);
    try {
      const [replayResponse, wrappedResponse, casesResponse] = await Promise.all([
        fetch('/api/replay', { headers }), fetch('/api/wrapped', { headers }), fetch('/api/case-studies', { headers }),
      ]);
      const [replayPayload, wrappedPayload, casesPayload] = await Promise.all([
        replayResponse.json().catch(() => null), wrappedResponse.json().catch(() => null), casesResponse.json().catch(() => null),
      ]);
      if (!replayResponse.ok) throw new Error(replayPayload?.error || 'Não foi possível carregar Replay.');
      if (!wrappedResponse.ok) throw new Error(wrappedPayload?.error || 'Não foi possível carregar ORKTO Wrapped.');
      if (!casesResponse.ok) throw new Error(casesPayload?.error || 'Não foi possível carregar cases.');
      setReplayRecords(replayPayload?.data || []); setWrappedRecords(wrappedPayload?.data || []); setCaseStudies(casesPayload?.data || []);
      setCanShareWrapped(Boolean(wrappedPayload?.canShare)); setCanReviewCases(Boolean(casesPayload?.canReview)); setCasePublicationState(casesPayload?.publication || 'BLOCKED_LEGAL_VALIDATION');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a inteligência avançada.'); }
    finally { setAdvancedLoading(false); }
  }, [headers]);
  useEffect(() => { void loadAdvanced(); }, [loadAdvanced]);

  const chooseType = (next: ReportType) => {
    setType(next);
    const option = reportTypes.find(item => item.id === next)!;
    const end = new Date(`${periodEnd}T12:00:00`); const start = new Date(end); start.setDate(start.getDate() - (option.days - 1));
    setPeriodStart(toDateInput(start));
  };

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      if (periodStart > periodEnd) throw new Error('O início do período não pode ser posterior ao fim.');
      const response = await fetch('/api/reports/generate', { method: 'POST', headers, body: JSON.stringify({ reportType: type, periodStart, periodEnd }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível gerar o relatório.');
      setSelected(payload.data); setNotice(payload.message || 'Relatório calculado a partir dos registros atuais.'); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível gerar o relatório.'); }
    finally { setSaving(false); }
  };

  const interpret = async () => {
    if (!selected || interpreting || selected.interpretation) return;
    setInterpreting(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(selected.id)}/interpret`, { method:'POST', headers, body:JSON.stringify({}) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível pedir uma interpretação à WIA.');
      setSelected(payload.data);
      setNotice('Interpretação WIA salva. As métricas calculadas não foram alteradas.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível pedir uma interpretação à WIA.'); }
    finally { setInterpreting(false); }
  };

  const recordReplay = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setAdvancedSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/replay', { method: 'POST', headers, body: JSON.stringify({
        objectionType: replayDraft.objectionType, responseStrategy: replayDraft.responseStrategy, responseText: replayDraft.responseText,
        outcome: replayDraft.outcome, customerRef: replayDraft.customerRef || undefined,
      }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível registrar esta evidência.');
      setReplayDraft({ objectionType: '', responseStrategy: '', responseText: '', customerRef: '', outcome: 'unknown' });
      setNotice(payload.recommendation ? 'Evidência salva. A recomendação foi versionada e não alterou políticas.' : 'Evidência salva; ainda não há amostra suficiente para recomendação.');
      await loadAdvanced();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar Replay.'); }
    finally { setAdvancedSaving(false); }
  };

  const generateWrapped = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setAdvancedSaving(true); setError(''); setNotice(''); setSharedLink('');
    try {
      if (wrappedStart > wrappedEnd) throw new Error('O início do Wrapped deve vir antes do fim.');
      const response = await fetch('/api/wrapped/generate', { method: 'POST', headers, body: JSON.stringify({ periodStart: wrappedStart, periodEnd: wrappedEnd }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível gerar o Wrapped.');
      setNotice('ORKTO Wrapped gerado apenas com os registros existentes.'); await loadAdvanced();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível gerar o Wrapped.'); }
    finally { setAdvancedSaving(false); }
  };

  const shareWrapped = async (wrappedId: string) => {
    if (!window.confirm('Criar um link público para estes indicadores? Qualquer pessoa com o link poderá ver o resumo.')) return;
    setAdvancedSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/wrapped/${encodeURIComponent(wrappedId)}/share`, { method: 'POST', headers, body: JSON.stringify({ confirmShare: true }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível compartilhar o Wrapped.');
      const url = new URL(payload.publicPath, window.location.origin).toString(); setSharedLink(url); setNotice('Link público criado e auditado. Copie-o apenas se deseja compartilhar estes dados.'); await loadAdvanced();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível compartilhar o Wrapped.'); }
    finally { setAdvancedSaving(false); }
  };

  const generateCaseStudy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setAdvancedSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/case-studies/generate', { method: 'POST', headers, body: JSON.stringify(caseDates) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível comparar os períodos.');
      setNotice('Comparação calculada e salva como rascunho; ela não afirma causalidade nem publica dados.'); await loadAdvanced();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível gerar o case.'); }
    finally { setAdvancedSaving(false); }
  };

  const reviewCaseStudy = async (caseId: string, decision: 'approve' | 'reject') => {
    setAdvancedSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/case-studies/${encodeURIComponent(caseId)}/review`, { method: 'POST', headers, body: JSON.stringify({ decision, note: decision === 'approve' ? 'Revisado no módulo de Relatórios.' : 'Rejeitado no módulo de Relatórios.' }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível revisar o case.');
      setNotice(`Case ${decision === 'approve' ? 'aprovado para revisão editorial' : 'rejeitado'}. A publicação segue bloqueada pela validação jurídica.`); await loadAdvanced();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível revisar o case.'); }
    finally { setAdvancedSaving(false); }
  };

  const metrics = selected?.metrics;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF9F1C]">Inteligência operacional</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-3xl">Relatórios</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Métricas calculadas e rastreáveis. A interpretação da WIA é separada, explícita e não altera os registros.</p></div><button type="button" onClick={() => void load()} disabled={loading || saving || interpreting} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Atualizar</button></header>
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">{notice}</div>}
      <form onSubmit={generate} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/70 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 lg:col-span-1">Tipo<select value={type} onChange={event => chooseType(event.target.value as ReportType)} className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">{reportTypes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Início<input required type="date" value={periodStart} max={periodEnd} onChange={event => setPeriodStart(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></label>
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Fim<input required type="date" value={periodEnd} onChange={event => setPeriodEnd(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></label>
        <p className="text-[10px] leading-4 text-zinc-500 lg:col-span-1">Sem benchmark inventado: valores saem das propostas, negócios e conversas registradas.</p><button type="submit" disabled={saving || loading} className="min-h-11 rounded-lg bg-[#FF9F1C] px-4 text-xs font-bold text-zinc-950 disabled:opacity-50">{saving ? 'Calculando…' : 'Gerar relatório'}</button>
      </form>
      <div className="grid gap-4 xl:grid-cols-[minmax(250px,0.75fr)_minmax(0,1.6fr)]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/70"><h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Histórico</h2>{loading ? <p role="status" className="mt-4 text-xs text-zinc-500">Carregando relatórios…</p> : reports.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-zinc-300 p-5 text-center dark:border-zinc-800"><BarChart3 className="mx-auto h-6 w-6 text-zinc-400" /><p className="mt-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">Ainda sem relatórios</p><p className="mt-1 text-[10px] leading-4 text-zinc-500">Gere o primeiro usando o período desejado.</p></div> : <ul className="mt-3 space-y-2">{reports.map(report => <li key={report.id}><button type="button" onClick={() => setSelected(report)} className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === report.id ? 'border-[#FF9F1C]/70 bg-[#FF9F1C]/5' : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900'}`}><span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{typeName(report.report_type)}</span><span className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500"><CalendarDays size={11} />{new Date(`${report.period_start}T12:00:00`).toLocaleDateString('pt-BR')} — {new Date(`${report.period_end}T12:00:00`).toLocaleDateString('pt-BR')}</span><span className="mt-1 block text-[9px] text-zinc-400">Versão salva · {new Date(report.generated_at).toLocaleString('pt-BR')}</span></button></li>)}</ul>}</section>
        <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/70 sm:p-5">
          {!selected || !metrics ? <div className="flex min-h-60 flex-col items-center justify-center text-center"><BarChart3 className="h-7 w-7 text-zinc-400" /><p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">Selecione um relatório</p><p className="mt-1 text-xs text-zinc-500">A leitura aparece aqui, sem confundir métricas e opinião.</p></div> : <>
            <div className="flex flex-col gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#FF9F1C]">{typeName(selected.report_type)}</p><h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">Resumo do período</h2><p className="mt-1 text-xs text-zinc-500">{new Date(`${selected.period_start}T12:00:00`).toLocaleDateString('pt-BR')} a {new Date(`${selected.period_end}T12:00:00`).toLocaleDateString('pt-BR')}</p></div><div className="flex items-center gap-2"><span className="rounded-full border border-zinc-300 px-2.5 py-1 text-[10px] text-zinc-500 dark:border-zinc-700">Dados calculados</span>{!selected.interpretation && <button type="button" onClick={() => void interpret()} disabled={interpreting || saving || loading} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#FF9F1C]/40 px-3 text-[10px] font-semibold text-amber-800 hover:bg-[#FF9F1C]/10 disabled:opacity-50 dark:text-[#ffb54d]">{interpreting ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />} {interpreting ? 'WIA analisando…' : 'Pedir interpretação WIA'}</button>}</div></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
              ['Propostas', String(metrics.quotes?.count ?? '—'), `${metrics.quotes?.accepted ?? 0} aceitas`],
              ['Valor proposto', formatMoney(Number(metrics.quotes?.valueCents || 0)), 'Soma dos registros do período'],
              ['Aceitação', metrics.quotes?.acceptanceRate == null ? 'Sem dados' : `${(Number(metrics.quotes.acceptanceRate) * 100).toFixed(1)}%`, 'Aceitas ÷ propostas'],
              ['Negócios ganhos', String(metrics.deals?.won ?? '—'), `${metrics.deals?.closed ?? 0} encerrados`],
              ['Receita de negócios ganhos', formatMoney(Number(metrics.deals?.wonRevenueCents || 0)), 'Valor dos negócios marcados como ganhos'],
              ['Pipeline aberto', formatMoney(Number(metrics.deals?.pipelineValueCents || 0)), `${metrics.deals?.open ?? 0} negócios abertos`],
              ['Conversas', String(metrics.conversations?.total ?? '—'), `${metrics.conversations?.open ?? 0} abertas`],
              ['Mediana de resposta', metrics.response?.medianMinutes == null ? 'Sem dados' : `${metrics.response.medianMinutes} min`, `${metrics.response?.samples ?? 0} amostras`],
            ].map(([label, value, detail]) => <div key={label} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"><p className="text-[10px] font-medium text-zinc-500">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-100">{value}</p><p className="mt-1 text-[10px] text-zinc-500">{detail}</p></div>)}</div>
            <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100"><strong>Cobertura:</strong> propostas {metrics.coverage?.quotes ? 'disponíveis' : 'ausentes'}, negócios {metrics.coverage?.deals ? 'disponíveis' : 'ausentes'}, conversas {metrics.coverage?.conversations ? 'disponíveis' : 'ausentes'}, tempos de resposta {metrics.coverage?.responseTimes ? 'disponíveis' : 'não coletados'}. A mediana não é inferida sem dados válidos.</div>
            <div className="mt-4 rounded-xl bg-zinc-100 p-3 text-[11px] leading-5 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"><strong className="text-zinc-800 dark:text-zinc-200">Interpretação WIA:</strong><div className="mt-1 whitespace-pre-wrap">{selected.interpretation || 'Ainda não solicitada. A interpretação usa somente os dados calculados e não altera métricas ou registros.'}</div></div>
          </>}
        </section>
      </div>
      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/70 sm:p-5">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF9F1C]">Aprendizado operacional</p><h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">Evidências, recap e cases</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">Cada registro fica privado ao workspace. Replay recomenda sem alterar políticas; Wrapped só vira público por ação explícita de owner/admin; cases continuam bloqueados até validação jurídica.</p></div>
        {advancedLoading ? <p role="status" className="text-xs text-zinc-500">Carregando recursos de inteligência…</p> : <div className="grid gap-3 xl:grid-cols-3">
          <details className="group rounded-xl border border-zinc-200 p-4 dark:border-zinc-800" open>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100"><MessageSquareQuote size={16} className="text-[#FF9F1C]" /> Replay das conversas <span className="ml-auto text-[10px] font-normal text-zinc-500">{replayRecords.length} registros</span></summary>
            <form onSubmit={recordReplay} className="mt-4 space-y-2.5">
              <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Objeção<input required maxLength={120} value={replayDraft.objectionType} onChange={event => setReplayDraft(current => ({ ...current, objectionType: event.target.value }))} placeholder="Ex.: preço" className="mt-1 min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-900" /></label>
              <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Estratégia usada<input required maxLength={160} value={replayDraft.responseStrategy} onChange={event => setReplayDraft(current => ({ ...current, responseStrategy: event.target.value }))} placeholder="Ex.: explicar valor e garantia" className="mt-1 min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-900" /></label>
              <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Resposta registrada<textarea required maxLength={2000} rows={2} value={replayDraft.responseText} onChange={event => setReplayDraft(current => ({ ...current, responseText: event.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900" /></label>
              <div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Cliente (referência opcional)<input maxLength={200} value={replayDraft.customerRef} onChange={event => setReplayDraft(current => ({ ...current, customerRef: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900" /></label><label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Resultado<select value={replayDraft.outcome} onChange={event => setReplayDraft(current => ({ ...current, outcome: event.target.value as typeof current.outcome }))} className="mt-1 min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"><option value="unknown">Sem conclusão</option><option value="pending">Pendente</option><option value="won">Ganho</option><option value="lost">Perdido</option></select></label></div>
              <button type="submit" disabled={advancedSaving} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#FF9F1C] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"><ClipboardList size={14} />{advancedSaving ? 'Salvando…' : 'Registrar evidência'}</button>
            </form>
            <ul className="mt-4 max-h-56 space-y-2 overflow-auto border-t border-zinc-200 pt-3 dark:border-zinc-800">{replayRecords.length === 0 ? <li className="text-[10px] text-zinc-500">Sem evidências registradas.</li> : replayRecords.slice(0, 20).map(record => <li key={record.id} className="rounded-lg bg-zinc-50 p-2.5 text-[10px] dark:bg-zinc-900"><div className="flex justify-between gap-2"><strong className="text-zinc-800 dark:text-zinc-200">{record.objection_type} · v{record.version}</strong><span className="text-zinc-500">{record.outcome}</span></div><p className="mt-1 text-zinc-500">{record.response_strategy}</p>{record.evidence?.responseText && <p className="mt-1 line-clamp-2 text-zinc-600 dark:text-zinc-400">“{record.evidence.responseText}”</p>}{record.recommendation && <p className="mt-1 text-amber-700 dark:text-amber-300">Recomendação: {record.recommendation.sampleCount ?? 'amostra disponível'} observações · apenas sugestão</p>}</li>)}</ul>
          </details>

          <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100"><Share2 size={16} className="text-[#FF9F1C]" /> ORKTO Wrapped <span className="ml-auto text-[10px] font-normal text-zinc-500">{wrappedRecords.length} recaps</span></summary>
            <form onSubmit={generateWrapped} className="mt-4 grid grid-cols-2 gap-2"><label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Início<input required type="date" value={wrappedStart} onChange={event => setWrappedStart(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900" /></label><label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Fim<input required type="date" value={wrappedEnd} onChange={event => setWrappedEnd(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900" /></label><button type="submit" disabled={advancedSaving} className="col-span-2 min-h-10 rounded-lg bg-[#FF9F1C] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50">{advancedSaving ? 'Calculando…' : 'Gerar recap com dados reais'}</button></form>
            {sharedLink && <label className="mt-3 block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Link público<input readOnly value={sharedLink} onFocus={event => event.currentTarget.select()} className="mt-1 min-h-10 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-2 text-[10px] dark:border-zinc-700 dark:bg-zinc-900" /></label>}
            <ul className="mt-4 max-h-64 space-y-2 overflow-auto border-t border-zinc-200 pt-3 dark:border-zinc-800">{wrappedRecords.length === 0 ? <li className="text-[10px] text-zinc-500">Sem recaps. Nenhum benchmark externo é fabricado.</li> : wrappedRecords.map(wrapped => <li key={wrapped.id} className="rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-900"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200">{new Date(`${wrapped.period_start}T12:00:00`).toLocaleDateString('pt-BR')} — {new Date(`${wrapped.period_end}T12:00:00`).toLocaleDateString('pt-BR')}</span><span className="text-[9px] text-zinc-500">{wrapped.shared_at ? 'Compartilhado' : 'Privado'}</span></div><div className="mt-2 grid grid-cols-2 gap-1 text-[9px] text-zinc-500"><span>Propostas: {wrapped.metrics?.quotes?.count ?? 'sem dados'}</span><span>Ganhos: {wrapped.metrics?.deals?.won ?? 'sem dados'}</span><span>Conversas: {wrapped.metrics?.conversations?.total ?? 'sem dados'}</span><span>Conversão: {wrapped.metrics?.quotes?.acceptanceRate == null ? 'sem dados' : `${(wrapped.metrics.quotes.acceptanceRate * 100).toFixed(1)}%`}</span></div>{!wrapped.shared_at && canShareWrapped && <button type="button" onClick={() => void shareWrapped(wrapped.id)} disabled={advancedSaving} className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-md border border-zinc-300 px-2 text-[9px] font-semibold text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"><Share2 size={11} />Criar link público</button>}</li>)}</ul>
            {!canShareWrapped && <p className="mt-2 text-[9px] text-zinc-500">Somente owner/admin pode compartilhar publicamente.</p>}
          </details>

          <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100"><FileCheck2 size={16} className="text-[#FF9F1C]" /> Cases de sucesso <span className="ml-auto text-[10px] font-normal text-zinc-500">{caseStudies.length} estudos</span></summary>
            <form onSubmit={generateCaseStudy} className="mt-4 grid grid-cols-2 gap-2">{([['baselineStart','Baseline de'],['baselineEnd','Baseline até'],['afterStart','Depois de'],['afterEnd','Depois até']] as const).map(([key,label]) => <label key={key} className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">{label}<input required type="date" value={caseDates[key]} onChange={event => setCaseDates(current => ({ ...current,[key]:event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900" /></label>)}<button type="submit" disabled={advancedSaving} className="col-span-2 min-h-10 rounded-lg bg-[#FF9F1C] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50">{advancedSaving ? 'Comparando…' : 'Gerar comparação de 30+ dias'}</button></form>
            <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5 text-[10px] leading-4 text-amber-900 dark:text-amber-100"><strong>{casePublicationState}:</strong> cases são rascunhos comparativos, sem alegação causal. Publicação/opt-in permanece bloqueado até validação jurídica.</div>
            <ul className="mt-3 max-h-64 space-y-2 overflow-auto border-t border-zinc-200 pt-3 dark:border-zinc-800">{caseStudies.length === 0 ? <li className="text-[10px] text-zinc-500">Nenhum case calculado.</li> : caseStudies.map(study => <li key={study.id} className="rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-900"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200">Estudo {new Date(study.created_at).toLocaleDateString('pt-BR')}</span><span className="text-[9px] uppercase text-zinc-500">{study.status}</span></div><p className="mt-1 text-[9px] text-zinc-500">Receita ganha: {study.comparison?.wonRevenueCentsDelta == null ? 'sem dados' : formatMoney(study.comparison.wonRevenueCentsDelta)} · conversas: {study.comparison?.conversationCountDelta ?? 'sem dados'}</p>{canReviewCases && ['draft','review'].includes(study.status) && <div className="mt-2 flex gap-2"><button type="button" onClick={() => void reviewCaseStudy(study.id,'approve')} disabled={advancedSaving} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-emerald-500/30 px-2 text-[9px] font-semibold text-emerald-700 disabled:opacity-50 dark:text-emerald-300"><Check size={11} />Revisar</button><button type="button" onClick={() => void reviewCaseStudy(study.id,'reject')} disabled={advancedSaving} className="min-h-8 rounded-md border border-zinc-300 px-2 text-[9px] font-semibold text-zinc-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400">Rejeitar</button></div>}</li>)}</ul>
            {!canReviewCases && <p className="mt-2 text-[9px] text-zinc-500">Somente owner/admin pode revisar cases.</p>}
          </details>
        </div>}
      </section>
    </div>
  );
}
