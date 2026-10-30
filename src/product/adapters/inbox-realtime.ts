import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
export type InboxUpdateMode = 'connecting'|'events'|'periodic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Invalidations only: every event re-reads the authenticated HTTP API. Never render WAL payloads. */
export function subscribeInboxChanges(client:SupabaseClient,input:{workspaceId:string;accessToken:string;
  onChange:()=>void;onMode:(mode:InboxUpdateMode)=>void;debounceMs?:number;retryDelayMs?:number}) {
  if(!uuid.test(input.workspaceId)||!input.accessToken)throw new Error('Invalid realtime scope');
  let disposed=false,generation=0,attempt=0;
  let channel:RealtimeChannel|null=null;
  let notification:ReturnType<typeof setTimeout>|null=null,retry:ReturnType<typeof setTimeout>|null=null;
  const invalidate=()=>{if(disposed||notification)return;
    notification=setTimeout(()=>{notification=null;if(!disposed)input.onChange();},input.debounceMs??300);};
  const mode=(value:InboxUpdateMode)=>{if(!disposed)input.onMode(value);};
  const open=()=>{
    if(disposed)return;
    const current=++generation;
    if(channel)void client.removeChannel(channel).catch(()=>{});
    channel=client.channel(`orkto-inbox:${input.workspaceId}:${crypto.randomUUID()}`);
    for(const table of ['orkto_conversations','orkto_messages'])for(const event of ['INSERT','UPDATE'] as const) {
      // DELETE cannot be tenant-filtered safely by Postgres Changes. No wildcard subscription.
      channel.on('postgres_changes',{schema:'public',table,event,filter:`workspace_id=eq.${input.workspaceId}`},payload=>{
        if(disposed||current!==generation||!('workspace_id' in payload.new)||payload.new.workspace_id!==input.workspaceId)return;
        invalidate();
      });
    }
    channel.subscribe(status=>{
      if(disposed||current!==generation)return;
      if(status==='SUBSCRIBED') {
        attempt=0;if(retry){clearTimeout(retry);retry=null;}mode('events');invalidate();
      } else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) {
        mode('periodic');
        // SDK rejoins errors/timeouts. Unexpected CLOSED needs a replacement channel.
        if(status==='CLOSED'&&!retry)retry=setTimeout(()=>{retry=null;open();},input.retryDelayMs??Math.min(30_000,1000*2**Math.min(attempt++,5)));
      }
    });
  };
  mode('connecting');
  void client.realtime.setAuth(input.accessToken).then(()=>{if(!disposed)open();}).catch(()=>mode('periodic'));
  return ()=>{disposed=true;generation++;if(notification)clearTimeout(notification);if(retry)clearTimeout(retry);
    if(channel)void client.removeChannel(channel).catch(()=>{});};
}
