import { PromptInput } from '../../components/ui/wia-prompt-input';
import { ProposalRecoveryRequest } from './proposal-recovery-request';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, LockKeyhole, RefreshCw, Sparkles, X } from 'lucide-react';
import { getProductErrorState, productApi } from '../api';
import type { ProductRequestState, WiaActionView } from '../types';
import { BackendPending, ConfigurationRequired, EmptyState, ErrorState, LoadingState, PageHeader, PermissionState, StatusBadge } from '../ui/shared-states';

import WiaRuntimeStatus from './wia-runtime-status';
import { WiaPlanPreview } from './operation-previews';
import { loadWiaActions } from '../adapters/wia-actions';

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
  if(action.action_type==='request_approval')return 'Revisar ação preparada pela WIA';
  if(action.action_type==='send_proposal_followup')return 'Revisar follow-up da proposta';
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

export default function WiaWorkspace({ accessToken, initialMessage = '', initialActionId, onInitialActionOpened, onOpenSettings }: { accessToken: string | null; initialMessage?: string; initialActionId?: string | null; onInitialActionOpened?: () => void; onOpenSettings: () => void }) {
  const [section, setSection] = useState<'request' | 'approvals' | 'history'>(initialActionId ? 'approvals' : 'request');
  const [prompt, setPrompt] = useState(initialMessage);
  const [lastPrompt, setLastPrompt] = useState('');
  const [phase, setPhase] = useState<WiaPhase | null>(null);
  const [routeResult, setRouteResult] = useState<WiaRouteResult | null>(null);
  const [requestError, setRequestError] = useState<{ status: ProductRequestState; message: string; retry?: () => void } | null>(null);
  const [actionsState, setActionsState] = useState<WiaActionsState>({ status: 'loading', actions: [] });
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ action: WiaActionView; externalDelivery?: string | null } | null>(null);
  const actionRequest = useRef<AbortController | null>(null);

  const loadActions = useCallback(async () => {
    actionRequest.current?.abort();
    const request = new AbortController();
    actionRequest.current = request;
    setActionsState({ status: 'loading', actions: [] });
    try {
      const actions = await loadWiaActions(section, accessToken, request.signal);
      if (request.signal.aborted) return;
      setActionsState({ status: 'success', actions });
    } catch (error) {
      if (request.signal.aborted) return;
      setActionsState({ status: getProductErrorState(error), actions: [], message: error instanceof Error ? error.message : 'Não foi possível carregar as ações registradas.' });
    }
  }, [accessToken, section]);

  useEffect(() => { void loadActions(); return () => actionRequest.current?.abort(); }, [loadActions]);

  useEffect(() => {
    if (!initialActionId || actionsState.status !== 'success') return;
    const target = document.getElementById(`wia-approval-${initialActionId}`);
    if (target) { target.focus(); target.scrollIntoView({ block: 'nearest' }); onInitialActionOpened?.(); }
  }, [initialActionId, actionsState, onInitialActionOpened]);

  const submitPrompt = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || phase === 'CONSULTING' || phase === 'EXECUTING') return;
    setLastPrompt(message);
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
  const recentActions = actionsState.actions.filter(action => action.status !== 'awaiting_approval').slice(0, 12);
  const references = routeResult?.decision?.sourceIds || [];
  const requestPending = phase === 'CONSULTING' || phase === 'EXECUTING';
  const openSettings = <button type="button" onClick={onOpenSettings} className="min-h-11 rounded-lg border px-3 text-xs font-semibold orkto-product-border orkto-product-control">Ver integrações</button>;

  return <div className="orkto-product orkto-wia-workspace mx-auto min-h-full w-full max-w-[1100px] space-y-6 px-4 py-5 pb-6 sm:px-6 sm:py-7 lg:px-8 lg:pb-8">
    <PageHeader title="WIA" description="Consulte registros e revise os próximos passos." actions={<button type="button" onClick={() => void loadActions()} className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-medium orkto-product-border orkto-product-surface hover:orkto-product-surface-muted"><RefreshCw size={15} aria-hidden="true" /><span className="sr-only">Atualizar atividade</span></button>} />

    <nav className="wia-sections" aria-label="Seções da WIA">{([{id:'request',label:'Pedido'},{id:'approvals',label:'Aprovações'},{id:'history',label:'Histórico'}] as const).map(item => <button key={item.id} type="button" aria-pressed={section === item.id} onClick={() => setSection(item.id)}>{item.label}{item.id === 'approvals' && actionsState.status === 'success' && <span>{approvalActions.length}</span>}</button>)}</nav>
    <div className="wia-organized-layout">
      {section === 'request' && <div className="min-w-0 space-y-5">

        <section aria-labelledby="wia-input-title" className="rounded-xl border p-4 sm:p-5 orkto-product-border orkto-product-surface">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl orkto-product-surface-muted" style={{ color: 'var(--orkto-brand-text)' }}><Sparkles size={19} /></span><div><h2 id="wia-input-title" className="text-sm font-semibold">O que vamos organizar?</h2><p className="mt-1 text-xs leading-5 orkto-product-muted">Descreva seu pedido ou comece por uma consulta.</p></div></div>
          <p className="mt-3 text-sm leading-6 orkto-product-muted">A WIA atual prepara análises e rascunhos; ainda não cadastra clientes ou negócios por comando livre. Linguagem livre depende do modelo, da configuração e dos limites aprovados.</p>
          <PromptInput value={prompt} onChange={setPrompt} onSubmit={message => void submitPrompt(message)} busy={requestPending} placeholder="Descreva seu pedido para a WIA…" className="my-6" />
          <ProposalRecoveryRequest onDraft={setPrompt} />
          <div className="wia-query-shortcuts" aria-label="Consultas dos registros existentes">{['Propostas pendentes', 'Aprovações pendentes', 'Vendas hoje'].map(message => <button key={message} type="button" disabled={requestPending} onClick={() => { setPrompt(message); document.getElementById('wia-request')?.focus(); }} className="orkto-product-control">{message}</button>)}</div>
          <p className="mt-3 text-xs leading-5 orkto-product-muted">Os atalhos preenchem o pedido; você decide quando consultar.</p>
          <WiaPlanPreview message={prompt} accessToken={accessToken} disabled={requestPending} />
        </section>

        <details className="wia-configuration"><summary>Disponibilidade e integrações</summary><WiaRuntimeStatus accessToken={accessToken} onOpenSettings={onOpenSettings} /></details>

        {phase && <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs orkto-product-border orkto-product-surface-muted"><span className="h-2 w-2 rounded-full" style={{ background: phase === 'FAILED' ? 'var(--orkto-critical)' : phase === 'EXECUTED' ? 'var(--orkto-success)' : 'var(--orkto-brand)' }} aria-hidden="true" />{phaseLabels[phase]}</div>}

        {requestError && <div className="space-y-2">{requestError.status === 'permission_denied' ? <PermissionState message={requestError.message} /> : requestError.status === 'configuration_required' ? <ConfigurationRequired message={requestError.message} action={openSettings} /> : requestError.status === 'backend_pending' ? <BackendPending title="WIA pendente neste ambiente" message={requestError.message} /> : <ErrorState title="A execução da WIA falhou" message={requestError.message} onRetry={requestError.retry} />}</div>}

        {routeResult && <section aria-labelledby="wia-result-title" className="wia-answer space-y-4">
          <p className="rounded-xl p-4 text-sm orkto-product-surface-muted"><span className="font-semibold">Seu pedido: </span>{lastPrompt}</p><h2 id="wia-result-title" className="text-lg font-semibold">Resposta da WIA</h2>
          <p className="whitespace-pre-wrap text-sm leading-7">{routeResult.decision.messageDraft || routeResult.decision.reasonCode || 'A WIA não retornou uma resposta textual.'}</p>
          {routeResult.decision.requiresApproval && <div className="wia-review-notice"><LockKeyhole size={17} aria-hidden="true" /><div><p>Existe uma ação para sua revisão. Preparação não significa execução.</p><button type="button" className="min-h-11 font-semibold" onClick={() => setSection('approvals')}>Revisar aprovações →</button></div></div>}
          <details className="border-t pt-3 text-xs orkto-product-border"><summary className="cursor-pointer font-medium">Como a WIA chegou aqui</summary><p className="mt-2 orkto-product-muted">Execução: {routeResult.runId || 'Não informada'}</p>{references.length ? <ul className="mt-2 space-y-1">{references.map(reference => <li key={reference} className="break-all">Fonte: {reference}</li>)}</ul> : <p className="mt-2">Nenhum registro relacionado retornado.</p>}<p className="mt-2">Modelo: {routeResult.usage?.model || 'Não informado'} · Provedor: {routeResult.usage?.provider || 'Não informado'}</p>{routeResult.toolExecutions?.map((tool,index)=><p key={index}>{tool.toolName} · {tool.status}</p>)}</details>
        </section>}
      </div>}
      {section === 'approvals' && <div className="space-y-5">
        <section aria-labelledby="wia-approvals-title" className="space-y-3">
          <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] orkto-product-subtle">Supervisão</p><h2 id="wia-approvals-title" className="mt-1 text-base font-semibold">Aguardando aprovação</h2></div><span className="text-xs orkto-product-muted">{actionsState.status === 'success' ? approvalActions.length : '—'}</span></div>
          {actionsState.status === 'loading' && <LoadingState rows={2} label="Carregando ações que aguardam aprovação" />}
          {(actionsState.status === 'error' || actionsState.status === 'offline') && <ErrorState title="Não foi possível carregar as aprovações" message={actionsState.message || 'A fila de aprovação não respondeu.'} onRetry={() => void loadActions()} />}
          {actionsState.status === 'permission_denied' && <PermissionState message={actionsState.message || 'Você não tem acesso à fila de aprovação da WIA.'} />}
          {actionsState.status === 'configuration_required' && <ConfigurationRequired message={actionsState.message || 'A WIA precisa de configuração para carregar esta fila.'} action={openSettings} />}
          {actionsState.status === 'backend_pending' && <BackendPending title="Fila de aprovação pendente neste ambiente" message={actionsState.message || 'A API de ações não está disponível aqui.'} />}
          {actionsState.status === 'success' && approvalActions.length === 0 && <EmptyState title="Nenhuma aprovação pendente" description="A API não retornou ações aguardando aprovação." />}
          {approvalActions.map(action => <article key={action.id} id={`wia-approval-${action.id}`} tabIndex={-1} className="rounded-xl border p-4 orkto-product-border orkto-product-surface"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{actionTitle(action)}</h3><StatusBadge tone="attention">Aguardando aprovação</StatusBadge></div>{actionPayloadText(action) && <blockquote className="mt-3 border-l-2 pl-3 text-sm leading-6 orkto-product-muted" style={{ borderColor: 'var(--orkto-brand)' }}>{actionPayloadText(action)}</blockquote>}<p className="mt-3 text-xs leading-5 orkto-product-muted">{action.rationale || 'Motivo não retornado pelo servidor.'}</p>{action.confidence != null && <p className="mt-1 text-[11px] orkto-product-subtle">Confiança retornada: {Math.round(action.confidence * 100)}%</p>}<p className="mt-1 text-[11px] orkto-product-subtle">{action.created_at ? new Date(action.created_at).toLocaleString('pt-BR') : 'Data não retornada'} · {action.run_id ? `execução ${action.run_id}` : 'sem execução vinculada'}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!!busyAction} onClick={() => void decide(action, 'approve')} className="orkto-product-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold disabled:opacity-55">{busyAction === action.id ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Aprovar e criar tarefa interna</button><button type="button" disabled={!!busyAction} onClick={() => void decide(action, 'reject')} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-medium orkto-product-border orkto-product-control disabled:opacity-55"><X size={14} />Rejeitar</button></div><p className="mt-2 text-[11px] leading-4 orkto-product-subtle">A aprovação atual cria uma tarefa interna. O canal externo não é enviado por esta ação.</p></article>)}
        </section>

        {actionNotice && <div role="status" className="rounded-xl border p-4 text-sm orkto-product-border orkto-product-surface"><p className="font-semibold">{actionNotice.action.status === 'executed' ? 'Execução interna confirmada' : actionNotice.action.status === 'rejected' ? 'Ação rejeitada' : 'Estado atualizado'}</p><p className="mt-1 text-xs leading-5 orkto-product-muted">{externalDeliveryLabel(actionNotice.externalDelivery) || `Status registrado: ${actionNotice.action.status}.`}</p></div>}
      </div>}

      {section === 'history' && <aside className="space-y-5" aria-label="Histórico de ações">
        {actionsState.status === 'permission_denied' && <PermissionState message="Seu acesso não permite consultar este histórico." />}
        {['error','offline','configuration_required','backend_pending'].includes(actionsState.status) && <ErrorState title="Histórico indisponível" message={actionsState.message || 'Não foi possível carregar as ações.'} onRetry={() => void loadActions()} />}

        <section className="rounded-xl border p-4 orkto-product-border orkto-product-surface" aria-labelledby="wia-activity-title"><div className="flex items-center justify-between gap-3"><h2 id="wia-activity-title" className="text-sm font-semibold">Histórico de ações</h2><button type="button" onClick={() => void loadActions()} aria-label="Atualizar ações registradas" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg orkto-product-muted hover:orkto-product-surface-muted"><RefreshCw size={15} /></button></div>{actionsState.status === 'loading' && <div className="mt-3"><LoadingState rows={3} label="Carregando ações persistidas" /></div>}{actionsState.status === 'success' && recentActions.length === 0 && <p className="mt-3 text-xs leading-5 orkto-product-muted">Nenhuma ação concluída ou preparada retornada. Pendências ficam em Aprovações.</p>}{actionsState.status === 'success' && recentActions.length > 0 && <ol className="mt-3 divide-y orkto-product-border">{recentActions.map(action => <li key={action.id} className="py-3"><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium">{actionTitle(action)}</p><StatusBadge tone={action.status === 'executed' ? 'success' : action.status === 'failed' ? 'critical' : action.status === 'awaiting_approval' ? 'attention' : 'neutral'}>{actionStatusLabel(action.status)}</StatusBadge></div><p className="mt-1 line-clamp-2 text-[11px] leading-4 orkto-product-muted">{actionPayloadText(action) || action.rationale || 'Sem resumo retornado.'}</p><p className="mt-1 text-[10px] orkto-product-subtle">{action.created_at ? new Date(action.created_at).toLocaleString('pt-BR') : 'Data não retornada'}</p></li>)}</ol>}</section>
      </aside>}
    </div>
  </div>;
}
