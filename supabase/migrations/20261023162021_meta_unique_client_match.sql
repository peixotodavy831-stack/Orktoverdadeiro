-- Unique automatic association only; existing/manual links are preserved.
-- No backfill, new policies, roles, grants or external calls.
begin;
create index if not exists clients_workspace_phone_active_idx
  on public.clients(workspace_id,phone) where archived_at is null;
create or replace function public.orkto_ingest_meta_text_message(
  p_connection_id uuid,p_provider_event_id text,p_claim_token uuid,p_external_message_id text,p_sender_phone text,
  p_text text,p_occurred_at timestamptz
) returns table(decision text,conversation_id uuid,message_id uuid,service_mode text)
language plpgsql security definer set search_path = '' as $$
declare
  v_connection public.orkto_channel_connections%rowtype;
  v_event public.orkto_whatsapp_webhook_events%rowtype;
  v_conversation public.orkto_conversations%rowtype;
  v_owner uuid; v_customer_id uuid; v_message_id uuid; v_existing uuid;
begin
  if p_connection_id is null or p_claim_token is null or nullif(trim(p_provider_event_id),'') is null
    or nullif(trim(p_external_message_id),'') is null or length(p_external_message_id)>400
    or p_sender_phone is null or p_sender_phone !~ '^[0-9]{5,30}$'
    or nullif(p_text,'') is null or length(p_text)>65536
    or p_occurred_at is null then raise exception 'invalid Meta text message' using errcode='22023'; end if;
  select c.* into v_connection from public.orkto_channel_connections c
    where c.id=p_connection_id and c.provider='meta_whatsapp_cloud' and c.status='connected' for update;
  if v_connection.id is null then return query select 'CONNECTION_NOT_FOUND'::text,null::uuid,null::uuid,null::text; return; end if;
  select e.* into v_event from public.orkto_whatsapp_webhook_events e
    where e.provider='meta_whatsapp_cloud' and e.provider_event_id=trim(p_provider_event_id)
      and e.connection_id=v_connection.id and e.processing_claim_token=p_claim_token for update;
  if v_event.id is null or v_event.status<>'processing' then
    return query select case when v_event.status='processed' then 'DUPLICATE' else 'EVENT_NOT_CLAIMED' end,
      null::uuid,null::uuid,v_connection.service_mode; return;
  end if;
  select m.id into v_existing from public.orkto_messages m
    where m.workspace_id=v_connection.workspace_id and m.external_event_id=p_external_message_id;
  if v_existing is not null then
    update public.orkto_whatsapp_webhook_events set status='processed',processed_at=now(),updated_at=now() where id=v_event.id;
    return query select 'DUPLICATE'::text,null::uuid,v_existing,v_connection.service_mode; return;
  end if;
  select w.owner_user_id into v_owner from public.orkto_workspaces w where w.id=v_connection.workspace_id;
  -- Only a unique active match may link a new conversation. Two rows suffice
  -- to detect ambiguity, regardless of the size of the customer's history.
  select case when count(*)=1 then (array_agg(candidate.id))[1] else null::uuid end
    into v_customer_id from (
      select c.id from public.clients c where c.workspace_id=v_connection.workspace_id
        and c.phone=p_sender_phone and c.archived_at is null limit 2
    ) candidate;
  select c.* into v_conversation from public.orkto_conversations c
    where c.workspace_id=v_connection.workspace_id and c.source_channel='whatsapp'
      and c.contact_phone=p_sender_phone order by c.created_at limit 1 for update;
  if v_conversation.id is null then
    insert into public.orkto_conversations(user_id,workspace_id,contact_name,contact_phone,status,
      source_channel,mood_state,customer_id,external_thread_id,last_message_at)
    values(v_owner,v_connection.workspace_id,case when v_customer_id is null then 'WhatsApp '||right(p_sender_phone,4)
      else (select c.name from public.clients c where c.id=v_customer_id) end,p_sender_phone,'active','whatsapp','neutral',
      v_customer_id,v_connection.id::text,p_occurred_at) returning * into v_conversation;
  end if;
  v_message_id:=gen_random_uuid();
  insert into public.orkto_messages(id,workspace_id,conversation_id,sender_role,content,message_type,
    direction,external_event_id,sent_at,metadata)
  values(v_message_id,v_connection.workspace_id,v_conversation.id,'contact',p_text,'text','incoming',
    p_external_message_id,p_occurred_at,jsonb_build_object('provider','meta_whatsapp_cloud','connection_id',v_connection.id));
  update public.orkto_conversations set status='active',customer_id=coalesce(customer_id,v_customer_id),
    last_message_at=greatest(coalesce(last_message_at,p_occurred_at),p_occurred_at),updated_at=now()
    where id=v_conversation.id and workspace_id=v_connection.workspace_id;
  insert into public.orkto_whatsapp_usage_events(workspace_id,connection_id,provider_message_id,
    direction,category,cost_state,occurred_at)
  values(v_connection.workspace_id,v_connection.id,p_external_message_id,'incoming','service','unpriced',p_occurred_at)
  on conflict(connection_id,provider_message_id,direction) do nothing;
  update public.orkto_whatsapp_webhook_events set status='processed',processed_at=now(),updated_at=now() where id=v_event.id;
  insert into public.orkto_audit_log(user_id,workspace_id,conversation_id,event_type,actor_type,actor_id,event_data)
  values(v_owner,v_connection.workspace_id,v_conversation.id,'channel.meta.message_received','system','meta_webhook',
    jsonb_build_object('message_id',v_message_id,'connection_id',v_connection.id,'service_mode',v_connection.service_mode));
  return query select 'APPLIED'::text,v_conversation.id,v_message_id,v_connection.service_mode;
end $$;

commit;
