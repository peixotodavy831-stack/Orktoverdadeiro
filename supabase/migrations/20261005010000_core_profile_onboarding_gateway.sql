-- Owner-only onboarding transaction. The browser keeps SELECT-only access to
-- profiles; the Edge gateway verifies Auth before invoking this service-only RPC.
create or replace function public.orkto_complete_onboarding_command(
  p_actor_user_id uuid,p_workspace_id uuid,p_idempotency_key text,
  p_request_id uuid,p_fingerprint text,p_fields jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_prior public.orkto_wia_events%rowtype;
  v_profile public.profiles%rowtype;
  v_key text := 'core:complete_onboarding:' || p_idempotency_key;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_request_id is null
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_fields is null or jsonb_typeof(p_fields) <> 'object'
     or nullif(btrim(p_fields->>'company_name'),'') is null
     or length(p_fields->>'company_name') > 160
     or nullif(btrim(p_fields->>'whatsapp_number'),'') is null
     or length(p_fields->>'whatsapp_number') not between 3 and 40
     or exists (select 1 from jsonb_object_keys(p_fields) as field(key)
       where field.key not in ('company_name','tax_id','whatsapp_number','whatsapp_template','company_logo','address',
         'payment_info','profession','brand_name','brand_tone','quote_color'))
     or exists (select 1 from jsonb_each(p_fields) as field(key,value)
       where jsonb_typeof(field.value) <> 'string')
     or length(coalesce(p_fields->>'tax_id','')) > 30
     or length(coalesce(p_fields->>'whatsapp_template','')) > 4000
     or length(coalesce(p_fields->>'company_logo','')) > 2500
     or length(coalesce(p_fields->>'address','')) > 300
     or length(coalesce(p_fields->>'payment_info','')) > 1000
     or length(coalesce(p_fields->>'profession','')) > 100
     or length(coalesce(p_fields->>'brand_name','')) > 160
     or (p_fields ? 'brand_tone' and p_fields->>'brand_tone' not in ('formal','técnico','comercial','criativo'))
     or (p_fields ? 'quote_color' and p_fields->>'quote_color' !~ '^#[0-9a-fA-F]{6}$') then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;

  if not exists (select 1 from public.orkto_workspace_members m
    join public.orkto_workspaces w on w.id=m.workspace_id
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id
      and m.status='active' and m.role='owner' and w.owner_user_id=p_actor_user_id) then
    raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001';
  end if;

  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,idempotency_key,payload)
  values (p_workspace_id,p_actor_user_id,'profile.onboarding_completed','user','profile',
    p_actor_user_id::text,v_key,
    jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint,'result','completed',
      'changed_fields',(select jsonb_agg(field.key) from jsonb_object_keys(p_fields) as field(key))))
  on conflict(workspace_id,idempotency_key) do nothing returning id into v_event_id;
  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events
      where workspace_id=p_workspace_id and idempotency_key=v_key;
    if v_prior.id is null or v_prior.event_type<>'profile.onboarding_completed'
       or v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    return jsonb_build_object('result','REPLAY','profile',jsonb_build_object(
      'id',p_actor_user_id,'onboarding_completed',true));
  end if;

  update public.profiles as p set
    company_name=btrim(p_fields->>'company_name'),
    tax_id=case when p_fields ? 'tax_id' then p_fields->>'tax_id' else p.tax_id end,
    whatsapp_number=btrim(p_fields->>'whatsapp_number'),
    whatsapp_template=case when p_fields ? 'whatsapp_template' then p_fields->>'whatsapp_template' else p.whatsapp_template end,
    company_logo=case when p_fields ? 'company_logo' then p_fields->>'company_logo' else p.company_logo end,
    address=case when p_fields ? 'address' then p_fields->>'address' else p.address end,
    payment_info=case when p_fields ? 'payment_info' then p_fields->>'payment_info' else p.payment_info end,
    profession=case when p_fields ? 'profession' then p_fields->>'profession' else p.profession end,
    brand_name=case when p_fields ? 'brand_name' then p_fields->>'brand_name' else p.brand_name end,
    brand_tone=case when p_fields ? 'brand_tone' then p_fields->>'brand_tone' else p.brand_tone end,
    quote_color=case when p_fields ? 'quote_color' then p_fields->>'quote_color' else p.quote_color end,
    onboarding_completed=true
  where p.id=p_actor_user_id returning * into v_profile;
  if v_profile.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
  return jsonb_build_object('result','UPDATED','profile',jsonb_build_object(
    'id',v_profile.id,'onboarding_completed',v_profile.onboarding_completed));
end;
$$;

revoke all on function public.orkto_complete_onboarding_command(uuid,uuid,text,uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.orkto_complete_onboarding_command(uuid,uuid,text,uuid,text,jsonb)
  to service_role;
