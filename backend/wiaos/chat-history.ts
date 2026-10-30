export async function readWiaChat(db: any, workspaceId: string, userId: string, sessionId?: string) {
  const columns='id,session_id,role,content,created_at'+(sessionId?',run_id,run:orkto_wia_runs(workspace_id,user_id,status,completed_at,runtime_response)':'');
  let query = db.from('orkto_wia_chat_messages').select(columns)
    .eq('workspace_id', workspaceId).eq('user_id', userId);
  if (sessionId) query = query.eq('session_id', sessionId);
  const {data, error} = await query.order('created_at', {ascending:false}).order('id', {ascending:false}).limit(201);
  if (error) throw error;
  const rows = (data || []).slice(0,200);
  if (sessionId) {
    const ownedRun = (row:any) => row.run?.workspace_id===workspaceId && row.run?.user_id===userId ? row.run : null;
    const metadata = (row:any) => {
      const response=ownedRun(row)?.runtime_response;
      const text=(value:unknown)=>typeof value==='string'?value:undefined;
      return {runId:ownedRun(row)?row.run_id:undefined,
        sourceIds:Array.isArray(response?.decision?.sourceIds)?response.decision.sourceIds.filter((id:unknown)=>typeof id==='string').slice(0,30):[],
        provider:text(response?.usage?.provider),model:text(response?.usage?.model),path:text(response?.path)};
    };
    const replies=new Set(rows.filter((row:any)=>row.role==='assistant').map((row:any)=>row.run_id));
    const messages:any[]=[];
    for(const row of rows) {
      const extra=metadata(row);
      messages.push({id:row.id,session_id:row.session_id,role:row.role,content:row.content,created_at:row.created_at,...extra});
      const run=ownedRun(row),content=run?.runtime_response?.decision?.messageDraft;
      // The execution response is already durable. A lost chat insert must not
      // force another inference after reload. GET performs no repair/write.
      if(row.role==='user' && row.run_id && !replies.has(row.run_id) && run?.status==='succeeded'
        && typeof content==='string' && content.trim() && content.length<=4000
        && typeof run.completed_at==='string' && Number.isFinite(Date.parse(run.completed_at))
        && Date.parse(run.completed_at)>=Date.parse(row.created_at)) {
        messages.push({id:`recovered:${row.run_id}`,session_id:row.session_id,role:'assistant',content,
          created_at:run.completed_at,recovered:true,...extra});
        replies.add(row.run_id);
      }
    }
    messages.sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)
      || (a.runId&&a.runId===b.runId&&a.role!==b.role?(a.role==='user'?-1:1):String(a.id).localeCompare(String(b.id))));
    return {data:messages.slice(-200),truncated:(data || []).length>200 || messages.length>200};
  }
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
