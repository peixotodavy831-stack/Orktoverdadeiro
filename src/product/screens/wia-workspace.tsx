import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, CircleHelp, LoaderCircle, LockKeyhole, RefreshCw, Send, Sparkles, X } from 'lucide-react';
import { getProductErrorState, productApi } from '../api';
import type { ProductRequestState, WiaActionView } from '../types';
import { BackendPending, ConfigurationRequired, EmptyState, ErrorState, LoadingState, PageHeader, PermissionState, StatusBadge } from '../ui/shared-states';

type WiaPhase = 'CONSULTING' | 'ANALYZING' | 'PREPARING_ACTION' | 'WAITING_APPROVAL' | 'EXECUTING' | 'EXECUTED' | 'FAILED' | 'ANALYSIS_READY';

interface WiaDecision {
  action: string;
  messageDraft?: string | null;
  reasonCode?: string | null;
  sourceIds?: string[];
  requiresApproval?: boolean;
  confidenceSignal?: string | null;
}

interface WiaRouteResult {
  success: boolean;
  agent?: string;
  traceId?: string;
  runId?: string;
  decision: WiaDecision;
  usage?: { provider?: string; model?: string; taskType?: string };
  toolExecutions?: Array<{ toolName: string; status: string; sourceIds?: string[]; error?: { code?: string } }>;
}

interface WiaActionsState {
  status: ProductRequestState;
  actions: WiaActionView[];
  message?: string;
}

const actionStatuses = ['awaiting_approval', 'prepared', 'executed', 'failed', 'rejected'];
const phaseLabels: Record<WiaPhase, string> = {
  CONSULTING: 'Consultando…',
  ANALYZING: 'Analisando…',
  PREPARING_ACTION: 'Preparando ação…',
  WAITING_APPROVAL: 'Aguardando aprovação…',
  EXECUTING: 'Executando…',
  EXECUTED: 'Executado',
  FAILED: 'Falhou',
  ANALYSIS_READY: 'Análise disponível',
};

function actionTitle(action: WiaActionView) {
  return action.action_type.replaceAll('_', ' ');
}

function actionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    awaiting_approval: 'Aguardando aprovação',
    prepared: 'Preparada',
    executed: 'Executada',
    failed: 'Falhou',
    rejected: 'Rejeitada',
  };
  return labels[status] || 'Status não reconhecido';
}

