-- Explicit Inbox draft decision. The caller is the authenticated Edge gateway;
-- the SQL repeats membership and ownership checks before its privileged write.
create or replace function public.orkto_decide_approval_task_command(
  p_actor_user_id uuid,
  p_workspace_id uuid,
  p_idempotency_key text,
  p_request_id uuid,
  p_fingerprint text,
  p_task_id uuid,
  p_decision text,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_event_id uuid;
  v_prior public.orkto_wia_events%rowtype;
  v_task public.orkto_approval_tasks%rowtype;
  v_target_status text;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_event_type text;
  v_key text := 'core:approval_task:' || p_idempotency_key;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_request_id is null
     or p_task_id is null or p_decision is null or p_decision not in ('APPROVE','REJECT')
     or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$'
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or length(v_reason) > 1000 then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.orkto_workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = p_actor_user_id
      and m.status = 'active' and m.role in ('owner','admin','manager')
  ) then
    raise exception 'ORKTO_PERMISSION_DENIED' using errcode = 'P0001';
  end if;

  v_target_status := case p_decision when 'APPROVE' then 'approved' else 'rejected' end;
  v_event_type := case p_decision when 'APPROVE' then 'approval.approved' else 'approval.rejected' end;

  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,idempotency_key,payload)
  values
    (p_workspace_id,p_actor_user_id,v_event_type,'user','approval_task',p_task_id::text,v_key,
     jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint,
       'decision',p_decision,'result','decided'))
  on conflict (workspace_id,idempotency_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events
    where workspace_id = p_workspace_id and idempotency_key = v_key;
    if v_prior.id is null or v_prior.event_type <> v_event_type
       or v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.entity_ref is distinct from p_task_id::text
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    select * into v_task from public.orkto_approval_tasks
    where id = p_task_id and workspace_id = p_workspace_id;
    if v_task.id is null or v_task.status <> v_target_status then
      raise exception 'ORKTO_CONFLICT' using errcode = 'P0001';
    end if;
    return jsonb_build_object('result','REPLAY','task',to_jsonb(v_task),
      'deliveryStatus','CONFIGURATION_REQUIRED');
  end if;

  select t.* into v_task
  from public.orkto_approval_tasks t
  join public.orkto_conversations c on c.id = t.conversation_id
  where t.id = p_task_id and t.workspace_id = p_workspace_id
    and c.workspace_id = p_workspace_id
  for update of t;
  if v_task.id is null then
    raise exception 'ORKTO_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_task.status <> 'pending' or (v_task.expires_at is not null and v_task.expires_at <= now()) then
    raise exception 'ORKTO_CONFLICT' using errcode = 'P0001';
  end if;

  update public.orkto_approval_tasks
  set status = v_target_status, decided_at = now(), decided_by = p_actor_user_id,
      decision_reason = case when p_decision = 'REJECT' and v_reason = ''
        then 'Rejeitado pelo operador' else v_reason end,
      updated_at = now()
  where id = p_task_id and workspace_id = p_workspace_id and status = 'pending'
  returning * into v_task;
  if v_task.id is null then
    raise exception 'ORKTO_CONFLICT' using errcode = 'P0001';
  end if;

  insert into public.orkto_audit_log
    (user_id,workspace_id,conversation_id,approval_task_id,event_type,
     actor_type,actor_id,trace_id,event_data)
  values
    (p_actor_user_id,p_workspace_id,v_task.conversation_id,v_task.id,
     case p_decision when 'APPROVE' then 'wia.draft.approved' else 'wia.draft.rejected' end,
     'human',p_actor_user_id::text,v_task.trace_id,
     jsonb_build_object('request_id',p_request_id,'delivery_status','channel_not_configured',
       'reason',v_task.decision_reason));

  return jsonb_build_object('result','DECIDED','task',to_jsonb(v_task),
    'deliveryStatus','CONFIGURATION_REQUIRED');
end;
$$;

revoke all on function public.orkto_decide_approval_task_command(uuid,uuid,text,uuid,text,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.orkto_decide_approval_task_command(uuid,uuid,text,uuid,text,uuid,text,text)
  to service_role;
