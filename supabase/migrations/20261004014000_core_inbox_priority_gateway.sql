-- Explicit Inbox priority override. The command cannot send a message.
create or replace function public.orkto_set_conversation_priority_command(
  p_actor_user_id uuid,p_workspace_id uuid,p_conversation_id uuid,p_priority text,
  p_idempotency_key text,p_request_id uuid,p_fingerprint text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_prior public.orkto_wia_events%rowtype;
  v_conversation public.orkto_conversations%rowtype;
  v_key text;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_conversation_id is null or p_request_id is null
     or (p_priority is not null and p_priority not in ('low','normal','high','urgent'))
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;
  if not exists(select 1 from public.orkto_workspace_members m
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id and m.status='active'
      and m.role in ('owner','admin','manager','member')) then
    raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001';
  end if;
  v_key:='core:set_conversation_priority:'||p_idempotency_key;
  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,idempotency_key,payload)
  values(p_workspace_id,p_actor_user_id,'conversation.priority_overridden','user','conversation',v_key,
    jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint,'priority',p_priority))
  on conflict(workspace_id,idempotency_key) do nothing returning id into v_event_id;
  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events
      where workspace_id=p_workspace_id and idempotency_key=v_key;
    if v_prior.id is null or v_prior.event_type<>'conversation.priority_overridden'
       or v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint
       or v_prior.entity_ref is distinct from p_conversation_id::text then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    return jsonb_build_object('result','REPLAY','conversation',jsonb_build_object(
      'id',p_conversation_id,'priority_override',v_prior.payload->'priority'));
  end if;
  update public.orkto_conversations set priority_override=p_priority,updated_at=now()
    where workspace_id=p_workspace_id and id=p_conversation_id returning * into v_conversation;
  if v_conversation.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
  update public.orkto_wia_events set entity_ref=v_conversation.id::text where id=v_event_id;
  return jsonb_build_object('result','UPDATED','conversation',jsonb_build_object(
    'id',v_conversation.id,'priority_override',v_conversation.priority_override));
end;
$$;

revoke all on function public.orkto_set_conversation_priority_command(uuid,uuid,uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.orkto_set_conversation_priority_command(uuid,uuid,uuid,text,text,uuid,text) to service_role;
