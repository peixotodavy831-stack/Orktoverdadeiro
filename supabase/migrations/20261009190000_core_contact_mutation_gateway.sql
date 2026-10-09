-- Explicit, service-only Contacts commands. Browser table writes remain revoked.
create or replace function public.orkto_contact_command(
  p_actor_user_id uuid, p_workspace_id uuid, p_idempotency_key text,
  p_request_id uuid, p_fingerprint text, p_command text,
  p_contact_id uuid, p_fields jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_prior public.orkto_wia_events%rowtype;
  v_contact public.orkto_contacts%rowtype;
  v_client public.clients%rowtype;
  v_key text := 'core:contact:' || lower(coalesce(p_command,'')) || ':' || coalesce(p_idempotency_key,'');
  v_customer_id uuid;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_request_id is null
     or p_command is null or p_command not in ('CREATE_CONTACT','UPDATE_CONTACT')
     or (p_command = 'CREATE_CONTACT' and p_contact_id is not null)
     or (p_command = 'UPDATE_CONTACT' and p_contact_id is null)
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_fields) is distinct from 'object' or p_fields = '{}'::jsonb
     or exists (select 1 from jsonb_object_keys(p_fields) k
                where k not in ('full_name','phone','email','company','role','customer_id'))
     or (p_command = 'CREATE_CONTACT' and not (p_fields ? 'full_name'))
     or (p_fields ? 'full_name' and (jsonb_typeof(p_fields->'full_name') <> 'string'
         or length(btrim(p_fields->>'full_name')) not between 1 and 200))
     or (p_fields ? 'phone' and (jsonb_typeof(p_fields->'phone') not in ('string','null')
         or length(coalesce(p_fields->>'phone','')) > 80))
     or (p_fields ? 'email' and (jsonb_typeof(p_fields->'email') not in ('string','null')
         or length(coalesce(p_fields->>'email','')) > 254
         or (p_fields->>'email' is not null and p_fields->>'email' !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')))
     or (p_fields ? 'company' and (jsonb_typeof(p_fields->'company') not in ('string','null')
         or length(coalesce(p_fields->>'company','')) > 200))
     or (p_fields ? 'role' and (jsonb_typeof(p_fields->'role') not in ('string','null')
         or length(coalesce(p_fields->>'role','')) > 120))
     or (p_fields ? 'customer_id' and jsonb_typeof(p_fields->'customer_id') not in ('string','null')) then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;

  if not exists (select 1 from public.orkto_workspace_members m
                 where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id
                   and m.status='active' and m.role in ('owner','admin','manager','member')) then
    raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001';
  end if;

  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,idempotency_key,payload)
  values
    (p_workspace_id,p_actor_user_id,
     case when p_command='CREATE_CONTACT' then 'contact.created' else 'contact.updated' end,
     'user','contact',v_key,
     jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint,
                        'changed_fields',(select jsonb_agg(k) from jsonb_object_keys(p_fields) k)))
  on conflict (workspace_id,idempotency_key) do nothing returning id into v_event_id;

  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events
    where workspace_id=p_workspace_id and idempotency_key=v_key;
    if v_prior.id is null
       or v_prior.event_type <> (case when p_command='CREATE_CONTACT' then 'contact.created' else 'contact.updated' end)
       or v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint
       or (p_command='UPDATE_CONTACT' and v_prior.entity_ref is distinct from p_contact_id::text) then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    select * into v_contact from public.orkto_contacts
    where workspace_id=p_workspace_id and id=v_prior.entity_ref::uuid;
    if v_contact.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
    return jsonb_build_object('result','REPLAY','contact',to_jsonb(v_contact));
  end if;

  if p_command='UPDATE_CONTACT' then
    select * into v_contact from public.orkto_contacts
    where id=p_contact_id and workspace_id=p_workspace_id for update;
    if v_contact.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
  end if;

  if p_fields ? 'customer_id' and p_fields->>'customer_id' is not null then
    begin v_customer_id := (p_fields->>'customer_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
    end;
    select * into v_client from public.clients
    where id=v_customer_id and workspace_id=p_workspace_id and archived_at is null;
    if v_client.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
  elsif p_command='UPDATE_CONTACT' and not (p_fields ? 'customer_id') then
    v_customer_id := v_contact.customer_id;
  end if;

  if p_command='CREATE_CONTACT' then
    if nullif(btrim(coalesce(p_fields->>'phone','')),'') is null
       and nullif(btrim(coalesce(p_fields->>'email','')),'') is null then
      raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
    end if;
    insert into public.orkto_contacts
      (workspace_id,customer_id,full_name,phone,email,company,role,source,created_by)
    values
      (p_workspace_id,v_customer_id,btrim(p_fields->>'full_name'),nullif(btrim(p_fields->>'phone'),''),
       nullif(btrim(p_fields->>'email'),''),p_fields->>'company',p_fields->>'role','manual',p_actor_user_id)
    returning * into v_contact;
  else
    if nullif(btrim(coalesce(case when p_fields ? 'phone' then p_fields->>'phone' else v_contact.phone end,'')),'') is null
       and nullif(btrim(coalesce(case when p_fields ? 'email' then p_fields->>'email' else v_contact.email end,'')),'') is null then
      raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
    end if;
    update public.orkto_contacts set
      customer_id=v_customer_id,
      full_name=case when p_fields ? 'full_name' then btrim(p_fields->>'full_name') else full_name end,
      phone=case when p_fields ? 'phone' then nullif(btrim(p_fields->>'phone'),'') else phone end,
      email=case when p_fields ? 'email' then nullif(btrim(p_fields->>'email'),'') else email end,
      company=case when p_fields ? 'company' then p_fields->>'company' else company end,
      role=case when p_fields ? 'role' then p_fields->>'role' else role end,
      updated_at=now()
    where id=p_contact_id and workspace_id=p_workspace_id
    returning * into v_contact;
  end if;

  update public.orkto_wia_events set entity_ref=v_contact.id::text where id=v_event_id;
  insert into public.orkto_audit_log
    (user_id,workspace_id,event_type,actor_type,actor_id,trace_id,event_data)
  values
    (p_actor_user_id,p_workspace_id,
     case when p_command='CREATE_CONTACT' then 'contact.created' else 'contact.updated' end,
     'human',p_actor_user_id::text,p_request_id::text,
     jsonb_build_object('entity_type','contact','entity_id',v_contact.id,'result','succeeded',
                        'event_id',v_event_id));
  return jsonb_build_object('result',case when p_command='CREATE_CONTACT' then 'CREATED' else 'UPDATED' end,
                            'contact',to_jsonb(v_contact));
end;
$$;

revoke all on function public.orkto_contact_command(uuid,uuid,text,uuid,text,text,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.orkto_contact_command(uuid,uuid,text,uuid,text,text,uuid,jsonb)
  to service_role;
