import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Edit2, 
  Pause, 
  MessageSquare,
  User,
  Bot,
  Loader2,
  MoreVertical,
  CheckSquare,
  Square,
  Sparkles,
  Zap,
  CornerDownRight,
  Shield,
  ChevronDown,
  LockKeyhole,
  Send,
  Eye,
  PanelRightOpen
} from 'lucide-react';
import { 
  Conversation, 
  ConversationMessage, 
  ApprovalTask,
  ApprovalStatus,
  BotName,
  TrustLevel,
  MessageRole,
  MessageType
} from '../../types';
import { formatPhone, formatBRL } from '../../utils/format';
import OrktoLogo from '../OrktoLogo';
import { confirmedSendMessage, confirmedSendState } from '../../product/inbox-delivery-status';

// Helper function to format timestamps
function formatTimestamp(ts: unknown): string {
  if (ts == null) return '';
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }
  if (ts instanceof Date) {
    return ts.toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }
  if (typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }
  return '';
}

// ─── Tipos e constantes ──────────────────────────────────────────────────────

type SendMessageStatus = 'idle' | 'sending' | 'accepted' | 'acknowledged' | 'delivered' | 'error';
type PrivateInstruction = { id: string; content: string; source: 'manager' | 'wia'; from_user_id: string | null; to_user_id: string | null; read_at: string | null; expires_at: string; created_at: string };
type WorkspaceAudienceMember = { user_id: string; role: string };

interface ConversationViewProps {
  conversationId: string;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  embedded?: boolean;
  onOpenContext?: () => void;
  onOpenConfiguration?: () => void;
}

const BOT_COLORS: Record<BotName, string> = {
  hunter: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  farmer: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  recovery: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  collection: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  risk: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  report: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  growth: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  price_auditor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  hermes: 'bg-white/10 text-white border-white/20',
};

const TRUST_LEVEL_LABELS: Record<TrustLevel, string> = {
  observing: 'Observando',
  suggesting: 'Sugerindo',
  limited: 'Autonomia limitada',
  extended: 'Autonomia ampliada',
};

// ─── Componente ──────────────────────────────────────────────────────────────

