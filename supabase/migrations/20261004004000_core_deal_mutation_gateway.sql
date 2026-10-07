-- Core deal creation and nonterminal pipeline edits. Terminal outcomes retain
-- their separate replay/memory side effects and are not enabled by this command.
create or replace function public.orkto_deal_command(
  p_actor_user_id uuid, p_workspace_id uuid, p_command text, p_deal_id uuid,
  p_idempotency_key text, p_request_id uuid, p_fingerprint text, p_fields jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_event_id uuid;
  v_prior public.orkto_wia_events%rowtype;
  v_deal public.orkto_deals%rowtype;
  v_before_stage text;
  v_key text;
  v_customer_count integer;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_request_id is null
     or p_command is null or p_command not in ('CREATE_DEAL','UPDATE_DEAL')
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_fields) is distinct from 'object'
     or exists(select 1 from jsonb_object_keys(p_fields) k where k not in
        ('title','description','customer_ref','conversation_ref','stage','value_cents','probability_percent','owner_user_id','expected_close_on','source'))
     or (p_fields ? 'title' and (jsonb_typeof(p_fields->'title') <> 'string' or length(btrim(p_fields->>'title')) not between 1 and 180))
     or (p_fields ? 'description' and (jsonb_typeof(p_fields->'description') <> 'string' or length(p_fields->>'description') > 4000))
     or (p_fields ? 'customer_ref' and (jsonb_typeof(p_fields->'customer_ref') not in ('string','null') or length(coalesce(p_fields->>'customer_ref','')) > 200))
     or (p_fields ? 'conversation_ref' and jsonb_typeof(p_fields->'conversation_ref') not in ('string','null'))
     or (p_fields ? 'stage' and (jsonb_typeof(p_fields->'stage') <> 'string' or p_fields->>'stage' not in ('new','qualification','proposal','negotiation')))
     or (p_fields ? 'value_cents' and (jsonb_typeof(p_fields->'value_cents') <> 'number' or (p_fields->>'value_cents')::numeric not between 0 and 10000000000 or (p_fields->>'value_cents')::numeric <> trunc((p_fields->>'value_cents')::numeric)))
     or (p_fields ? 'probability_percent' and (jsonb_typeof(p_fields->'probability_percent') not in ('number','null') or (p_fields->>'probability_percent')::numeric not between 0 and 100))
     or (p_fields ? 'owner_user_id' and jsonb_typeof(p_fields->'owner_user_id') not in ('string','null'))
     or (p_fields ? 'expected_close_on' and jsonb_typeof(p_fields->'expected_close_on') not in ('string','null'))
     or (p_fields ? 'source' and (jsonb_typeof(p_fields->'source') <> 'string' or length(p_fields->>'source') > 80))
     or (p_command='CREATE_DEAL' and (p_deal_id is not null or not (p_fields ?& array['title','description','stage','value_cents','source'])))
     or (p_command='UPDATE_DEAL' and (p_deal_id is null or p_fields='{}'::jsonb
       or exists(select 1 from jsonb_object_keys(p_fields) k where k not in
         ('title','description','stage','value_cents','probability_percent','owner_user_id','expected_close_on')))) then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;

  select w.owner_user_id into v_owner
  from public.orkto_workspace_members m join public.orkto_workspaces w on w.id=m.workspace_id
  where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id and m.status='active'
    and m.role in ('owner','admin','manager','member') for share of m,w;
  if v_owner is null then raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001'; end if;
  if p_fields ? 'owner_user_id' and p_fields->>'owner_user_id' is not null
     and not exists(select 1 from public.orkto_workspace_members m where m.workspace_id=p_workspace_id
                    and m.user_id=(p_fields->>'owner_user_id')::uuid and m.status='active') then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;
  if p_fields ? 'customer_ref' and nullif(p_fields->>'customer_ref','') is not null then
    select count(*) into v_customer_count from public.clients c where c.workspace_id=p_workspace_id
      and c.archived_at is null and (c.id::text=p_fields->>'customer_ref' or c.phone=p_fields->>'customer_ref');
    if v_customer_count<>1 then raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001'; end if;
  end if;
  if p_fields ? 'conversation_ref' and p_fields->>'conversation_ref' is not null
     and not exists(select 1 from public.orkto_conversations c where c.workspace_id=p_workspace_id
                    and c.id=(p_fields->>'conversation_ref')::uuid) then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;

  v_key := 'core:'||lower(p_command)||':'||p_idempotency_key;
  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,idempotency_key,payload)
  values(p_workspace_id,p_actor_user_id,case when p_command='CREATE_DEAL' then 'deal.created' else 'deal.updated' end,
         'user','deal',v_key,jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint,'changed_fields',(select jsonb_agg(k) from jsonb_object_keys(p_fields) k)))
  on conflict(workspace_id,idempotency_key) do nothing returning id into v_event_id;
  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events where workspace_id=p_workspace_id and idempotency_key=v_key;
    if v_prior.id is null or v_prior.event_type not in ('deal.created','deal.updated','deal.stage_changed')
       or v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint
       or (p_deal_id is not null and v_prior.entity_ref is distinct from p_deal_id::text) then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    select * into v_deal from public.orkto_deals where workspace_id=p_workspace_id and id=v_prior.entity_ref::uuid;
    if v_deal.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
    return jsonb_build_object('result','REPLAY','deal',to_jsonb(v_deal));
  end if;

  if p_command='CREATE_DEAL' then
    insert into public.orkto_deals
      (workspace_id,customer_ref,conversation_ref,title,description,stage,status,value_cents,probability_percent,owner_user_id,expected_close_on,source,created_by)
    values(p_workspace_id,p_fields->>'customer_ref',(p_fields->>'conversation_ref')::uuid,btrim(p_fields->>'title'),p_fields->>'description',p_fields->>'stage','open',
           (p_fields->>'value_cents')::bigint,(p_fields->>'probability_percent')::numeric,coalesce((p_fields->>'owner_user_id')::uuid,p_actor_user_id),
           (p_fields->>'expected_close_on')::date,p_fields->>'source',p_actor_user_id)
    returning * into v_deal;
  else
    select stage into v_before_stage from public.orkto_deals
    where workspace_id=p_workspace_id and id=p_deal_id and status<>'archived' for update;
    if v_before_stage is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
    if v_before_stage in ('won','lost') then raise exception 'ORKTO_CONFLICT' using errcode='P0001'; end if;
    update public.orkto_deals set
      title=case when p_fields ? 'title' then btrim(p_fields->>'title') else title end,
      description=case when p_fields ? 'description' then p_fields->>'description' else description end,
      customer_ref=case when p_fields ? 'customer_ref' then p_fields->>'customer_ref' else customer_ref end,
      conversation_ref=case when p_fields ? 'conversation_ref' then (p_fields->>'conversation_ref')::uuid else conversation_ref end,
      stage=case when p_fields ? 'stage' then p_fields->>'stage' else stage end,
      value_cents=case when p_fields ? 'value_cents' then (p_fields->>'value_cents')::bigint else value_cents end,
      probability_percent=case when p_fields ? 'probability_percent' then (p_fields->>'probability_percent')::numeric else probability_percent end,
      owner_user_id=case when p_fields ? 'owner_user_id' then (p_fields->>'owner_user_id')::uuid else owner_user_id end,
      expected_close_on=case when p_fields ? 'expected_close_on' then (p_fields->>'expected_close_on')::date else expected_close_on end,
      updated_at=now()
    where workspace_id=p_workspace_id and id=p_deal_id and status='open' returning * into v_deal;
    if v_deal.id is null then raise exception 'ORKTO_CONFLICT' using errcode='P0001'; end if;
  end if;
  update public.orkto_wia_events set entity_ref=v_deal.id::text,
    event_type=case when p_command='UPDATE_DEAL' and v_before_stage is distinct from v_deal.stage then 'deal.stage_changed' else event_type end,
    payload=payload || jsonb_build_object('from_stage',v_before_stage,'to_stage',v_deal.stage)
  where id=v_event_id;
  return jsonb_build_object('result',case when p_command='CREATE_DEAL' then 'CREATED' else 'UPDATED' end,'deal',to_jsonb(v_deal),'memory_status','not_applicable');
end;
$$;

revoke all on function public.orkto_deal_command(uuid,uuid,text,uuid,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.orkto_deal_command(uuid,uuid,text,uuid,text,uuid,text,jsonb) to service_role;
