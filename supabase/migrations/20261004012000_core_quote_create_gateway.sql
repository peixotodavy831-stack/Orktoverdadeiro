-- Quote creation: validated, priced server-side and committed with audit in
-- one transaction. Browser roles retain no direct table or RPC write grant.
create or replace function public.orkto_create_quote_command(
  p_actor_user_id uuid, p_workspace_id uuid, p_idempotency_key text,
  p_request_id uuid, p_fingerprint text, p_fields jsonb, p_limit integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_event_id uuid;
  v_prior public.orkto_wia_events%rowtype;
  v_quote public.quotes%rowtype;
  v_count integer;
  v_customer public.clients%rowtype;
  v_deal public.orkto_deals%rowtype;
  v_key text;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_request_id is null
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_fields) is distinct from 'object'
     or not (p_fields ?& array['client_name','client_phone','items','subtotal','discount_total','taxes','total','valid_value_days'])
     or exists(select 1 from jsonb_object_keys(p_fields) k where k not in
       ('client_name','client_phone','client_email','client_company','client_vehicle_or_service',
        'customer_id','deal_id','notes','items','subtotal','discount_total','taxes','total',
        'valid_value_days','payment_instructions'))
     or jsonb_typeof(p_fields->'items') <> 'array'
     or jsonb_array_length(p_fields->'items') not between 1 and 100
     or length(btrim(coalesce(p_fields->>'client_name',''))) not between 1 and 160
     or length(btrim(coalesce(p_fields->>'client_phone',''))) not between 1 and 40
     or length(coalesce(p_fields->>'client_email','')) > 254
     or length(coalesce(p_fields->>'client_company','')) > 160
     or length(coalesce(p_fields->>'notes','')) > 4000
     or length(coalesce(p_fields->>'payment_instructions','')) > 4000
     or (p_fields->>'valid_value_days')::integer not between 1 and 365
     or (p_fields->>'subtotal')::numeric < 0
     or (p_fields->>'discount_total')::numeric < 0
     or (p_fields->>'taxes')::numeric < 0
     or (p_fields->>'total')::numeric < 0
     or p_limit < 0 then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;
  select w.owner_user_id into v_owner
    from public.orkto_workspace_members m join public.orkto_workspaces w on w.id=m.workspace_id
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id and m.status='active'
      and m.role in ('owner','admin','manager','member') for update of w;
  if v_owner is null then raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001'; end if;
  v_key:='core:create_quote:'||p_idempotency_key;
  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,idempotency_key,payload)
  values(p_workspace_id,p_actor_user_id,'quote.created','user','quote',v_key,
    jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint))
  on conflict(workspace_id,idempotency_key) do nothing returning id into v_event_id;
  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events
      where workspace_id=p_workspace_id and idempotency_key=v_key;
    if v_prior.id is null or v_prior.event_type<>'quote.created'
       or v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    select * into v_quote from public.quotes
      where workspace_id=p_workspace_id and id=v_prior.entity_ref::uuid;
    if v_quote.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
    return jsonb_build_object('result','REPLAY','quote',to_jsonb(v_quote));
  end if;
  select count(*) into v_count from public.quotes
    where workspace_id=p_workspace_id and archived_at is null and status not in ('rejected','expired');
  if p_limit is not null and v_count>=p_limit then
    raise exception 'ORKTO_PERMISSION_DENIED' using errcode='P0001';
  end if;
  if p_fields->>'customer_id' is not null then
    select * into v_customer from public.clients
      where workspace_id=p_workspace_id and id=(p_fields->>'customer_id')::uuid and archived_at is null;
    if v_customer.id is null or v_customer.phone is distinct from p_fields->>'client_phone' then
      raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
    end if;
  end if;
  if p_fields->>'deal_id' is not null then
    select * into v_deal from public.orkto_deals
      where workspace_id=p_workspace_id and id=(p_fields->>'deal_id')::uuid and status<>'archived';
    if v_deal.id is null or (v_deal.customer_ref is not null and v_customer.id is not null
      and v_deal.customer_ref not in (v_customer.id::text,v_customer.phone)) then
      raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
    end if;
  end if;
  insert into public.quotes
    (user_id,workspace_id,quote_number,client_name,client_phone,client_email,client_company,
     client_vehicle_or_service,customer_id,deal_id,notes,items,subtotal,discount_total,
     taxes,total,valid_value_days,payment_instructions,status)
  values(v_owner,p_workspace_id,to_char(now(),'YYMMDD')||'-'||upper(substr(replace(p_request_id::text,'-',''),1,8)),
    p_fields->>'client_name',p_fields->>'client_phone',p_fields->>'client_email',p_fields->>'client_company',
    p_fields->>'client_vehicle_or_service',(p_fields->>'customer_id')::uuid,(p_fields->>'deal_id')::uuid,
    p_fields->>'notes',p_fields->'items',(p_fields->>'subtotal')::numeric,(p_fields->>'discount_total')::numeric,
    (p_fields->>'taxes')::numeric,(p_fields->>'total')::numeric,(p_fields->>'valid_value_days')::integer,
    p_fields->>'payment_instructions','pending') returning * into v_quote;
  update public.orkto_wia_events set entity_ref=v_quote.id::text,
    payload=payload||jsonb_build_object('quote_number',v_quote.quote_number,'total',v_quote.total)
    where id=v_event_id;
  return jsonb_build_object('result','CREATED','quote',to_jsonb(v_quote));
end;
$$;

revoke all on function public.orkto_create_quote_command(uuid,uuid,text,uuid,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.orkto_create_quote_command(uuid,uuid,text,uuid,text,jsonb,integer) to service_role;