export default function ConversationView({ 
  conversationId, 
  onBack, 
  onRefresh,
  embedded = false,
  onOpenContext,
  onOpenConfiguration,
}: ConversationViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [approvalTasks, setApprovalTasks] = useState<ApprovalTask[]>([]);
  const [approvalBusyTaskId, setApprovalBusyTaskId] = useState<string | null>(null);
  const [approvalFeedback, setApprovalFeedback] = useState<{ taskId: string; kind: 'success' | 'error'; message: string; configurationRequired?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<number | null>(null);
  const [sendStatus, setSendStatus] = useState<SendMessageStatus>('idle');
  const [sendError, setSendError] = useState<{ message: string; configurationRequired: boolean } | null>(null);
  const [sendAttempt, setSendAttempt] = useState<{ content: string; idempotencyKey: string } | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [sussurros, setSussurros] = useState<PrivateInstruction[]>([]);
  const [privateInstruction, setPrivateInstruction] = useState('');
  const [sussurroLoading, setSussurroLoading] = useState(false);
  const [sussurroSaving, setSussurroSaving] = useState(false);
  const [sussurroError, setSussurroError] = useState('');
  const [sussurroNotice, setSussurroNotice] = useState('');
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceAudienceMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [sussurroRecipientId, setSussurroRecipientId] = useState('');

  const loadSussurros = useCallback(async (silent = false) => {
    if (!silent) setSussurroLoading(true); setSussurroError('');
    try {
      const token = (await import('../../lib/supabase').then(m => m.supabase.auth.getSession()).then(s => s.data.session?.access_token).catch(() => null)) || null;
      if (!token) throw new Error('Entre novamente para carregar as instruções privadas.');
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/sussurros`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar os Sussurros.');
      setSussurros(Array.isArray(payload?.data) ? payload.data : []);
    } catch (cause) { setSussurroError(cause instanceof Error ? cause.message : 'Não foi possível carregar os Sussurros.'); }
    finally { if (!silent) setSussurroLoading(false); }
  }, [conversationId]);

  const loadSussurroAudience = useCallback(async () => {
    try {
      const { supabase } = await import('../../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Entre novamente para carregar a equipe.');
      setCurrentUserId(session.user.id);
      const response = await fetch('/api/operational/workspace', { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar a equipe deste workspace.');
      setWorkspaceMembers(Array.isArray(payload?.members) ? payload.members.filter((member: unknown): member is WorkspaceAudienceMember => {
        if (!member || typeof member !== 'object') return false;
        const candidate = member as Partial<WorkspaceAudienceMember>;
        return typeof candidate.user_id === 'string' && typeof candidate.role === 'string';
      }) : []);
    } catch (cause) {
      setSussurroError(cause instanceof Error ? cause.message : 'Não foi possível carregar a equipe deste workspace.');
    }
  }, []);

  const sendSussurro = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = privateInstruction.trim();
    if (!content || sussurroSaving) return;
    setSussurroSaving(true); setSussurroError(''); setSussurroNotice('');
    try {
      const token = (await import('../../lib/supabase').then(m => m.supabase.auth.getSession()).then(s => s.data.session?.access_token).catch(() => null)) || null;
      if (!token) throw new Error('Entre novamente para enviar uma instrução privada.');
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/sussurros`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content, toUserId: sussurroRecipientId || undefined }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível salvar a instrução privada.');
      setSussurros(current => [...current, payload.data]); setPrivateInstruction('');
      setSussurroNotice(sussurroRecipientId ? 'Instrução privada registrada para o operador selecionado. Nada foi enviado ao cliente.' : 'Instrução privada registrada para a equipe. Nada foi enviado ao cliente.');
    } catch (cause) { setSussurroError(cause instanceof Error ? cause.message : 'Não foi possível salvar a instrução privada.'); }
    finally { setSussurroSaving(false); }
  };

  const markSussurroRead = async (sussurroId: string) => {
    setSussurroError('');
    try {
      const token = (await import('../../lib/supabase').then(m => m.supabase.auth.getSession()).then(s => s.data.session?.access_token).catch(() => null)) || null;
      if (!token) throw new Error('Entre novamente para atualizar a instrução.');
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/sussurros/${encodeURIComponent(sussurroId)}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível marcar como lida.');
      setSussurros(current => current.map(item => item.id === sussurroId ? { ...item, read_at: payload.data.read_at } : item));
    } catch (cause) { setSussurroError(cause instanceof Error ? cause.message : 'Não foi possível marcar como lida.'); }
  };

  // Carrega conversa + mensagens + tarefas
  const loadConversation = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setLoadStatus(null);
    const token = (await import('../../lib/supabase').then(m => m.supabase.auth.getSession()).then(s => s.data.session?.access_token).catch(() => null)) || null;
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

    try {
      const [convRes, msgRes] = await Promise.all([
        fetch(`/api/conversations/${conversationId}`, { headers }),
        fetch(`/api/conversations/${conversationId}/messages`, { headers }).catch(() => null),
      ]);

      if (convRes.ok) {
        const data = await convRes.json();
        setConversation(data);
        setMessages(data.messages || []);
        setApprovalTasks(data.approval_tasks || []);
      } else {
        const payload = await convRes.json().catch(() => null);
        setLoadStatus(convRes.status);
        setLoadError(payload?.error || `A conversa não pôde ser carregada (HTTP ${convRes.status}).`);
        setConversation(null);
        setMessages([]);
        setApprovalTasks([]);
      }
    } catch (err) {
      console.error('[ConversationView] load error:', err);
      setLoadError(err instanceof Error ? err.message : 'Não foi possível conectar ao serviço de conversas.');
      setConversation(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setLoading(true);
    loadConversation().finally(() => setLoading(false));
  }, [loadConversation]);

  useEffect(() => { void loadSussurros(); void loadSussurroAudience(); }, [loadSussurros, loadSussurroAudience]);
  useEffect(() => {
    if (!['accepted', 'acknowledged', 'delivered'].includes(sendStatus)) return;
    const timer = window.setTimeout(() => setSendStatus('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [sendStatus]);
  useEffect(() => {
    const timer = window.setInterval(() => { void loadSussurros(true); }, 15_000);
    return () => window.clearInterval(timer);
  }, [loadSussurros]);

  // Enviar mensagem
  const handleSend = async (contentOverride?: string): Promise<boolean> => {
    const content = (contentOverride ?? newMessage).trim();
    if (!content || (sendStatus !== 'idle' && sendStatus !== 'error')) return false;

    setSendStatus('sending');
    setSendError(null);
    const idempotencyKey = sendAttempt?.content === content ? sendAttempt.idempotencyKey : crypto.randomUUID();
    setSendAttempt({ content, idempotencyKey });
    const token = (await import('../../lib/supabase').then(m => m.supabase.auth.getSession()).then(s => s.data.session?.access_token).catch(() => null)) || null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };

    try {
      const res = await fetch(`/api/conversations/${conversationId}/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content,
          idempotencyKey,
        }),
      });

      if (res.ok) {
        const payload = await res.json().catch(() => null);
        const confirmed = confirmedSendState(payload);
        if (!confirmed) throw new Error('O serviço não retornou um estado de entrega verificável. Atualize o histórico antes de tentar novamente.');
        setSendStatus(confirmed);
        setNewMessage('');
        setSendAttempt(null);
        await loadConversation(); // refresh
        return true;
      } else {
        const payload = await res.json().catch(() => null);
        const category = typeof payload?.category === 'string' ? payload.category : '';
        setSendError({
          message: typeof payload?.error === 'string' ? payload.error : `A mensagem não foi confirmada (HTTP ${res.status}).`,
          configurationRequired: category.includes('configuration') || category === 'channel_not_configured',
        });
        setSendStatus('error');
        return false;
      }
    } catch (cause) {
      setSendError({ message: cause instanceof Error ? cause.message : 'Não foi possível confirmar o envio. O rascunho foi preservado.', configurationRequired: false });
      setSendStatus('error');
      return false;
    } finally {
      // Errors remain visible until the operator retries or changes the draft.
    }
  };

  // Aprovar / rejeitar tarefa
  const decideApproval = async (taskId: string, decision: 'approve' | 'reject') => {
    setApprovalBusyTaskId(taskId);
    setApprovalFeedback(null);
    const token = (await import('../../lib/supabase').then(m => m.supabase.auth.getSession()).then(s => s.data.session?.access_token).catch(() => null)) || null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };

    try {
      const res = await fetch(`/api/approval-tasks/${taskId}/${decision}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: decision === 'approve' ? 'Aprovado pelo operador' : 'Rejeitado pelo operador' }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : `A decisão não foi confirmada (HTTP ${res.status}).`);
      const approvedMessage = typeof payload?.message === 'string'
        ? payload.message
        : 'Rascunho aprovado. Esta decisão não envia a mensagem ao cliente.';
      setApprovalFeedback({
        taskId,
        kind: 'success',
        message: decision === 'approve' ? approvedMessage : 'Rascunho rejeitado e registrado pelo servidor. Nenhuma mensagem foi enviada.',
        configurationRequired: decision === 'approve' && (payload?.deliveryStatus === 'CONFIGURATION_REQUIRED' || payload?.category === 'channel_not_configured'),
      });
      await loadConversation();
    } catch (cause) {
      setApprovalFeedback({ taskId, kind: 'error', message: cause instanceof Error ? cause.message : 'A decisão não foi confirmada pelo servidor.' });
    } finally {
      setApprovalBusyTaskId(null);
    }
  };

  const handleApprove = (taskId: string) => decideApproval(taskId, 'approve');
  const handleReject = (taskId: string) => decideApproval(taskId, 'reject');

  const renderMessage = (msg: ConversationMessage, idx: number) => {
    const isOwn = msg.senderRole === 'operator' || msg.senderRole === 'bot';
    const isBot = msg.senderRole === 'bot';
    const isSystem = msg.senderRole === 'system';
    const isIncoming = msg.direction === 'incoming' && !isSystem;

    const senderInitials = msg.senderName
          ? msg.senderName.slice(0, 2).toUpperCase()
          : msg.botName
            ? msg.botName.slice(0, 2).toUpperCase()
            : '?';

        return (
          <motion.div
            key={msg.id || idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${isIncoming ? 'justify-start' : 'justify-end'} mb-3 ${isSystem ? 'justify-center' : ''}`}
          >
            {/* Mensagem de sistema */}
            {isSystem ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/40 rounded-full text-[10px] text-zinc-500 font-medium">
                <Sparkles className="w-3 h-3" />
                {msg.content}
              </div>
            ) : (
              <div className={`max-w-[75%] ${isIncoming ? 'lg:max-w-[65%]' : ''}`}>
                {/* Sender badge (se for bot ou humano diferente do interlocutor) */}
                {(isBot || msg.senderRole === 'operator') && (
                  <div className={`flex items-center gap-2 mb-1.5 px-2 ${isIncoming ? 'bg-zinc-900/40 rounded-t-xl' : ''}`}>
                    {isBot ? (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold border ${BOT_COLORS[msg.botName || 'hermes']}`}>
                        {senderInitials}
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                        {senderInitials}
                      </div>
                    )}
                    <span className={`text-[10px] font-bold uppercase ${
                      isBot
                        ? 'text-zinc-400'
                        : msg.senderRole === 'operator'
                          ? 'text-amber-400'
                          : 'text-zinc-400'
                    }`}>
                      {isBot
                        ? (msg.botName ? msg.botName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Bot')
                        : (msg.senderName || 'Operador')
                      }
                    </span>
                    {isBot && msg.approvalTaskId && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[9px] font-bold rounded-full">
                    <Clock className="w-3 h-3" />
                    aguardando aprovacao
                  </span>
                )}
              </div>
            )}

            {/* Bubble */}
            <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
              isBot
                ? 'bg-zinc-800 text-zinc-100 rounded-br-sm border border-zinc-700/50'
                : isIncoming
                  ? 'bg-zinc-800/80 text-zinc-50 rounded-bl-sm border border-zinc-700/30'
                  : 'bg-amber-500/15 text-amber-200 rounded-br-sm border border-amber-500/20'
            }`}>
              {isBot && msg.botActionId && (
                <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-zinc-500">
                  <CornerDownRight className="w-3 h-3" />
                  <span className="font-mono">acao #{msg.botActionId.slice(0, 8)}</span>
                </div>
              )}
              <p>{msg.content}</p>
              <div className={`flex items-center justify-end gap-2 mt-1.5 ${
                isBot ? 'text-zinc-500' : 'text-zinc-500'
              }`}>
                <span className="text-[10px] font-mono">
                  {formatTimestamp(msg.sentAt)}
                </span>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  // Renderiza tarefa de aprovação
  const renderApprovalTask = (task: ApprovalTask) => {
    const isExpanded = expandedTask === task.id;
    const isBusy = approvalBusyTaskId === task.id;
    const feedback = approvalFeedback?.taskId === task.id ? approvalFeedback : null;
    const botColor = BOT_COLORS[task.botName] || BOT_COLORS.hermes;
    const botLabel = task.botName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
      <motion.div
        key={task.id}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="mb-3"
      >
        <div className={`rounded-xl border overflow-hidden ${
          task.status === 'pending'
            ? 'bg-amber-500/5 border-amber-500/20'
            : task.status === 'approved'
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : task.status === 'rejected'
                ? 'bg-rose-500/5 border-rose-500/20'
                : 'bg-zinc-800/30 border-zinc-700/30'
        }`}>
          <div className="flex flex-wrap items-center gap-2 p-2 sm:flex-nowrap">
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls={`approval-task-details-${task.id}`}
              onClick={() => setExpandedTask(isExpanded ? null : task.id)}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-zinc-900/30"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[10px] font-extrabold ${botColor}`} aria-hidden="true">{botLabel.slice(0, 2)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{botLabel}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${task.trustLevel === 'observing' ? 'bg-zinc-500/20 text-zinc-400' : task.trustLevel === 'suggesting' ? 'bg-amber-500/20 text-amber-400' : task.trustLevel === 'limited' ? 'bg-sky-500/20 text-sky-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{TRUST_LEVEL_LABELS[task.trustLevel]}</span>
                  <span className="font-mono text-[10px] text-zinc-500">{formatTimestamp(task.createdAt)}{task.expiresAt ? ` · vence ${formatTimestamp(task.expiresAt)}` : ''}</span>
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-zinc-200">{task.title}</span>
                <span className="mt-0.5 block truncate text-xs text-zinc-400">{task.justification}</span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            <div className="flex shrink-0 items-center gap-1.5 px-1 sm:px-0" aria-label="Ações da aprovação">
              {task.status === 'pending' && <>
                <button type="button" onClick={() => void handleApprove(task.id)} disabled={isBusy || approvalBusyTaskId !== null} aria-label={`Aprovar rascunho: ${task.title}`} className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 transition-colors hover:bg-emerald-500/25 disabled:opacity-50 dark:text-emerald-400"><CheckCircle className="h-5 w-5" /></button>
                <button type="button" onClick={() => void handleReject(task.id)} disabled={isBusy || approvalBusyTaskId !== null} aria-label={`Rejeitar rascunho: ${task.title}`} className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 transition-colors hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-400"><XCircle className="h-5 w-5" /></button>
              </>}
              {task.status === 'approved' && <span className="inline-flex min-h-10 items-center gap-1.5 px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400"><CheckCircle className="h-4 w-4" />Rascunho aprovado</span>}
              {task.status === 'rejected' && <span className="inline-flex min-h-10 items-center gap-1.5 px-2 text-xs font-semibold text-rose-700 dark:text-rose-400"><XCircle className="h-4 w-4" />Rascunho rejeitado</span>}
            </div>
          </div>

          {/* Corpo expandido */}
          {isExpanded && (
            <div id={`approval-task-details-${task.id}`} role="region" aria-label={`Detalhes: ${task.title}`} className="border-t border-zinc-700/30 bg-zinc-900/20 px-3 pb-3 pt-2">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Proposta do bot</span>
                  <p className="text-zinc-200 mt-1 bg-zinc-800/60 rounded-lg p-3 border-l-2 border-amber-500/50">
                    {task.proposedAction}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Justificativa</span>
                  <p className="text-zinc-300 mt-1">{task.justification}</p>
                </div>
                {task.signals && task.signals.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Sinais considerados</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {task.signals.map(s => (
                        <span key={s} className="px-2 py-0.5 bg-zinc-700/40 text-zinc-400 text-[10px] font-mono rounded-full">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Política aplicada</span>
                  <p className="text-zinc-300 mt-1 text-sm">
                    <Shield className="w-3 h-3 inline mr-1" />
                    {task.policyApplied}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Próxima ação</span>
                  <p className="text-zinc-300 mt-1 text-sm">
                    {task.status === 'pending' 
                      ? 'A aprovação registra a decisão sobre o rascunho. Nenhuma mensagem será enviada por esta ação.'
                      : task.status === 'approved'
                        ? 'Rascunho aprovado. O envio ao cliente não foi confirmado por esta ação.'
                        : 'Rascunho rejeitado. Nenhuma mensagem será enviada.'}
                  </p>
                </div>
              </div>
              {feedback && <div role={feedback.kind === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-lg border p-3 text-sm leading-5 ${feedback.kind === 'error' ? 'border-rose-500/25 text-rose-700 dark:text-rose-300' : 'border-emerald-500/25 text-emerald-700 dark:text-emerald-300'}`}>
                <p>{feedback.message}</p>
                {feedback.configurationRequired && onOpenConfiguration && <button type="button" onClick={onOpenConfiguration} className="mt-2 min-h-11 rounded-lg border px-3 text-sm font-semibold orkto-product-border orkto-product-control">Configurar canal</button>}
              </div>}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  // ─── Renderização principal ────────────────────────────────────────────────

  if (loading) {
    return (
      <div role="status" aria-label="Carregando conversa" className={`${embedded ? 'h-full min-h-0' : 'min-h-screen'} orkto-inbox-conversation flex items-center justify-center`}>
        <p className="text-sm orkto-product-muted">Carregando conversa…</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className={`${embedded ? 'h-full min-h-0' : 'min-h-screen'} orkto-inbox-conversation flex items-center justify-center p-5`}>
        <div role="alert" className="max-w-md text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 orkto-product-subtle" />
          <h2 className="mb-1 text-base font-semibold">{loadStatus === 401 || loadStatus === 403 ? 'Acesso necessário' : loadStatus === 404 ? 'Conversa não encontrada' : 'Conversa indisponível'}</h2>
          <p className="mb-4 text-sm orkto-product-muted">{loadError || 'A conversa não foi encontrada neste workspace.'}</p>
          <button
            onClick={() => void loadConversation()}
            className="orkto-product-control min-h-11 rounded-lg px-4 text-xs font-semibold"
          >
            Tentar novamente
          </button>
          {loadStatus === 503 && onOpenConfiguration && <button type="button" onClick={onOpenConfiguration} className="ml-2 min-h-11 rounded-lg px-4 text-xs font-medium orkto-product-muted">Configurar canal</button>}
          <button type="button" onClick={onBack} className="ml-2 min-h-11 rounded-lg px-4 text-xs font-medium orkto-product-muted">Voltar ao inbox</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${embedded ? 'h-full min-h-0' : 'min-h-screen'} orkto-inbox-conversation flex flex-col text-zinc-50`}>
      {/* Header fixo */}
      <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/60 flex-shrink-0">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:text-white"
              aria-label="Voltar ao inbox"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 border border-zinc-700">
                {conversation.contactName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-zinc-100 leading-tight">
                  {conversation.contactName}
                </h2>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {conversation.contactPhone ? formatPhone(conversation.contactPhone) : ''}
                  {conversation.status === 'paused' && ' · Pausada'}
                  {conversation.status === 'closed' && ' · Encerrada'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {conversation.mood && (
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                conversation.mood === 'green' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                conversation.mood === 'yellow' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                conversation.mood === 'red' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                conversation.mood === 'blue' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
              }`}>
                {conversation.mood === 'green' ? 'Ativo' :
                 conversation.mood === 'yellow' ? 'Atenção' :
                 conversation.mood === 'red' ? 'Urgente' :
                 conversation.mood === 'blue' ? 'Fidelidade' : 'Neutro'}
              </span>
            )}
            {conversation.quoteId && conversation.quoteTotal !== undefined && (
              <span className="hidden rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400 sm:inline-flex">
                <CornerDownRight className="w-3 h-3 inline mr-1" />
                {formatBRL(conversation.quoteTotal)}
              </span>
            )}
            <button
              type="button"
              onClick={() => { void Promise.all([loadConversation(), loadSussurros()]); }}
              aria-label="Atualizar conversa e instruções privadas"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-300"
              title="Atualizar conversa e instruções privadas"
            >
              <Clock className="w-4 h-4" />
            </button>
            {onOpenContext && <button type="button" onClick={onOpenContext} aria-label="Abrir contexto comercial e WIA" title="Contexto comercial e WIA" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-white"><PanelRightOpen className="h-4 w-4" /></button>}
          </div>
        </div>

        {/* Indicador de Mood Ring */}
        {conversation.mood && (
          <div className="h-0.5 bg-zinc-800">
            <div className={`h-full w-1/4 ${
              conversation.mood === 'green' ? 'bg-emerald-500' :
              conversation.mood === 'yellow' ? 'bg-amber-400' :
              conversation.mood === 'red' ? 'bg-rose-500' :
              conversation.mood === 'blue' ? 'bg-sky-400' : 'bg-zinc-500'
            }`} />
          </div>
        )}
      </header>

      {/* Corpo da conversa */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4">
        {/* Mensagens */}
        <div className="max-w-2xl mx-auto">
          {/* Primeira mensagem do contato (se houver) */}
          {messages.filter(m => m.senderRole === 'contact' || m.direction === 'incoming').length > 0 && (
            <div className="mb-4 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800/40 rounded-full text-[10px] text-zinc-500">
                <User className="w-3 h-3" />
                <span>Mensagem inicial recebida via WhatsApp</span>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => renderMessage(msg, idx))}
        </div>

        <section className="mx-auto mt-5 max-w-2xl rounded-2xl border border-orange-500/25 bg-orange-500/[0.035] p-3 sm:p-4" aria-label="Instruções privadas da equipe">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5"><span className="mt-0.5 rounded-lg border border-orange-500/25 bg-orange-500/10 p-2 text-orange-400"><LockKeyhole className="h-4 w-4" /></span><div><h3 className="text-xs font-bold text-zinc-100">Sussurros privados</h3><p className="mt-0.5 text-[10px] leading-4 text-zinc-500">Instruções internas para a equipe. Não aparecem nem são enviadas ao cliente.</p></div></div>
            <button type="button" onClick={() => void loadSussurros()} disabled={sussurroLoading} aria-label="Atualizar instruções privadas" className="min-h-11 shrink-0 rounded-lg px-3 text-xs font-semibold text-zinc-500 hover:bg-zinc-800 disabled:opacity-50">{sussurroLoading ? 'Atualizando…' : 'Atualizar'}</button>
          </div>
          {sussurroError && <p role="alert" className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-200">{sussurroError}</p>}
          {sussurroNotice && <p role="status" className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[10px] text-emerald-200">{sussurroNotice}</p>}
          {sussurros.length > 0 ? <div className="mt-3 space-y-2">{sussurros.slice(-10).map(note => <article key={note.id} className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
            <div className="flex items-start justify-between gap-3"><p className="whitespace-pre-wrap text-xs leading-5 text-zinc-200">{note.content}</p>{!note.read_at && <span className="shrink-0 rounded-full bg-orange-500/10 px-2 py-0.5 text-[9px] font-semibold text-orange-300">Não lido</span>}</div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-[9px] text-zinc-500">{note.source === 'wia' ? 'WIA' : 'Equipe'} · {note.to_user_id ? `Para ${note.to_user_id === currentUserId ? 'você' : note.to_user_id.slice(0, 8)}` : 'Toda a equipe'} · {formatTimestamp(note.created_at)} · expira {formatTimestamp(note.expires_at)}</p>{!note.read_at && (!note.to_user_id || note.to_user_id === currentUserId) && <button type="button" onClick={() => void markSussurroRead(note.id)} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-white"><Eye className="h-3 w-3" />Marcar lido</button>}{!note.read_at && note.to_user_id && note.to_user_id !== currentUserId && <span className="text-[9px] text-zinc-500">Aguardando leitura</span>}</div>
          </article>)}</div> : !sussurroLoading && !sussurroError && <p className="mt-3 rounded-lg bg-zinc-900/60 px-3 py-2 text-[10px] text-zinc-500">Nenhuma instrução privada ativa nesta conversa.</p>}
        </section>

        {/* Tarefas de aprovação */}
        {approvalTasks.length > 0 && (
          <div className="max-w-2xl mx-auto mt-6">
            <div className="flex items-center gap-2 mb-3 px-1">
              <CornerDownRight className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Aprovações pendentes
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                ({approvalTasks.filter(t => t.status === 'pending').length} pendentes)
              </span>
            </div>
            {approvalTasks.map(renderApprovalTask)}
          </div>
        )}

        {/* Mensagem vazia / sem histórico */}
        {messages.length === 0 && approvalTasks.length === 0 && (
          <div className="max-w-md mx-auto text-center py-12">
            <Bot className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
            <h3 className="text-base font-extrabold text-zinc-400 mb-1">
              Nenhuma mensagem ainda
            </h3>
            <p className="text-xs text-zinc-600">
              A primeira mensagem do contato aparecerá aqui. A WIA usa o contexto desta conversa e só envia mensagens quando um canal estiver conectado.
            </p>
          </div>
        )}
      </div>

      {/* Barra de composição */}
      <footer className="border-t border-zinc-800/60 bg-zinc-900/50 px-4 lg:px-6 py-3 flex-shrink-0">
        <form onSubmit={event => void sendSussurro(event)} className="mx-auto mb-2 flex max-w-2xl flex-wrap items-center gap-2 rounded-xl border border-orange-500/20 bg-zinc-950/70 p-2">
          <LockKeyhole className="ml-1 h-4 w-4 shrink-0 text-orange-400" />
          <select value={sussurroRecipientId} onChange={event => setSussurroRecipientId(event.target.value)} aria-label="Destinatário do Sussurro" disabled={sussurroSaving} className="min-h-11 max-w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-300 outline-none focus:border-orange-500/50 disabled:opacity-50">
            <option value="">Toda a equipe</option>
            {workspaceMembers.map(member => <option key={member.user_id} value={member.user_id}>{member.user_id === currentUserId ? 'Você' : 'Operador'} · {member.user_id.slice(0, 8)} · {member.role}</option>)}
          </select>
          <input value={privateInstruction} onChange={event => setPrivateInstruction(event.target.value)} maxLength={2000} placeholder="Deixe uma instrução privada…" aria-label="Instrução privada, não enviada ao cliente" disabled={sussurroSaving} className="min-h-11 min-w-[10rem] flex-1 bg-transparent px-1 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-50" />
          <button type="submit" disabled={sussurroSaving || !privateInstruction.trim()} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-orange-500/10 px-3 text-xs font-bold text-orange-300 hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-40" title="Registrar sem enviar ao cliente">{sussurroSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Privado</button>
        </form>
        {sendStatus === 'error' && sendError && <div role="alert" className="mx-auto mb-2 flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-xs orkto-product-border orkto-product-surface">
          <p className="min-w-0 flex-1 leading-5">{sendError.message} <span className="orkto-product-muted">O rascunho continua disponível e o envio não foi confirmado.</span></p>
          <div className="flex shrink-0 gap-2">{sendError.configurationRequired && onOpenConfiguration && <button type="button" onClick={onOpenConfiguration} className="min-h-10 rounded-lg border px-3 font-medium orkto-product-border orkto-product-control">Configurar canal</button>}<button type="button" onClick={() => void handleSend(newMessage)} disabled={!newMessage.trim()} className="min-h-10 rounded-lg px-3 font-semibold orkto-product-primary disabled:opacity-50">Tentar novamente</button></div>
        </div>}
        <form onSubmit={event => { event.preventDefault(); void handleSend(); }} className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl border p-2 orkto-product-border orkto-product-surface">
          <label htmlFor="inbox-external-message" className="sr-only">Mensagem para {conversation.contactName}</label>
          <textarea
            id="inbox-external-message"
            value={newMessage}
            onChange={event => { setNewMessage(event.target.value); if (sendStatus === 'error') { setSendStatus('idle'); setSendError(null); } }}
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }}
            disabled={sendStatus === 'sending'}
            rows={1}
            placeholder="Escreva uma mensagem para o cliente…"
            aria-describedby="inbox-compose-hint"
            className="orkto-product-control min-h-11 max-h-28 min-w-0 flex-1 resize-y border-0 bg-transparent px-3 py-2 text-sm leading-5 focus-visible:outline-none"
          />
          <button type="submit" disabled={!newMessage.trim() || sendStatus === 'sending'} aria-label={sendStatus === 'sending' ? 'Solicitando envio' : sendStatus === 'accepted' ? 'Solicitação aceita, entrega não confirmada' : sendStatus === 'acknowledged' ? 'Provedor confirmou recebimento, entrega não confirmada' : sendStatus === 'delivered' ? 'Entrega confirmada' : `Enviar mensagem para ${conversation.contactName}`} className="orkto-product-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-50">
            {sendStatus === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : ['accepted', 'acknowledged', 'delivered'].includes(sendStatus) ? <CheckCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </button>
          <span id="inbox-compose-hint" className="sr-only">Enter solicita o envio. Shift mais Enter insere uma nova linha. Aceite da solicitação não confirma entrega.</span>
        </form>
        <p role="status" aria-live="polite" className="mx-auto mt-2 max-w-2xl text-xs text-zinc-400">{sendStatus === 'sending' ? 'Solicitando envio…' : ['accepted', 'acknowledged', 'delivered'].includes(sendStatus) ? confirmedSendMessage(sendStatus as 'accepted' | 'acknowledged' | 'delivered') : ''}</p>
      </footer>
    </div>
  );
}
