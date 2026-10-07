-- Explicit, atomic terminal deal command. No browser table grants are added.
create or replace function public.orkto_transition_deal_command(
  p_actor_user_id uuid, p_workspace_id uuid, p_deal_id uuid, p_stage text,
  p_lost_reason text, p_idempotency_key text, p_request_id uuid, p_fingerprint text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_deal public.orkto_deals%rowtype;
  v_prior public.orkto_wia_events%rowtype;
  v_key text;
  v_before_stage text;
  v_quote_ids uuid[];
  v_customer_id uuid;
  v_cancelled_jobs integer := 0;
  v_cancelled_actions integer := 0;
  v_replay_job_id uuid;
  v_memory_id uuid;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_deal_id is null or p_request_id is null
     or p_stage is null or p_stage not in ('won','lost','archived') or p_idempotency_key is null
     or length(p_idempotency_key) not between 8 and 128
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or (p_lost_reason is not null and length(p_lost_reason) > 500)
     or (p_stage in ('won','archived') and p_lost_reason is not null) then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;
  if not exists (
    select 1 from public.orkto_workspace_members m
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id
      and m.status='active' and m.role in ('owner','admin','manager','member')
  ) then
    raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001';
  end if;
  if p_stage='archived' and not exists (
    select 1 from public.orkto_workspace_members m
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id
      and m.status='active' and m.role in ('owner','admin')
  ) then
    raise exception 'ORKTO_PERMISSION_DENIED' using errcode='P0001';
  end if;
  select * into v_deal from public.orkto_deals
    where workspace_id=p_workspace_id and id=p_deal_id for update;
  if v_deal.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
  v_key := 'core:deal_transition:' || p_idempotency_key;
  select * into v_prior from public.orkto_wia_events
    where workspace_id=p_workspace_id and idempotency_key=v_key;
  if v_prior.id is not null then
    if v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.entity_ref is distinct from p_deal_id::text
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    select id into v_memory_id from public.orkto_wia_memories where workspace_id=p_workspace_id
      and idempotency_key='verified-fact:workspace_deal:'||p_deal_id||':deal_outcome';
    return jsonb_build_object('result','REPLAY','deal',to_jsonb(v_deal),
      'memory_status',case when p_stage='archived' then 'not_applicable'
        when v_memory_id is null then 'customer_not_resolved' else 'persisted' end);
  end if;
  if v_deal.status=p_stage and (p_stage='archived' or v_deal.stage=p_stage) then
    select id into v_memory_id from public.orkto_wia_memories where workspace_id=p_workspace_id
      and idempotency_key='verified-fact:workspace_deal:'||p_deal_id||':deal_outcome';
    return jsonb_build_object('result','REPLAY','deal',to_jsonb(v_deal),
      'memory_status',case when p_stage='archived' then 'not_applicable'
        when v_memory_id is null then 'customer_not_resolved' else 'persisted' end);
  end if;
  if p_stage<>'archived' and (v_deal.status <> 'open' or v_deal.stage in ('won','lost')) then
    raise exception 'ORKTO_CONFLICT' using errcode='P0001';
  end if;
  if v_deal.status='archived' then raise exception 'ORKTO_CONFLICT' using errcode='P0001'; end if;
  v_before_stage := v_deal.stage;
  update public.orkto_deals set stage=case when p_stage='archived' then stage else p_stage end, status=p_stage,
    lost_reason=case when p_stage='archived' then lost_reason when p_stage='lost' then nullif(btrim(p_lost_reason),'') else null end,
    updated_at=now()
    where workspace_id=p_workspace_id and id=p_deal_id
    returning * into v_deal;

  select coalesce(array_agg(q.id),array[]::uuid[]) into v_quote_ids
    from public.quotes q where q.workspace_id=p_workspace_id and q.deal_id=p_deal_id;
  if cardinality(v_quote_ids)>0 then
    update public.orkto_automation_jobs j set status='cancelled',updated_at=now()
      where j.workspace_id=p_workspace_id and j.entity_type='quote'
        and j.entity_ref=any(select unnest(v_quote_ids)::text) and j.status='scheduled';
    get diagnostics v_cancelled_jobs = row_count;
    update public.orkto_wia_actions a set status='cancelled',updated_at=now()
      where a.workspace_id=p_workspace_id and a.action_type='send_proposal_followup'
        and a.status in ('prepared','awaiting_approval')
        and a.payload->>'quoteId'=any(select unnest(v_quote_ids)::text);
    get diagnostics v_cancelled_actions = row_count;
  end if;

  if p_stage<>'archived' and v_deal.conversation_ref is not null then
    insert into public.orkto_automation_jobs
      (workspace_id,entity_type,entity_ref,step_key,due_at,status,idempotency_key)
    values(p_workspace_id,'replay_capture',p_deal_id::text,p_stage,now(),'scheduled',
      'replay-capture:'||p_deal_id||':'||p_stage)
    on conflict(workspace_id,idempotency_key) do nothing returning id into v_replay_job_id;
  end if;

  select c.id into v_customer_id from public.clients c
    where c.workspace_id=p_workspace_id and c.archived_at is null
      and (c.id::text=v_deal.customer_ref or c.phone=v_deal.customer_ref)
    order by c.id limit 1;
  if p_stage<>'archived' and v_customer_id is not null then
    insert into public.orkto_wia_memories
      (workspace_id,memory_type,entity_type,entity_ref,content,provenance,confidence,status,idempotency_key,created_by)
    values(p_workspace_id,'fact','customer',v_customer_id::text,
      jsonb_build_object('factType','deal_outcome','dealId',p_deal_id,'title',v_deal.title,
        'status',p_stage,'stage',p_stage,'valueCents',v_deal.value_cents,'outcomeRecordedAt',v_deal.updated_at),
      jsonb_build_object('source','workspace_deal','sourceRef',p_deal_id,'verification','workspace_record'),
      0.99,'active','verified-fact:workspace_deal:'||p_deal_id||':deal_outcome',p_actor_user_id)
    on conflict(workspace_id,idempotency_key) do nothing returning id into v_memory_id;
  end if;

  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,idempotency_key,payload)
  values(p_workspace_id,p_actor_user_id,case when p_stage='archived' then 'deal.archived' else 'deal.stage_changed' end,
    'user','deal',p_deal_id::text,v_key,
    jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint,
      'from_stage',v_before_stage,'to_stage',p_stage,'cancelled_jobs',v_cancelled_jobs,
      'cancelled_actions',v_cancelled_actions,'replay_job_id',v_replay_job_id,'memory_id',v_memory_id));
  return jsonb_build_object('result','UPDATED','deal',to_jsonb(v_deal),
    'memory_status',case when p_stage='archived' then 'not_applicable'
      when v_customer_id is null then 'customer_not_resolved' else 'persisted' end);
end;
$$;

revoke all on function public.orkto_transition_deal_command(uuid,uuid,uuid,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.orkto_transition_deal_command(uuid,uuid,uuid,text,text,text,uuid,text) to service_role;
