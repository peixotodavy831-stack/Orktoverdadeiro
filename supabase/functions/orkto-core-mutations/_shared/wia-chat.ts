/** Called only inside the authenticated WIA gateway. No browser-supplied history. */
export type ChatScope = { workspaceId: string; actorId: string; sessionId: string; traceId: string; runId?:string };

export async function saveChatMessage(db: any, scope: ChatScope, role: 'user'|'assistant', content: string) {
  if (!content.trim() || content.length > 4000) throw new Error('chat_content_invalid');
  const row = { workspace_id: scope.workspaceId, user_id: scope.actorId, session_id: scope.sessionId,
    message_key: scope.traceId, role, content,...(scope.runId?{run_id:scope.runId}:{}) };
  const saved = await db.from('orkto_wia_chat_messages').upsert(row,
    { onConflict: 'workspace_id,session_id,message_key,role', ignoreDuplicates: true });
  if (saved.error) throw new Error('chat_persistence_unavailable');
  // Read back even on duplicate: never report persistence for an unconfirmed or conflicting write.
  const verified = await db.from('orkto_wia_chat_messages').select('id,content')
    .eq('workspace_id', scope.workspaceId).eq('user_id', scope.actorId).eq('session_id', scope.sessionId)
    .eq('message_key', scope.traceId).eq('role', role).maybeSingle();
  if (verified.error || !verified.data?.id || verified.data.content !== content) throw new Error('chat_persistence_unavailable');
}

export async function loadChatContext(db: any, scope: ChatScope) {
  const result = await db.from('orkto_wia_chat_messages').select('role,content,message_key')
    .eq('workspace_id', scope.workspaceId).eq('user_id', scope.actorId).eq('session_id', scope.sessionId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(12);
  if (result.error) throw new Error('chat_history_unavailable');
  let remaining = 12000;
  return (result.data || []).filter((row: any) => row.message_key !== scope.traceId)
    .filter((row: any) => ['user','assistant'].includes(row.role) && typeof row.content === 'string')
    .map((row: any) => { const content = row.content.slice(0, Math.min(4000, remaining)); remaining -= content.length;
      return { role: row.role as 'user'|'assistant', content }; })
    .filter((row: any) => row.content.length > 0).reverse();
}
