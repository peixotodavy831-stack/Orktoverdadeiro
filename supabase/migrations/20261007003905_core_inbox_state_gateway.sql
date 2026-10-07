-- Explicit internal Inbox commands. No external channel action is performed.
create or replace function public.orkto_inbox_state_command(
  p_actor_user_id uuid,
  p_workspace_id uuid,
  p_command text,
  p_conversation_id uuid,
  p_status text,
  p_idempotency_key text,
  p_request_id uuid,
  p_fingerprint text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_conversation public.orkto_conversations%rowtype;
  v_prior public.orkto_wia_events%rowtype;
  v_event_id uuid;
  v_key text;
  v_event_type text;
  v_count integer := 0;
  v_result jsonb;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_conversation_id is null
     or p_request_id is null or p_command is null
     or p_command not in ('MARK_CONVERSATION_READ','SET_CONVERSATION_STATUS')
     or (p_command = 'MARK_CONVERSATION_READ' and p_status is not null)
     or (p_command = 'SET_CONVERSATION_STATUS' and (p_status is null or p_status not in ('open','active','paused','closed','archived')))
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;

  select m.role into v_role from public.orkto_workspace_members m
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id and m.status='active';
  if v_role is null or v_role not in ('owner','admin','manager','member') then
    raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001';
  end if;
  if p_command = 'SET_CONVERSATION_STATUS' and p_status = 'archived'
     and v_role not in ('owner','admin') then
    raise exception 'ORKTO_PERMISSION_DENIED' using errcode='P0001';
  end if;

  select * into v_conversation from public.orkto_conversations c
    where c.workspace_id=p_workspace_id and c.id=p_conversation_id for update;
  if v_conversation.id is null then
    raise exception 'ORKTO_NOT_FOUND' using errcode='P0001';
  end if;

  v_key := 'core:inbox_state:' || p_idempotency_key;
  v_event_type := case p_command when 'MARK_CONVERSATION_READ' then 'conversation.read'
    else 'conversation.status_changed' end;
  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,idempotency_key,payload)
  values (p_workspace_id,p_actor_user_id,v_event_type,'user','conversation',p_conversation_id::text,v_key,
    jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint,'command',p_command))
  on conflict (workspace_id,idempotency_key) do nothing returning id into v_event_id;
  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events
      where workspace_id=p_workspace_id and idempotency_key=v_key;
    if v_prior.id is null or v_prior.event_type is distinct from v_event_type
       or v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.entity_ref is distinct from p_conversation_id::text
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint
       or v_prior.payload->'response' is null then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    return jsonb_set(v_prior.payload->'response','{result}','"REPLAY"'::jsonb);
  end if;

  if p_command = 'MARK_CONVERSATION_READ' then
    update public.orkto_messages set read_at=now()
      where workspace_id=p_workspace_id and conversation_id=p_conversation_id
        and direction='incoming' and read_at is null;
    get diagnostics v_count = row_count;
  else
    if v_conversation.status = 'archived' and p_status <> 'archived' then
      raise exception 'ORKTO_CONFLICT' using errcode='P0001';
    end if;
    update public.orkto_conversations set status=p_status,updated_at=now()
      where workspace_id=p_workspace_id and id=p_conversation_id returning * into v_conversation;
  end if;

  v_result := jsonb_build_object('result','UPDATED','conversation',jsonb_build_object(
    'id',v_conversation.id,'status',v_conversation.status,'updated_at',v_conversation.updated_at),
    'messages_marked_read',v_count);
  update public.orkto_wia_events set payload=payload || jsonb_build_object('response',v_result)
    where id=v_event_id;
  return v_result;
end;
$$;

revoke all on function public.orkto_inbox_state_command(uuid,uuid,text,uuid,text,text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.orkto_inbox_state_command(uuid,uuid,text,uuid,text,text,uuid,text)
  to service_role;
