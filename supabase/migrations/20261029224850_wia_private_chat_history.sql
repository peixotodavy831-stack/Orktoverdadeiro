-- Local forward-only hardening; deploy only with the separately approved candidate.
-- Private conversational prose is not shared workspace business data.
drop policy if exists orkto_wia_chat_messages_workspace_access on public.orkto_wia_chat_messages;
create policy orkto_wia_chat_messages_self_read on public.orkto_wia_chat_messages
for select to authenticated
using (user_id = (select auth.uid()) and public.orkto_is_workspace_member(workspace_id));
-- Keep browser writes revoked; all persistence goes through the authenticated gateway.
revoke insert, update, delete on public.orkto_wia_chat_messages from anon, authenticated;
create index if not exists orkto_wia_chat_actor_recent_idx
on public.orkto_wia_chat_messages(workspace_id,user_id,created_at desc,id desc);
