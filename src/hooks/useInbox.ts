// ORKTO Inbox Hooks — stubs para integração com o App.tsx
// Estes hooks usam o Supabase client do frontend para consultar
// os endpoints da API do ORKTO Swarm.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Tipos locais (espelho dos tipos do backend para tipagem client-side)
export interface Conversation {
  [key: string]: any;
  id: string;
  contact_name: string;
  contact_phone: string;
  status: string;
  source_channel: string;
  mood_state: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  message_count: number;
  created_at: string;
  updated_at: string;
  messages?: ConversationMessage[];
  approval_tasks?: ApprovalTask[];
}

export interface ConversationMessage {
  [key: string]: any;
  id: string;
  sender_role: 'contact' | 'operator' | 'bot' | 'system';
  content: string;
  message_type: string;
  sent_at: string;
  direction: 'incoming' | 'outgoing' | 'internal';
  read_at?: string;
  bot_name?: string;
  bot_action_id?: string;
  approval_task_id?: string;
  sender_name?: string;
}

export interface ApprovalTask {
  [key: string]: any;
  id: string;
  conversation_id: string;
  task_type: string;
  bot_name: string;
  proposed_content: string;
  reason: string;
  policy_applied: string;
  status: 'pending' | 'approved' | 'rejected' | 'edited' | 'scheduled';
  created_at: string;
  decided_at?: string;
  decided_by?: string;
  decision_reason?: string;
}

// Hook: lista de conversas
export function useInboxConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/conversations', { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar conversas');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { conversations, loading, error, refetch };
}

// Hook: detalhe de conversa
export function useConversation(conversationId: string | null) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!conversationId) {
      setConversation(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/conversations/${conversationId}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConversation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar conversa');
      setConversation(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { conversation, loading, error, refetch };
}

// Hook: tarefas de aprovação
export function useApprovals() {
  const [approvalTasks, setApprovalTasks] = useState<ApprovalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/approval-tasks', { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApprovalTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar aprovações');
      setApprovalTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const approveAction = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      const token = await getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch(`/api/approval-tasks/${taskId}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: 'Aprovado pelo operador' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refetch();
      return true;
    } catch {
      return false;
    }
  }, [refetch]);

  const rejectAction = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      const token = await getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch(`/api/approval-tasks/${taskId}/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: 'Rejeitado pelo operador' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refetch();
      return true;
    } catch {
      return false;
    }
  }, [refetch]);

  useEffect(() => { refetch(); }, [refetch]);

  return { approvalTasks, loading, error, approveAction, rejectAction, refetch };
}

// Hook: enviar mensagem
export function useSendMessage() {
  const [sending, setSending] = useState(false);

  const send = useCallback(async (phone: string, content: string): Promise<boolean> => {
    setSending(true);
    try {
      const token = await getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers,
        body: JSON.stringify({ from: phone, content, sender_name: phone }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch {
      return false;
    } finally {
      setSending(false);
    }
  }, []);

  return { sending, send };
}

// Helper: token do usuario logado
async function getToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}
