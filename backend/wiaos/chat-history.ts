export async function readWiaChat(db: any, workspaceId: string, userId: string, sessionId?: string) {
  let query = db.from('orkto_wia_chat_messages').select('id,session_id,role,content,created_at,run_id,run:orkto_wia_runs(runtime_response)')
    .eq('workspace_id', workspaceId).eq('user_id', userId);
  if (sessionId) query = query.eq('session_id', sessionId);
  const {data, error} = await query.order('created_at', {ascending:false}).order('id', {ascending:false}).limit(201);
  if (error) throw error;
  const rows = (data || []).slice(0,200);
  if (sessionId) return { data: rows.reverse().map((row:any)=>({
    id:row.id,session_id:row.session_id,role:row.role,content:row.content,created_at:row.created_at,runId:row.run_id,
    sourceIds:Array.isArray(row.run?.runtime_response?.decision?.sourceIds)?row.run.runtime_response.decision.sourceIds.filter((id:unknown)=>typeof id==='string').slice(0,30):[],
    provider:row.run?.runtime_response?.usage?.provider,model:row.run?.runtime_response?.usage?.model,path:row.run?.runtime_response?.path,
  })), truncated: (data || []).length > 200 };
  const sessions = new Map<string,{id:string;title:string;updatedAt:string}>();
  const titled = new Set<string>();
  for (const row of rows) {
    if (!sessions.has(row.session_id)) sessions.set(row.session_id,
      {id:row.session_id,title:'Conversa WIA',updatedAt:row.created_at});
    if (row.role==='user'&&!titled.has(row.session_id)) {
      sessions.get(row.session_id)!.title=row.content.slice(0,80);titled.add(row.session_id);
    }
  }
  return {data:[...sessions.values()], truncated:(data || []).length > 200};
}
