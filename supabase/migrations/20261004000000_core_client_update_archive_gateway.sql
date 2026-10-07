create or replace function public.orkto_update_client_command(
  p_actor_user_id uuid, p_workspace_id uuid, p_client_id uuid,
  p_idempotency_key text, p_request_id uuid, p_fingerprint text, p_changes jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_prior public.orkto_wia_events%rowtype;
  v_client public.clients%rowtype;
  v_key text := 'core:update_client:' || p_idempotency_key;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_client_id is null or p_request_id is null
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_changes) is distinct from 'object' or p_changes = '{}'::jsonb
     or exists (select 1 from jsonb_object_keys(p_changes) k where k not in ('name','phone','company','vehicle_or_service','notes'))
     or (p_changes ? 'name' and (jsonb_typeof(p_changes->'name') <> 'string' or length(btrim(p_changes->>'name')) not between 1 and 200))
     or (p_changes ? 'phone' and (jsonb_typeof(p_changes->'phone') <> 'string' or length(btrim(p_changes->>'phone')) not between 3 and 80))
     or (p_changes ? 'company' and (jsonb_typeof(p_changes->'company') not in ('string','null') or length(coalesce(p_changes->>'company','')) > 200))
     or (p_changes ? 'vehicle_or_service' and (jsonb_typeof(p_changes->'vehicle_or_service') not in ('string','null') or length(coalesce(p_changes->>'vehicle_or_service','')) > 240))
     or (p_changes ? 'notes' and (jsonb_typeof(p_changes->'notes') not in ('string','null') or length(coalesce(p_changes->>'notes','')) > 4000)) then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;
  if not exists (select 1 from public.orkto_workspace_members m
                 where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id
                   and m.status='active' and m.role in ('owner','admin','manager','member')) then
    raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001';
  end if;
  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,idempotency_key,payload)
  values (p_workspace_id,p_actor_user_id,'client.updated','user','client',v_key,
          jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint,'changed_fields',(select jsonb_agg(k) from jsonb_object_keys(p_changes) k)))
  on conflict (workspace_id,idempotency_key) do nothing returning id into v_event_id;
  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events where workspace_id=p_workspace_id and idempotency_key=v_key;
    if v_prior.id is null or v_prior.event_type <> 'client.updated'
       or v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    select * into v_client from public.clients where id=p_client_id and workspace_id=p_workspace_id and archived_at is null;
    if v_client.id is null or v_prior.entity_ref is distinct from p_client_id::text then
      raise exception 'ORKTO_NOT_FOUND' using errcode='P0001';
    end if;
    return jsonb_build_object('result','REPLAY','client',to_jsonb(v_client));
  end if;
  update public.clients set
    name=case when p_changes ? 'name' then btrim(p_changes->>'name') else name end,
    phone=case when p_changes ? 'phone' then btrim(p_changes->>'phone') else phone end,
    company=case when p_changes ? 'company' then p_changes->>'company' else company end,
    vehicle_or_service=case when p_changes ? 'vehicle_or_service' then p_changes->>'vehicle_or_service' else vehicle_or_service end,
    notes=case when p_changes ? 'notes' then p_changes->>'notes' else notes end,
    updated_at=now()
  where id=p_client_id and workspace_id=p_workspace_id and archived_at is null
  returning * into v_client;
  if v_client.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
  update public.orkto_wia_events set entity_ref=v_client.id::text where id=v_event_id;
  return jsonb_build_object('result','UPDATED','client',to_jsonb(v_client));
end;
$$;

revoke all on function public.orkto_update_client_command(uuid,uuid,uuid,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.orkto_update_client_command(uuid,uuid,uuid,text,uuid,text,jsonb) to service_role;

create or replace function public.orkto_archive_client_command(
  p_actor_user_id uuid, p_workspace_id uuid, p_client_id uuid,
  p_idempotency_key text, p_request_id uuid, p_fingerprint text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_prior public.orkto_wia_events%rowtype;
  v_client public.clients%rowtype;
  v_key text := 'core:archive_client:' || p_idempotency_key;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_client_id is null or p_request_id is null
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;
  if not exists (select 1 from public.orkto_workspace_members m
                 where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id
                   and m.status='active' and m.role in ('owner','admin')) then
    raise exception 'ORKTO_PERMISSION_DENIED' using errcode='P0001';
  end if;
  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,idempotency_key,payload)
  values (p_workspace_id,p_actor_user_id,'client.archived','user','client',v_key,
          jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint))
  on conflict (workspace_id,idempotency_key) do nothing returning id into v_event_id;
  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events where workspace_id=p_workspace_id and idempotency_key=v_key;
    if v_prior.id is null or v_prior.event_type <> 'client.archived'
       or v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    if v_prior.entity_ref is distinct from p_client_id::text then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
    return jsonb_build_object('result','REPLAY','client_id',p_client_id);
  end if;
  update public.clients set archived_at=now(),updated_at=now()
  where id=p_client_id and workspace_id=p_workspace_id and archived_at is null
  returning * into v_client;
  if v_client.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
  update public.orkto_wia_events set entity_ref=v_client.id::text where id=v_event_id;
  return jsonb_build_object('result','ARCHIVED','client_id',p_client_id);
end;
$$;

revoke all on function public.orkto_archive_client_command(uuid,uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.orkto_archive_client_command(uuid,uuid,uuid,text,uuid,text) to service_role;
