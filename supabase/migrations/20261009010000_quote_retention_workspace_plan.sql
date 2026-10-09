-- Forward fix: retention access follows the workspace subscription, not legacy profile plan.
create or replace function public.orkto_extend_quote_retention_command(
  p_actor_user_id uuid,
  p_workspace_id uuid,
  p_quote_id uuid,
  p_expected_expiry timestamptz,
  p_idempotency_key text,
  p_request_id uuid,
  p_fingerprint text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_quote public.quotes%rowtype;
  v_plan text;
  v_subscription_status text;
  v_trial_ends_at timestamptz;
  v_prior public.orkto_wia_events%rowtype;
  v_event_id uuid;
  v_key text;
  v_new_expiry timestamptz;
  v_response jsonb;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_quote_id is null
     or p_expected_expiry is null or p_request_id is null
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;

  select m.role into v_role from public.orkto_workspace_members m
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id and m.status='active';
  if v_role is null or v_role not in ('owner','admin','manager','member') then
    raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001';
  end if;

  v_key := 'core:extend_quote_retention:' || p_idempotency_key;
  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,idempotency_key,payload)
  values (p_workspace_id,p_actor_user_id,'quote.retention_extended','user','quote',p_quote_id::text,
    v_key,jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint))
  on conflict(workspace_id,idempotency_key) do nothing returning id into v_event_id;
  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events
      where workspace_id=p_workspace_id and idempotency_key=v_key;
    if v_prior.id is null or v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.entity_ref is distinct from p_quote_id::text
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint
       or v_prior.payload->'response' is null then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    return jsonb_set(v_prior.payload->'response','{result}','"REPLAY"'::jsonb);
  end if;

  select * into v_quote from public.quotes q
    where q.id=p_quote_id and q.workspace_id=p_workspace_id and q.archived_at is null for update;
  if v_quote.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
  if v_quote.status in ('approved','accepted','rejected','expired')
     or exists(select 1 from public.orkto_live_quotes l
       where l.workspace_id=p_workspace_id and l.quote_ref=p_quote_id::text and l.status='accepted') then
    raise exception 'ORKTO_CONFLICT' using errcode='P0001';
  end if;
  select sub.plan_key,sub.status,sub.trial_ends_at
    into v_plan,v_subscription_status,v_trial_ends_at
    from public.orkto_workspace_subscriptions sub
    where sub.workspace_id=p_workspace_id
    order by sub.created_at desc limit 1;
  if coalesce(v_plan,'') not in ('pro','business','scale','enterprise','founders')
     or coalesce(v_subscription_status,'') not in ('active','trial')
     or (v_subscription_status='trial' and (v_trial_ends_at is null or v_trial_ends_at<=now())) then
    raise exception 'ORKTO_CONFIGURATION_REQUIRED' using errcode='P0001';
  end if;
  if v_quote.sent_at is null or v_quote.retention_expires_at is null
     or v_quote.retention_expires_at<=now() then
    raise exception 'ORKTO_CONFLICT' using errcode='P0001';
  end if;
  if v_quote.retention_expires_at is distinct from p_expected_expiry then
    raise exception 'ORKTO_CONFLICT' using errcode='P0001';
  end if;

  v_new_expiry := v_quote.retention_expires_at + interval '14 days';
  update public.quotes set retention_expires_at=v_new_expiry,updated_at=clock_timestamp()
    where id=v_quote.id and workspace_id=p_workspace_id;
  update public.proposals set expires_at=v_new_expiry
    where quote_id=v_quote.id and workspace_id=p_workspace_id;
  insert into public.quote_extensions
    (quote_id,user_id,workspace_id,previous_expiry,new_expiry)
  values (v_quote.id,v_quote.user_id,p_workspace_id,v_quote.retention_expires_at,v_new_expiry);
  insert into public.orkto_audit_log
    (user_id,workspace_id,event_type,actor_type,actor_id,trace_id,event_data)
  values (p_actor_user_id,p_workspace_id,'quote.retention_extended','human',
    p_actor_user_id::text,p_request_id::text,
    jsonb_build_object('quote_id',v_quote.id,'previous_expiry',v_quote.retention_expires_at,
      'new_expiry',v_new_expiry,'request_id',p_request_id));
  v_response := jsonb_build_object('result','EXTENDED','quote_id',v_quote.id,'expires_at',v_new_expiry);
  update public.orkto_wia_events set payload=payload||jsonb_build_object('response',v_response)
    where id=v_event_id;
  return v_response;
end;
$$;

revoke all on function public.orkto_extend_quote_retention_command(uuid,uuid,uuid,timestamptz,text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.orkto_extend_quote_retention_command(uuid,uuid,uuid,timestamptz,text,uuid,text)
  to service_role;
