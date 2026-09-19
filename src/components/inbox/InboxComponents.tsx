// ORKTO Inbox Components — componentes reutilizaveis do panel da inbox
// Versao minimalista para desbloqueio do build; pode ser expandida posteriormente.

import React from 'react';
import { motion } from 'motion/react';

// MoodRing: indicador visual do humor do contato
interface MoodRingProps {
  mood: 'green' | 'yellow' | 'red' | 'blue' | 'neutral';
  confidence?: number;
  size?: 'sm' | 'md' | 'lg';
}

const moodColors = {
  green: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  yellow: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400' },
  red: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', dot: 'bg-rose-400' },
  blue: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20', dot: 'bg-sky-400' },
  neutral: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20', dot: 'bg-zinc-400' },
};

const sizeMap = { sm: 8, md: 12, lg: 16 };

export function MoodRing({ mood = 'neutral', confidence = 0, size = 'md' }: MoodRingProps) {
  const c = moodColors[mood] || moodColors.neutral;
  const dim = sizeMap[size] || sizeMap.md;
  return (
    <div className={`flex items-center gap-1.5 ${c.bg} ${c.border} border rounded-full px-2 py-0.5`}>
      <span className={`w-2 h-2 rounded-full ${c.dot} ${confidence < 50 ? 'opacity-50' : ''}`} />
      <span className={`text-[10px] font-bold uppercase ${c.text}`}>
        {mood === 'green' ? 'Ativo' : mood === 'yellow' ? 'Atenção' : mood === 'red' ? 'Urgente' : mood === 'blue' ? 'Fidelidade' : 'Neutro'}
      </span>
    </div>
  );
}

// PriorityBadge: indicador de prioridade da conversa
interface PriorityBadgeProps {
  score?: number | null;
  reason?: string | null;
  size?: 'sm' | 'md';
}

export function PriorityBadge({ score = 0, reason = null, size = 'sm' }: PriorityBadgeProps) {
  const high = score != null && score >= 80;
  const medium = score != null && score >= 50 && score < 80;
  const low = score == null || score < 50;

  const label = high ? `${score} — Alta` : medium ? `${score} — Média` : '—';
  const cls = high
    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    : medium
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';

  return (
    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

// MessageBubble: buba de mensagem
interface MessageBubbleProps {
  content: string;
  direction: 'incoming' | 'outgoing' | 'internal';
  sender?: 'contact' | 'operator' | 'bot' | 'system';
  sender_name?: string;
  sent_at?: string;
  processed_by_agent?: boolean;
}

export function MessageBubble({ content, direction, sender = 'contact', sender_name }: MessageBubbleProps) {
  const isIncoming = direction === 'incoming';
  return (
    <div className={`flex ${isIncoming ? 'justify-start' : 'justify-end'} mb-2`}>
      <div className={`max-w-[75%] ${isIncoming ? 'lg:max-w-[65%]' : ''} rounded-2xl px-4 py-2 ${
        sender === 'bot'
          ? 'bg-zinc-800 text-zinc-100 rounded-br-sm border border-zinc-700/50'
          : isIncoming
            ? 'bg-zinc-800/80 text-zinc-50 rounded-bl-sm border border-zinc-700/30'
            : 'bg-amber-500/15 text-amber-200 rounded-br-sm border border-amber-500/20'
      }`}>
        <p className="text-sm leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

// ConversationItem: item da lista de conversas
interface ConversationItemProps {
  id: string;
  phone: string;
  name?: string | null;
  lastMessage?: string | null;
  lastMessageBy?: 'customer' | 'business';
  lastMessageAt?: string;
  mood?: 'green' | 'yellow' | 'red' | 'blue' | 'neutral';
  moodConfidence?: number;
  priorityScore?: number | null;
  priorityReason?: string | null;
  unread?: boolean;
  onClick?: () => void;
}

export function ConversationItem({
  id, phone, name, lastMessage, lastMessageBy, lastMessageAt,
  mood = 'neutral', moodConfidence = 0, priorityScore, unread = false, onClick,
}: ConversationItemProps) {
  const initials = (name || phone || '?').slice(0, 2).toUpperCase();
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30 ${
        unread ? 'bg-amber-500/5' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF9F1C] to-black flex items-center justify-center text-black font-bold text-sm shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white truncate">
              {name || phone.replace(/^\+?(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')}
            </span>
            {lastMessageAt && (
              <span className="text-[10px] text-zinc-500 whitespace-nowrap ml-2">
                {lastMessageAt}
              </span>
            )}
          </div>
          {lastMessage && (
            <p className="text-xs text-zinc-500 truncate mt-0.5">{lastMessage}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${
              mood === 'green' ? 'bg-emerald-400' : mood === 'yellow' ? 'bg-amber-400' : mood === 'red' ? 'bg-rose-400' : mood === 'blue' ? 'bg-sky-400' : 'bg-zinc-500'
            } ${moodConfidence < 50 ? 'opacity-50' : ''}`} />
            {priorityScore != null && (
              <span className="text-[9px] text-zinc-500 font-mono">P:{priorityScore}</span>
            )}
            {unread && <span className="text-[9px] text-amber-400 font-bold">Novo</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

// ApprovalCard: tarjeta de tarefa de aprovacao
interface ApprovalCardProps {
  id: string;
  title: string;
  description: string;
  priority?: number | null;
  suggestedReply?: string | null;
  onApprove?: () => void;
  onReject?: () => void;
  isLoading?: boolean;
}

export function ApprovalCard({ id, title, description, priority, suggestedReply, onApprove, onReject, isLoading }: ApprovalCardProps) {
  const p = priority;
  return (
    <div className="bg-zinc-800/40 rounded-xl border border-zinc-700/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-white truncate">{title}</h4>
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
          priority && p >= 80
            ? 'bg-rose-500/10 text-rose-400'
            : priority && p >= 50
              ? 'bg-amber-500/10 text-amber-400'
              : 'bg-zinc-500/10 text-zinc-400'
        }`}>
          {priority != null ? `P:${p}` : 'sem prioridade'}
        </span>
      </div>
      <p className="text-xs text-zinc-400">{description}</p>
      {suggestedReply && (
        <div className="bg-zinc-900/50 rounded-lg p-3 border-l-2 border-amber-500/50">
          <p className="text-xs text-zinc-300 italic">"{suggestedReply}"</p>
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onApprove}
          disabled={isLoading || !onApprove}
          className="flex-1 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:bg-zinc-700 disabled:text-zinc-500 text-emerald-400 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          {isLoading ? 'Processando...' : 'Aprovar'}
        </button>
        <button
          onClick={onReject}
          disabled={isLoading || !onReject}
          className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 disabled:bg-zinc-700 disabled:text-zinc-500 text-rose-400 text-xs font-bold rounded-lg transition-colors border border-rose-500/20"
        >
          Rejeitar
        </button>
      </div>
    </div>
  );
}

// EmptyState: estado vazio
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-3 opacity-50">{icon}</div>}
      <h3 className="text-sm font-bold text-zinc-400 mb-1">{title}</h3>
      {description && <p className="text-xs text-zinc-600 max-w-xs">{description}</p>}
    </div>
  );
}

// ConversationListSkeleton: esqueleto de carregamento
export function ConversationListSkeleton() {
  return (
    <div className="p-3 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 bg-zinc-800/30 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}
