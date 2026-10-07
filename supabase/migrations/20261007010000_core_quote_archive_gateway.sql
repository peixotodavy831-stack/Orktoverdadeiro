-- Archive a quote and invalidate its downstream work in one transaction.
-- This command has no external provider effect and is callable only by service_role.
create or replace function public.orkto_archive_quote_command(
  p_actor_user_id uuid,
  p_workspace_id uuid,
  p_quote_id uuid,
  p_idempotency_key text,
  p_request_id uuid,
  p_fingerprint text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_quote public.quotes%rowtype;
  v_prior public.orkto_wia_events%rowtype;
  v_event_id uuid;
  v_link public.orkto_live_quotes%rowtype;
  v_jobs integer := 0;
  v_actions integer := 0;
  v_links integer := 0;
  v_result jsonb;
  v_key text;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_quote_id is null
     or p_request_id is null or p_idempotency_key is null
     or length(p_idempotency_key) not between 8 and 128
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;

  select m.role into v_role from public.orkto_workspace_members m
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id and m.status='active';
  if v_role is null then
    raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001';
  end if;
  if v_role not in ('owner','admin') then
    raise exception 'ORKTO_PERMISSION_DENIED' using errcode='P0001';
  end if;

  v_key := 'core:archive_quote:' || p_idempotency_key;
  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,idempotency_key,payload)
  values (p_workspace_id,p_actor_user_id,'quote.archived','user','quote',p_quote_id::text,v_key,
    jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint))
  on conflict (workspace_id,idempotency_key) do nothing returning id into v_event_id;
  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events
      where workspace_id=p_workspace_id and idempotency_key=v_key;
    if v_prior.id is null or v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.event_type is distinct from 'quote.archived'
       or v_prior.entity_ref is distinct from p_quote_id::text
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint
       or v_prior.payload->'response' is null then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    return jsonb_set(v_prior.payload->'response','{result}','"REPLAY"'::jsonb);
  end if;

  select * into v_quote from public.quotes q
    where q.workspace_id=p_workspace_id and q.id=p_quote_id and q.archived_at is null for update;
  if v_quote.id is null then
    raise exception 'ORKTO_NOT_FOUND' using errcode='P0001';
  end if;
  if v_quote.status in ('approved','accepted') then
    raise exception 'ORKTO_CONFLICT' using errcode='P0001';
  end if;
  -- Serialize with a worker claiming a scheduled job or WIA action.
  perform 1 from public.orkto_automation_jobs j
    where j.workspace_id=p_workspace_id and j.entity_type='quote'
      and j.entity_ref=p_quote_id::text and j.status in ('scheduled','processing')
    for update;
  perform 1 from public.orkto_wia_actions a
    where a.workspace_id=p_workspace_id and a.action_type='send_proposal_followup'
      and a.payload @> jsonb_build_object('quoteId',p_quote_id::text)
      and a.status in ('prepared','awaiting_approval','executing')
    for update;
  if exists(select 1 from public.orkto_automation_jobs j
      where j.workspace_id=p_workspace_id and j.entity_type='quote'
        and j.entity_ref=p_quote_id::text and j.status='processing')
     or exists(select 1 from public.orkto_wia_actions a
      where a.workspace_id=p_workspace_id and a.action_type='send_proposal_followup'
        and a.payload @> jsonb_build_object('quoteId',p_quote_id::text)
        and a.status='executing') then
    raise exception 'ORKTO_CONFLICT' using errcode='P0001';
  end if;

  update public.quotes set archived_at=now(),updated_at=now()
    where workspace_id=p_workspace_id and id=p_quote_id;
  update public.proposals set is_active=false
    where workspace_id=p_workspace_id and quote_id=p_quote_id and is_active=true;
  for v_link in
    update public.orkto_live_quotes set status='revoked',updated_at=now()
      where workspace_id=p_workspace_id and quote_ref=p_quote_id::text
        and status in ('active','viewed') returning *
  loop
    v_links := v_links + 1;
    insert into public.orkto_live_quote_events
      (workspace_id,live_quote_id,event_type,idempotency_key)
    values (p_workspace_id,v_link.id,'revoked','revoked:' || v_link.id::text)
    on conflict (workspace_id,idempotency_key) do nothing;
  end loop;
  update public.orkto_automation_jobs set status='cancelled',updated_at=now()
    where workspace_id=p_workspace_id and entity_type='quote'
      and entity_ref=p_quote_id::text and status='scheduled';
  get diagnostics v_jobs = row_count;
  update public.orkto_wia_actions set status='cancelled',updated_at=now()
    where workspace_id=p_workspace_id and action_type='send_proposal_followup'
      and payload @> jsonb_build_object('quoteId',p_quote_id::text)
      and status in ('prepared','awaiting_approval');
  get diagnostics v_actions = row_count;

  v_result := jsonb_build_object('result','ARCHIVED','quote_id',p_quote_id,
    'cancelled_jobs',v_jobs,'cancelled_actions',v_actions,'revoked_links',v_links);
  update public.orkto_wia_events set payload=payload || jsonb_build_object('response',v_result)
    where id=v_event_id;
  return v_result;
end;
$$;

revoke all on function public.orkto_archive_quote_command(uuid,uuid,uuid,text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.orkto_archive_quote_command(uuid,uuid,uuid,text,uuid,text)
  to service_role;
