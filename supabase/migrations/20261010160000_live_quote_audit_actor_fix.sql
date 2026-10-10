-- Keep the human actor category consistent with orkto_audit_log_actor_type_check.
-- The publication command remains service-role only; no direct browser write is granted.

create or replace function public.orkto_publish_live_quote_command(
  p_actor_user_id uuid,
  p_workspace_id uuid,
  p_quote_id uuid,
  p_public_token_hash text,
  p_idempotency_key text,
  p_request_id uuid,
  p_fingerprint text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_quote public.quotes%rowtype;
  v_prior public.orkto_wia_events%rowtype;
  v_event_id uuid;
  v_item jsonb;
  v_catalog public.services%rowtype;
  v_versions record;
  v_live public.orkto_live_quotes%rowtype;
  v_snapshot jsonb;
  v_valid_until timestamptz;
  v_version integer;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_line numeric;
  v_key text;
  v_result jsonb;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_quote_id is null
     or p_request_id is null or p_public_token_hash !~ '^[0-9a-f]{64}$'
     or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128 then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;

  select m.role into v_role from public.orkto_workspace_members m
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id and m.status='active';
  if v_role is null or v_role not in ('owner','admin','manager','member') then
    raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001';
  end if;

  v_key := 'core:publish_live_quote:' || p_idempotency_key;
  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,idempotency_key,payload)
  values(p_workspace_id,p_actor_user_id,'live_quote.published','user','quote',p_quote_id::text,v_key,
    jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint))
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
    where q.workspace_id=p_workspace_id and q.id=p_quote_id and q.archived_at is null for update;
  if v_quote.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
  if v_quote.status not in ('draft','pending','sent','viewed') then
    raise exception 'ORKTO_CONFLICT' using errcode='P0001';
  end if;
  if jsonb_typeof(v_quote.items) is distinct from 'array' or jsonb_array_length(v_quote.items) not between 1 and 100 then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;

  for v_item in select value from jsonb_array_elements(v_quote.items) loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or coalesce(v_item->>'catalogItemId',v_item->>'serviceId',v_item->>'catalog_item_id','') = ''
       or length(btrim(coalesce(v_item->>'name',''))) not between 1 and 160
       or (v_item->>'quantity')::numeric <= 0
       or (v_item->>'unitPrice')::numeric < 0
       or coalesce((v_item->>'discount')::numeric,0) not between 0 and 100 then
      raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
    end if;
    select * into v_catalog from public.services s
      where s.workspace_id=p_workspace_id
        and s.id=coalesce(v_item->>'catalogItemId',v_item->>'serviceId',v_item->>'catalog_item_id')::uuid
        and s.archived_at is null for share;
    if v_catalog.id is null or v_catalog.name is distinct from v_item->>'name'
       or round(v_catalog.unit_price,2) is distinct from round((v_item->>'unitPrice')::numeric,2) then
      raise exception 'ORKTO_CONFLICT' using errcode='P0001';
    end if;
    v_line := round((v_item->>'quantity')::numeric * (v_item->>'unitPrice')::numeric,2);
    v_subtotal := v_subtotal + v_line;
    v_discount := v_discount + round(v_line * coalesce((v_item->>'discount')::numeric,0) / 100,2);
  end loop;
  v_total := round(v_subtotal-v_discount+coalesce(v_quote.taxes,0),2);
  if v_subtotal is distinct from round(v_quote.subtotal,2)
     or v_discount is distinct from round(v_quote.discount_total,2)
     or v_total is distinct from round(v_quote.total,2) then
    raise exception 'ORKTO_CONFLICT' using errcode='P0001';
  end if;

  if exists(select 1 from public.orkto_live_quotes l
    where l.workspace_id=p_workspace_id and l.quote_ref=p_quote_id::text and l.status='accepted') then
    raise exception 'ORKTO_CONFLICT' using errcode='P0001';
  end if;
  v_valid_until := case when v_quote.valid_value_days is null then null
    else v_quote.created_at + make_interval(days=>v_quote.valid_value_days) end;
  if v_valid_until is not null and v_valid_until <= now() then
    raise exception 'ORKTO_CONFLICT' using errcode='P0001';
  end if;
  select coalesce(max(l.version),0)+1 into v_version from public.orkto_live_quotes l
    where l.workspace_id=p_workspace_id and l.quote_ref=p_quote_id::text;
  v_snapshot := jsonb_build_object(
    'clientName',v_quote.client_name,'company',v_quote.client_company,
    'request',v_quote.client_vehicle_or_service,'items',v_quote.items,
    'subtotal',v_quote.subtotal,'discountTotal',v_quote.discount_total,
    'taxes',v_quote.taxes,'total',v_quote.total,'notes',v_quote.notes,
    'paymentInstructions',v_quote.payment_instructions,'validUntil',v_valid_until,
    'priceAudit',jsonb_build_object('arithmetic','passed','catalogPriceVerification','passed',
      'catalogVersionCheckedAt',now(),'humanAuthoredQuote',true),
    'signature',jsonb_build_object('label','Powered by ORKTO','brand','ORKTO'));

  for v_versions in
    update public.orkto_live_quotes set status='revoked',updated_at=now()
      where workspace_id=p_workspace_id and quote_ref=p_quote_id::text
        and status in ('active','viewed') returning id
  loop
    insert into public.orkto_live_quote_events(workspace_id,live_quote_id,event_type,idempotency_key)
      values(p_workspace_id,v_versions.id,'revoked','revoked:'||v_versions.id::text)
      on conflict(workspace_id,idempotency_key) do nothing;
  end loop;
  insert into public.orkto_live_quotes
    (workspace_id,quote_ref,public_token_hash,version,snapshot,current_price_cents,status,valid_until,created_by)
  values(p_workspace_id,p_quote_id::text,p_public_token_hash,v_version,v_snapshot,
    round(v_quote.total*100)::bigint,'active',v_valid_until,p_actor_user_id)
  returning * into v_live;
  insert into public.orkto_live_quote_events(workspace_id,live_quote_id,event_type,idempotency_key)
    values(p_workspace_id,v_live.id,'created','created:'||v_live.id::text);
  update public.quotes set status='sent',updated_at=clock_timestamp()
    where workspace_id=p_workspace_id and id=p_quote_id and status in ('draft','pending','sent','viewed');
  insert into public.orkto_audit_log
    (user_id,workspace_id,event_type,actor_type,actor_id,trace_id,event_data)
  values(p_actor_user_id,p_workspace_id,'live_quote.created','human',p_actor_user_id::text,p_request_id::text,
    jsonb_build_object('live_quote_id',v_live.id,'quote_id',p_quote_id,'version',v_version,'request_id',p_request_id));
  v_result := jsonb_build_object('result','CREATED','live_quote',jsonb_build_object(
    'id',v_live.id,'quote_ref',v_live.quote_ref,'version',v_live.version,'status',v_live.status,
    'valid_until',v_live.valid_until,'created_at',v_live.created_at));
  update public.orkto_wia_events set payload=payload||jsonb_build_object('response',v_result) where id=v_event_id;
  return v_result;
end;
$$;

revoke all on function public.orkto_publish_live_quote_command(uuid,uuid,uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.orkto_publish_live_quote_command(uuid,uuid,uuid,text,text,uuid,text) to service_role;
