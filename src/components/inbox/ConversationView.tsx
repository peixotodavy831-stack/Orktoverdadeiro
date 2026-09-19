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
  ChevronDown
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
import { PromptInput, type WiaPromptMeta } from '../ui/ai-chat-input';

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

type SendMessageStatus = 'idle' | 'sending' | 'sent' | 'error';

interface ConversationViewProps {
  conversationId: string;
  onBack: () => void;
  onRefresh: () => Promise<void>;
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
  onRefresh 
}: ConversationViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [approvalTasks, setApprovalTasks] = useState<ApprovalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendStatus, setSendStatus] = useState<SendMessageStatus>('idle');
  const [newMessage, setNewMessage] = useState('');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // Carrega conversa + mensagens + tarefas
  const loadConversation = useCallback(async () => {
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
        setConversation(null);
        setMessages([]);
        setApprovalTasks([]);
      }
    } catch (err) {
      console.error('[ConversationView] load error:', err);
      setConversation(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setLoading(true);
    loadConversation().finally(() => setLoading(false));
  }, [loadConversation]);

  // Enviar mensagem
  const handleSend = async (contentOverride?: string, wia?: WiaPromptMeta): Promise<boolean> => {
    const content = (contentOverride ?? newMessage).trim();
    if (!content || sendStatus !== 'idle') return false;

    setSendStatus('sending');
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
          wia: wia ? {
            agent: wia.agent,
            effort: wia.effort,
            inputMode: wia.inputMode,
            attachmentCount: wia.attachments.length,
          } : undefined,
        }),
      });

      if (res.ok) {
        setSendStatus('sent');
        setNewMessage('');
        await loadConversation(); // refresh
        return true;
      } else {
        setSendStatus('error');
        return false;
      }
    } catch {
      setSendStatus('error');
      return false;
    } finally {
      // Reset status after 3s
      setTimeout(() => setSendStatus('idle'), 3000);
    }
  };

  // Aprovar / rejeitar tarefa
  const handleApprove = async (taskId: string) => {
    const token = (await import('../../lib/supabase').then(m => m.supabase.auth.getSession()).then(s => s.data.session?.access_token).catch(() => null)) || null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };

    try {
      const res = await fetch(`/api/approval-tasks/${taskId}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: 'Aprovado pelo operador' }),
      });
      if (res.ok) {
        await loadConversation();
      }
    } catch (err) {
      console.error('[ConversationView] approve error:', err);
    }
  };

  const handleReject = async (taskId: string) => {
    const token = (await import('../../lib/supabase').then(m => m.supabase.auth.getSession()).then(s => s.data.session?.access_token).catch(() => null)) || null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };

    try {
      const res = await fetch(`/api/approval-tasks/${taskId}/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: 'Rejeitado pelo operador' }),
      });
      if (res.ok) {
        await loadConversation();
      }
    } catch (err) {
      console.error('[ConversationView] reject error:', err);
    }
  };

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
          {/* Header da tarefa */}
          <button
            onClick={() => setExpandedTask(isExpanded ? null : task.id)}
            className="w-full flex items-center gap-3 p-3 text-left hover:bg-zinc-900/30 transition-colors"
          >
            {/* Avatar do bot */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-extrabold border shrink-0 ${botColor}`}>
              {botLabel.slice(0, 2)}
            </div>

            {/* Conteúdo resumido */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  {botLabel}
                </span>
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                  task.trustLevel === 'observing'
                    ? 'bg-zinc-500/20 text-zinc-400'
                    : task.trustLevel === 'suggesting'
                      ? 'bg-amber-500/20 text-amber-400'
                      : task.trustLevel === 'limited'
                        ? 'bg-sky-500/20 text-sky-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {TRUST_LEVEL_LABELS[task.trustLevel]}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono">
                  {formatTimestamp(task.createdAt)} · {task.expiresAt ? `vence ${formatTimestamp(task.expiresAt)}` : ''}
                </span>
              </div>
              <p className="text-sm font-semibold text-zinc-200 truncate">
                {task.title}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">
                {task.justification}
              </p>
            </div>

            {/* Status + controles */}
            <div className="flex items-center gap-2 shrink-0">
              {task.status === 'pending' && (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleApprove(task.id); }}
                    className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors"
                    title="Aprovar"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReject(task.id); }}
                    className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg transition-colors"
                    title="Rejeitar"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </>
              )}
              {task.status === 'approved' && (
                <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                  <CheckCircle className="w-4 h-4" />
                  Aprovada
                </span>
              )}
              {task.status === 'rejected' && (
                <span className="flex items-center gap-1 text-rose-400 text-xs font-bold">
                  <XCircle className="w-4 h-4" />
                  Rejeitada
                </span>
              )}
              <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Corpo expandido */}
          {isExpanded && (
            <div className="border-t border-zinc-700/30 px-3 pb-3 pt-2 bg-zinc-900/20">
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
                  <p className="text-zinc-300 mt-1 text-xs">
                    <Shield className="w-3 h-3 inline mr-1" />
                    {task.policyApplied}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Próxima ação</span>
                  <p className="text-zinc-300 mt-1 text-xs">
                    {task.status === 'pending' 
                      ? ' Aguarde aprovação do operador para envio.'
                      : task.status === 'approved'
                        ? ' Ação aprovada — envio processado.'
                        : ' Ação rejeitada — não será executada.'}
                  </p>
                </div>
              </div>

              {/* Ações rápidas */}
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-zinc-700/30">
                {task.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprove(task.id)}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-extrabold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Aprovar e enviar
                    </button>
                    <button
                      onClick={() => handleReject(task.id)}
                      className="py-2 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold rounded-lg transition-colors border border-rose-500/20"
                    >
                      Rejeitar
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  // ─── Renderização principal ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-amber-500 animate-spin" />
          <p className="text-sm font-bold text-zinc-400">Carregando conversa...</p>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
          <h2 className="text-base font-extrabold text-zinc-400 mb-1">Conversa não encontrada</h2>
          <p className="text-xs text-zinc-600 mb-4">Tente atualizar a página</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg transition-colors"
          >
            Voltar ao inbox
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col h-full">
      {/* Header fixo */}
      <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/60 flex-shrink-0">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
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
              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-mono font-bold rounded-full border border-amber-500/20">
                <CornerDownRight className="w-3 h-3 inline mr-1" />
                {formatBRL(conversation.quoteTotal)}
              </span>
            )}
            <button
              onClick={loadConversation}
              className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Atualizar"
            >
              <Clock className="w-4 h-4" />
            </button>
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
              A primeira mensagem do contato aparecerá aqui e Hermes gerará uma sugestão para você revisar.
            </p>
          </div>
        )}
      </div>

      {/* Barra de composição */}
      <footer className="border-t border-zinc-800/60 bg-zinc-900/50 px-4 lg:px-6 py-3 flex-shrink-0">
        <PromptInput
          value={newMessage}
          onChange={setNewMessage}
          onSubmit={(message, meta) => handleSend(message, meta)}
          disabled={sendStatus === 'sending'}
          status={sendStatus}
          placeholder="Mensagem ou instrução para a WIA..."
          className="mx-auto max-w-2xl"
        />
      </footer>
    </div>
  );
}
