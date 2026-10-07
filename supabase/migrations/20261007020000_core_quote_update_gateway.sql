-- Update editable quote terms with catalog/customer checks, link revocation,
-- recovery cancellation, and audit in one service-only transaction.
create or replace function public.orkto_update_quote_command(
  p_actor_user_id uuid,
  p_workspace_id uuid,
  p_quote_id uuid,
  p_expected_updated_at timestamptz,
  p_fields jsonb,
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
  v_customer public.clients%rowtype;
  v_deal public.orkto_deals%rowtype;
  v_item jsonb;
  v_catalog public.services%rowtype;
  v_phone text;
  v_customer_id uuid;
  v_deal_id uuid;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_taxes numeric;
  v_total numeric;
  v_line numeric;
  v_links integer := 0;
  v_jobs integer := 0;
  v_actions integer := 0;
  v_key text;
  v_result jsonb;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_quote_id is null
     or p_expected_updated_at is null or p_request_id is null
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_fields) is distinct from 'object' or p_fields = '{}'::jsonb
     or exists(select 1 from jsonb_object_keys(p_fields) k where k not in
       ('client_name','client_phone','client_email','client_company','client_vehicle_or_service',
        'customer_id','deal_id','notes','items','subtotal','discount_total','taxes','total',
        'valid_value_days','payment_instructions'))
     or (p_fields ? 'items' and not (p_fields ?& array['subtotal','discount_total','taxes','total']))
     or ((p_fields ?| array['subtotal','discount_total','taxes','total']) and not (p_fields ? 'items'))
     or (p_fields ? 'client_name' and length(btrim(coalesce(p_fields->>'client_name',''))) not between 1 and 160)
     or (p_fields ? 'client_phone' and length(btrim(coalesce(p_fields->>'client_phone',''))) not between 1 and 40)
     or length(coalesce(p_fields->>'client_email','')) > 254
     or length(coalesce(p_fields->>'client_company','')) > 160
     or length(coalesce(p_fields->>'client_vehicle_or_service','')) > 500
     or length(coalesce(p_fields->>'notes','')) > 4000
     or length(coalesce(p_fields->>'payment_instructions','')) > 4000
     or (p_fields ? 'valid_value_days' and (p_fields->>'valid_value_days')::integer not between 1 and 365)
     or (p_fields ? 'items' and (jsonb_typeof(p_fields->'items') is distinct from 'array'
        or jsonb_array_length(p_fields->'items') not between 1 and 100)) then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;

  select m.role into v_role from public.orkto_workspace_members m
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id and m.status='active';
  if v_role is null or v_role not in ('owner','admin','manager','member') then
    raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001';
  end if;

  v_key := 'core:update_quote:' || p_idempotency_key;
  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,idempotency_key,payload)
  values(p_workspace_id,p_actor_user_id,'quote.updated','user','quote',p_quote_id::text,v_key,
    jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint))
  on conflict(workspace_id,idempotency_key) do nothing returning id into v_event_id;
  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events
      where workspace_id=p_workspace_id and idempotency_key=v_key;
    if v_prior.id is null or v_prior.event_type is distinct from 'quote.updated'
       or v_prior.actor_user_id is distinct from p_actor_user_id
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
  if v_quote.status in ('approved','accepted') or v_quote.updated_at is distinct from p_expected_updated_at then
    raise exception 'ORKTO_CONFLICT' using errcode='P0001';
  end if;

  v_phone := case when p_fields ? 'client_phone' then p_fields->>'client_phone' else v_quote.client_phone end;
  v_customer_id := case when p_fields ? 'customer_id' then (p_fields->>'customer_id')::uuid else v_quote.customer_id end;
  v_deal_id := case when p_fields ? 'deal_id' then (p_fields->>'deal_id')::uuid else v_quote.deal_id end;
  if v_customer_id is not null then
    select * into v_customer from public.clients c
      where c.workspace_id=p_workspace_id and c.id=v_customer_id and c.archived_at is null for share;
    if v_customer.id is null or v_customer.phone is distinct from v_phone then
      raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
    end if;
  end if;
  if v_deal_id is not null then
    select * into v_deal from public.orkto_deals d
      where d.workspace_id=p_workspace_id and d.id=v_deal_id and d.status<>'archived' for share;
    if v_deal.id is null or (v_deal.customer_ref is not null
      and v_deal.customer_ref is distinct from v_customer_id::text
      and v_deal.customer_ref is distinct from v_phone) then
      raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
    end if;
  end if;

  if p_fields ? 'items' then
    for v_item in select value from jsonb_array_elements(p_fields->'items') loop
      if jsonb_typeof(v_item) is distinct from 'object'
         or length(btrim(coalesce(v_item->>'name',''))) not between 1 and 160
         or (v_item->>'quantity')::numeric <= 0 or (v_item->>'quantity')::numeric > 10000
         or (v_item->>'unitPrice')::numeric < 0 or (v_item->>'unitPrice')::numeric > 100000000
         or (v_item->>'discount')::numeric < 0 or (v_item->>'discount')::numeric > 100 then
        raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
      end if;
      if v_item ? 'catalogItemId' then
        select * into v_catalog from public.services s
          where s.workspace_id=p_workspace_id and s.id=(v_item->>'catalogItemId')::uuid
            and s.archived_at is null for share;
        if v_catalog.id is null or v_catalog.name is distinct from v_item->>'name'
           or v_catalog.unit_price is distinct from (v_item->>'unitPrice')::numeric then
          raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
        end if;
      end if;
      v_line := round((v_item->>'quantity')::numeric * (v_item->>'unitPrice')::numeric,2);
      v_subtotal := v_subtotal + v_line;
      v_discount := v_discount + round(v_line * (v_item->>'discount')::numeric / 100,2);
    end loop;
    v_taxes := round((p_fields->>'taxes')::numeric,2);
    v_total := round(v_subtotal-v_discount+v_taxes,2);
    if v_taxes < 0 or v_total < 0 or v_total > 1000000000
       or v_subtotal is distinct from (p_fields->>'subtotal')::numeric
       or v_discount is distinct from (p_fields->>'discount_total')::numeric
       or v_total is distinct from (p_fields->>'total')::numeric then
      raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
    end if;
  end if;

  -- Workers must not start a stale follow-up while terms are being changed.
  perform 1 from public.orkto_automation_jobs j
    where j.workspace_id=p_workspace_id and j.entity_type='quote'
      and j.entity_ref=p_quote_id::text and j.status in ('scheduled','processing') for update;
  perform 1 from public.orkto_wia_actions a
    where a.workspace_id=p_workspace_id and a.action_type='send_proposal_followup'
      and a.payload @> jsonb_build_object('quoteId',p_quote_id::text)
      and a.status in ('prepared','awaiting_approval','executing') for update;
  if exists(select 1 from public.orkto_automation_jobs j
       where j.workspace_id=p_workspace_id and j.entity_type='quote'
         and j.entity_ref=p_quote_id::text and j.status='processing')
     or exists(select 1 from public.orkto_wia_actions a
       where a.workspace_id=p_workspace_id and a.action_type='send_proposal_followup'
         and a.payload @> jsonb_build_object('quoteId',p_quote_id::text)
         and a.status='executing') then
    raise exception 'ORKTO_CONFLICT' using errcode='P0001';
  end if;

  update public.quotes set
    client_name=case when p_fields ? 'client_name' then p_fields->>'client_name' else client_name end,
    client_phone=v_phone,
    client_email=case when p_fields ? 'client_email' then p_fields->>'client_email' else client_email end,
    client_company=case when p_fields ? 'client_company' then p_fields->>'client_company' else client_company end,
    client_vehicle_or_service=case when p_fields ? 'client_vehicle_or_service' then p_fields->>'client_vehicle_or_service' else client_vehicle_or_service end,
    customer_id=v_customer_id,deal_id=v_deal_id,
    notes=case when p_fields ? 'notes' then p_fields->>'notes' else notes end,
    items=case when p_fields ? 'items' then p_fields->'items' else items end,
    subtotal=case when p_fields ? 'items' then v_subtotal else subtotal end,
    discount_total=case when p_fields ? 'items' then v_discount else discount_total end,
    taxes=case when p_fields ? 'items' then v_taxes else taxes end,
    total=case when p_fields ? 'items' then v_total else total end,
    valid_value_days=case when p_fields ? 'valid_value_days' then (p_fields->>'valid_value_days')::integer else valid_value_days end,
    payment_instructions=case when p_fields ? 'payment_instructions' then p_fields->>'payment_instructions' else payment_instructions end,
    updated_at=clock_timestamp()
    where workspace_id=p_workspace_id and id=p_quote_id returning * into v_quote;

  for v_link in
    update public.orkto_live_quotes set status='revoked',updated_at=now()
      where workspace_id=p_workspace_id and quote_ref=p_quote_id::text
        and status in ('active','viewed') returning *
  loop
    v_links := v_links + 1;
    insert into public.orkto_live_quote_events
      (workspace_id,live_quote_id,event_type,idempotency_key)
    values(p_workspace_id,v_link.id,'revoked','revoked:' || v_link.id::text)
    on conflict(workspace_id,idempotency_key) do nothing;
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

  v_result := jsonb_build_object('result','UPDATED','quote',to_jsonb(v_quote),
    'revoked_links',v_links,'cancelled_jobs',v_jobs,'cancelled_actions',v_actions);
  update public.orkto_wia_events set payload=payload || jsonb_build_object(
    'changed_fields',(select jsonb_agg(k) from jsonb_object_keys(p_fields) k),
    'response',v_result) where id=v_event_id;
  return v_result;
end;
$$;

revoke all on function public.orkto_update_quote_command(uuid,uuid,uuid,timestamptz,jsonb,text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.orkto_update_quote_command(uuid,uuid,uuid,timestamptz,jsonb,text,uuid,text)
  to service_role;