function actionPayloadText(action: WiaActionView) {
  const value = action.payload?.messageDraft;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function externalDeliveryLabel(value: unknown) {
  if (value === 'CONFIGURATION_REQUIRED') return 'A tarefa interna foi criada; a entrega externa exige configuração de canal.';
  if (value === 'not_sent_channel_not_configured') return 'A tarefa interna foi criada; nenhuma mensagem externa foi enviada porque o canal não está configurado.';
  if (value === 'sent') return 'O servidor confirmou o envio externo.';
  if (typeof value === 'string' && value) return `Entrega externa: ${value.replaceAll('_', ' ')}.`;
  return null;
}

export default function WiaWorkspace({ accessToken, onOpenSettings }: { accessToken: string | null; onOpenSettings: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<WiaPhase | null>(null);
  const [routeResult, setRouteResult] = useState<WiaRouteResult | null>(null);
  const [requestError, setRequestError] = useState<{ status: ProductRequestState; message: string; retry?: () => void } | null>(null);
  const [actionsState, setActionsState] = useState<WiaActionsState>({ status: 'loading', actions: [] });
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ action: WiaActionView; externalDelivery?: string | null } | null>(null);

  const loadActions = useCallback(async () => {
    setActionsState({ status: 'loading', actions: [] });
    try {
      const results = await Promise.all(actionStatuses.map(status => productApi<{ data: WiaActionView[] }>(`/api/wia/actions?status=${status}`, accessToken)));
      const actions = results.flatMap(result => Array.isArray(result.data) ? result.data : []).sort((left, right) => Date.parse(right.created_at || '') - Date.parse(left.created_at || ''));
      setActionsState({ status: 'success', actions });
    } catch (error) {
      setActionsState({ status: getProductErrorState(error), actions: [], message: error instanceof Error ? error.message : 'Não foi possível carregar as ações registradas.' });
    }
  }, [accessToken]);

  useEffect(() => { void loadActions(); }, [loadActions]);

  const submitPrompt = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || phase === 'CONSULTING' || phase === 'EXECUTING') return;
    setPhase('CONSULTING');
    setRequestError(null);
    setRouteResult(null);
    setActionNotice(null);
    try {
      const result = await productApi<WiaRouteResult>('/api/wia/route-agent', accessToken, { method: 'POST', body: JSON.stringify({ message }) });
      setRouteResult(result);
      setPrompt('');
      if (result.decision?.requiresApproval) setPhase('WAITING_APPROVAL');
      else setPhase('ANALYSIS_READY');
      await loadActions();
    } catch (error) {
      setPhase('FAILED');
      setRequestError({ status: getProductErrorState(error), message: error instanceof Error ? error.message : 'A WIA não conseguiu preparar a análise.', retry: () => { void submitPrompt(message); } });
    }
  };

  const run = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitPrompt(prompt);
  };

  const decide = async (action: WiaActionView, decision: 'approve' | 'reject') => {
    setBusyAction(action.id);
    setActionNotice(null);
    if (decision === 'approve') setPhase('EXECUTING');
    try {
      const path = `/api/wia/actions/${encodeURIComponent(action.id)}/${decision}`;
      const result = await productApi<{ data: WiaActionView; externalDelivery?: string }>(path, accessToken, {
        method: 'POST',
        body: JSON.stringify(decision === 'approve' ? { confirm: true } : { reason: '' }),
      });
      if (decision === 'approve') {
        setPhase('EXECUTED');
        setActionNotice({ action: result.data, externalDelivery: result.externalDelivery || (result.data.result?.externalDelivery as string | undefined) });
      } else {
        setPhase('ANALYSIS_READY');
        setActionNotice({ action: result.data });
      }
      await loadActions();
    } catch (error) {
      setPhase('FAILED');
      setRequestError({ status: getProductErrorState(error), message: error instanceof Error ? error.message : 'A decisão não foi confirmada pelo servidor.', retry: () => { void decide(action, decision); } });
    } finally {
      setBusyAction(null);
    }
  };

  const approvalActions = actionsState.actions.filter(action => action.status === 'awaiting_approval');
  const recentActions = actionsState.actions.slice(0, 6);
  const references = routeResult?.decision?.sourceIds || [];
  const requestPending = phase === 'CONSULTING' || phase === 'EXECUTING';
  const openSettings = <button type="button" onClick={onOpenSettings} className="min-h-11 rounded-lg border px-3 text-xs font-semibold orkto-product-border orkto-product-control">Abrir configurações</button>;

  return <div className="orkto-product mx-auto min-h-full w-full max-w-[1600px] space-y-6 px-4 py-5 pb-24 sm:px-6 sm:py-7 lg:px-8 lg:pb-8">
    <PageHeader eyebrow="Inteligência operacional" title="WIA" description="Contexto, análise e ações preparadas com confirmação explícita." actions={<button type="button" onClick={() => void loadActions()} className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-medium orkto-product-border orkto-product-surface hover:orkto-product-surface-muted"><RefreshCw size={15} />Atualizar atividade</button>} />

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <section aria-labelledby="wia-input-title" className="rounded-xl border p-4 sm:p-5 orkto-product-border orkto-product-surface">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl orkto-product-surface-muted" style={{ color: 'var(--orkto-brand-text)' }}><Sparkles size={19} /></span><div><h2 id="wia-input-title" className="text-sm font-semibold">Inicie uma análise operacional</h2><p className="mt-1 text-xs leading-5 orkto-product-muted">A pergunta inicia uma execução. A WIA mostra a recomendação e a ação preparada separadamente; nenhuma mensagem externa é enviada sem confirmação do servidor.</p></div></div>
          <form onSubmit={run} className="mt-4 space-y-3">
            <label htmlFor="wia-request" className="sr-only">Pergunta para a WIA</label>
            <textarea id="wia-request" value={prompt} onChange={event => setPrompt(event.target.value)} disabled={requestPending} rows={3} maxLength={4000} placeholder="Ex.: O que exige atenção nas propostas atuais?" className="orkto-product-control min-h-28 w-full resize-y rounded-lg p-3 text-sm leading-6 placeholder:orkto-product-subtle disabled:opacity-60" />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] orkto-product-subtle">A resposta depende dos dados e ações que o servidor retornar.</p><button type="submit" disabled={!prompt.trim() || requestPending} className="orkto-product-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-55">{requestPending ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}{requestPending ? phaseLabels[phase!] : 'Consultar WIA'}</button></div>
          </form>
        </section>

        {phase && <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs orkto-product-border orkto-product-surface-muted"><span className="h-2 w-2 rounded-full" style={{ background: phase === 'FAILED' ? 'var(--orkto-critical)' : phase === 'EXECUTED' ? 'var(--orkto-success)' : 'var(--orkto-brand)' }} aria-hidden="true" />{phaseLabels[phase]}</div>}

        {requestError && <div className="space-y-2">{requestError.status === 'permission_denied' ? <PermissionState message={requestError.message} /> : requestError.status === 'configuration_required' ? <ConfigurationRequired message={requestError.message} action={openSettings} /> : requestError.status === 'backend_pending' ? <BackendPending title="WIA pendente neste ambiente" message={requestError.message} /> : <ErrorState title="A execução da WIA falhou" message={requestError.message} onRetry={requestError.retry} />}</div>}

        {routeResult && <section aria-labelledby="wia-result-title" className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] orkto-product-subtle">Resultado estruturado</p><h2 id="wia-result-title" className="mt-1 text-lg font-semibold">Resposta da WIA</h2></div><StatusBadge tone={routeResult.decision.requiresApproval ? 'attention' : 'info'}>{phase ? phaseLabels[phase] : 'Análise disponível'}</StatusBadge></div>
          <section className="rounded-xl border p-4 orkto-product-border orkto-product-surface" aria-labelledby="wia-context-title"><h3 id="wia-context-title" className="text-sm font-semibold">1. Contexto</h3><p className="mt-1 text-xs leading-5 orkto-product-muted">Registros confirmados usados nesta execução.</p>{references.length > 0 ? <ul className="mt-3 flex flex-wrap gap-2">{references.map(reference => <li key={reference} className="rounded-full border px-2.5 py-1 font-mono text-[10px] orkto-product-border orkto-product-muted">{reference}</li>)}</ul> : <p className="mt-3 text-xs orkto-product-subtle">A resposta não retornou registros relacionados.</p>}<p className="mt-3 text-[10px] orkto-product-subtle">Execução {routeResult.runId || 'sem ID retornado'}{routeResult.traceId ? ` · rastreio ${routeResult.traceId}` : ''}</p></section>

          <section className="rounded-xl border p-4 orkto-product-border orkto-product-surface" aria-labelledby="wia-analysis-title"><h3 id="wia-analysis-title" className="text-sm font-semibold">2. Análise</h3><p className="mt-2 text-sm leading-6">{routeResult.decision.reasonCode || routeResult.decision.messageDraft || 'A WIA não retornou uma análise textual.'}</p>{routeResult.decision.confidenceSignal && <p className="mt-2 text-xs orkto-product-muted">Sinal de confiança retornado: {routeResult.decision.confidenceSignal}</p>}{(!!routeResult.usage?.provider || !!routeResult.agent || !!routeResult.toolExecutions?.length) && <details className="mt-3 border-t pt-3 text-xs orkto-product-border"><summary className="cursor-pointer font-medium">Como a WIA chegou aqui</summary><dl className="mt-2 grid grid-cols-2 gap-2 orkto-product-muted"><dt>Provider</dt><dd>{routeResult.usage?.provider || 'Não informado pelo servidor'}</dd>{routeResult.usage?.model && <><dt>Modelo</dt><dd>{routeResult.usage.model}</dd></>}{routeResult.agent && <><dt>Agente</dt><dd>{routeResult.agent}</dd></>}</dl>{routeResult.toolExecutions?.length ? <ul className="mt-2 space-y-1">{routeResult.toolExecutions.map((tool, index) => <li key={`${tool.toolName}-${index}`}>{tool.toolName} · {tool.status}</li>)}</ul> : null}</details>}</section>

          <section className="rounded-xl border p-4 orkto-product-border orkto-product-surface" aria-labelledby="wia-recommendation-title"><h3 id="wia-recommendation-title" className="text-sm font-semibold">3. Recomendação</h3><p className="mt-2 text-sm font-medium">{actionTitle({ id: routeResult.runId || 'run', action_type: routeResult.decision.action, status: 'prepared' })}</p>{routeResult.decision.messageDraft && <p className="mt-2 whitespace-pre-wrap rounded-lg border p-3 text-sm leading-6 orkto-product-border orkto-product-surface-muted">{routeResult.decision.messageDraft}</p>}{routeResult.decision.requiresApproval && <div className="mt-3 flex items-start gap-2 text-xs leading-5 orkto-product-muted"><LockKeyhole size={15} className="mt-0.5 shrink-0" />A ação retornada exige aprovação. Revise o conteúdo e a consequência na fila abaixo.</div>}</section>

          {routeResult.decision.action && !['answer', 'ask_clarification'].includes(routeResult.decision.action) && <section className="rounded-xl border p-4 orkto-product-border orkto-product-surface" aria-labelledby="wia-prepared-title"><h3 id="wia-prepared-title" className="text-sm font-semibold">4. Ação preparada</h3><div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge tone={routeResult.decision.requiresApproval ? 'attention' : 'info'}>{routeResult.decision.requiresApproval ? 'Aguardando aprovação' : 'Preparada'}</StatusBadge><span className="text-xs orkto-product-muted">A preparação não significa execução.</span></div><p className="mt-2 text-xs leading-5 orkto-product-muted">Ação: {routeResult.decision.action.replaceAll('_', ' ')}</p></section>}
        </section>}

        <section aria-labelledby="wia-approvals-title" className="space-y-3">
          <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] orkto-product-subtle">Supervisão</p><h2 id="wia-approvals-title" className="mt-1 text-base font-semibold">Aguardando aprovação</h2></div><span className="text-xs orkto-product-muted">{actionsState.status === 'success' ? approvalActions.length : '—'}</span></div>
          {actionsState.status === 'loading' && <LoadingState rows={2} label="Carregando ações que aguardam aprovação" />}
          {(actionsState.status === 'error' || actionsState.status === 'offline') && <ErrorState title="Não foi possível carregar as aprovações" message={actionsState.message || 'A fila de aprovação não respondeu.'} onRetry={() => void loadActions()} />}
          {actionsState.status === 'permission_denied' && <PermissionState message={actionsState.message || 'Você não tem acesso à fila de aprovação da WIA.'} />}
          {actionsState.status === 'configuration_required' && <ConfigurationRequired message={actionsState.message || 'A WIA precisa de configuração para carregar esta fila.'} action={openSettings} />}
          {actionsState.status === 'backend_pending' && <BackendPending title="Fila de aprovação pendente neste ambiente" message={actionsState.message || 'A API de ações não está disponível aqui.'} />}
          {actionsState.status === 'success' && approvalActions.length === 0 && <EmptyState title="Nenhuma aprovação pendente" description="A API não retornou ações aguardando aprovação." />}
          {approvalActions.map(action => <article key={action.id} className="rounded-xl border p-4 orkto-product-border orkto-product-surface"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{actionTitle(action)}</h3><StatusBadge tone="attention">Aguardando aprovação</StatusBadge></div>{actionPayloadText(action) && <blockquote className="mt-3 border-l-2 pl-3 text-sm leading-6 orkto-product-muted" style={{ borderColor: 'var(--orkto-brand)' }}>{actionPayloadText(action)}</blockquote>}<p className="mt-3 text-xs leading-5 orkto-product-muted">{action.rationale || 'Motivo não retornado pelo servidor.'}</p>{action.confidence != null && <p className="mt-1 text-[11px] orkto-product-subtle">Confiança retornada: {Math.round(action.confidence * 100)}%</p>}<p className="mt-1 text-[11px] orkto-product-subtle">{action.created_at ? new Date(action.created_at).toLocaleString('pt-BR') : 'Data não retornada'} · {action.run_id ? `execução ${action.run_id}` : 'sem execução vinculada'}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!!busyAction} onClick={() => void decide(action, 'approve')} className="orkto-product-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold disabled:opacity-55">{busyAction === action.id ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Aprovar e criar tarefa interna</button><button type="button" disabled={!!busyAction} onClick={() => void decide(action, 'reject')} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-medium orkto-product-border orkto-product-control disabled:opacity-55"><X size={14} />Rejeitar</button></div><p className="mt-2 text-[11px] leading-4 orkto-product-subtle">A aprovação atual cria uma tarefa interna. O canal externo não é enviado por esta ação.</p></article>)}
        </section>

        {actionNotice && <div role="status" className="rounded-xl border p-4 text-sm orkto-product-border orkto-product-surface"><p className="font-semibold">{actionNotice.action.status === 'executed' ? 'Execução interna confirmada' : actionNotice.action.status === 'rejected' ? 'Ação rejeitada' : 'Estado atualizado'}</p><p className="mt-1 text-xs leading-5 orkto-product-muted">{externalDeliveryLabel(actionNotice.externalDelivery) || `Status registrado: ${actionNotice.action.status}.`}</p></div>}
      </div>

      <aside className="space-y-5" aria-label="Contexto e histórico de ações">
        <section className="rounded-xl border p-4 orkto-product-border orkto-product-surface"><div className="flex items-center gap-2"><CircleHelp size={16} className="orkto-product-muted" /><h2 className="text-sm font-semibold">Contexto</h2></div><p className="mt-2 text-xs leading-5 orkto-product-muted">Cada resposta fica ligada a uma execução e aos registros retornados. Fontes e ferramentas ficam em “Como a WIA chegou aqui”.</p>{routeResult?.runId ? <p className="mt-3 break-all font-mono text-[10px] orkto-product-subtle">Run: {routeResult.runId}</p> : <p className="mt-3 text-xs orkto-product-subtle">Nenhuma execução selecionada.</p>}</section>
        <section className="rounded-xl border p-4 orkto-product-border orkto-product-surface" aria-labelledby="wia-activity-title"><div className="flex items-center justify-between gap-3"><h2 id="wia-activity-title" className="text-sm font-semibold">Ações registradas</h2><button type="button" onClick={() => void loadActions()} aria-label="Atualizar ações registradas" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg orkto-product-muted hover:orkto-product-surface-muted"><RefreshCw size={15} /></button></div>{actionsState.status === 'loading' && <div className="mt-3"><LoadingState rows={3} label="Carregando ações persistidas" /></div>}{actionsState.status === 'success' && recentActions.length === 0 && <p className="mt-3 text-xs leading-5 orkto-product-muted">A API não retornou ações registradas.</p>}{actionsState.status === 'success' && recentActions.length > 0 && <ol className="mt-3 divide-y orkto-product-border">{recentActions.map(action => <li key={action.id} className="py-3"><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium">{actionTitle(action)}</p><StatusBadge tone={action.status === 'executed' ? 'success' : action.status === 'failed' ? 'critical' : action.status === 'awaiting_approval' ? 'attention' : 'neutral'}>{actionStatusLabel(action.status)}</StatusBadge></div><p className="mt-1 line-clamp-2 text-[11px] leading-4 orkto-product-muted">{actionPayloadText(action) || action.rationale || 'Sem resumo retornado.'}</p><p className="mt-1 text-[10px] orkto-product-subtle">{action.created_at ? new Date(action.created_at).toLocaleString('pt-BR') : 'Data não retornada'}</p></li>)}</ol>}</section>
      </aside>
    </div>
  </div>;
}
