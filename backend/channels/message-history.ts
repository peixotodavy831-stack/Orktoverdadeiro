export const MESSAGE_PAGE_SIZE=200;
export function messageHistoryCursor(at:unknown,id:unknown):{at:string;id:string}|null{
 if(at===undefined&&id===undefined)return null;
 if(typeof at!=='string'||typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(at)||!Number.isFinite(Date.parse(at)))throw new Error('MESSAGE_CURSOR_INVALID');
 // Preserve PostgreSQL microseconds: Date.toISOString() would round/truncate
 // the cursor and skip messages in the same millisecond on the next page.
 return {at,id};
}
export async function loadMessageHistory(db:any,workspaceId:string,conversationId:string,cursor:{at:string;id:string}|null=null){
 let query=db.from('orkto_messages').select('*').eq('workspace_id',workspaceId).eq('conversation_id',conversationId);
 if(cursor)query=query.or(`sent_at.lt.${cursor.at},and(sent_at.eq.${cursor.at},id.lt.${cursor.id})`);
 const {data,error}=await query.order('sent_at',{ascending:false}).order('id',{ascending:false}).limit(MESSAGE_PAGE_SIZE+1);
 if(error)throw error;
 const rows=(data||[]).slice(0,MESSAGE_PAGE_SIZE),oldest=rows.at(-1);
 return {messages:rows.reverse(),nextCursor:(data||[]).length>MESSAGE_PAGE_SIZE&&oldest?{at:oldest.sent_at,id:oldest.id}:null};
}
