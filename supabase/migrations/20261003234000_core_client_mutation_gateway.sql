-- A narrow service-only transaction. The Edge Function authenticates the JWT;
-- this function independently checks active membership and never grants browser writes.
create or replace function public.orkto_create_client_command(
  p_actor_user_id uuid,
  p_workspace_id uuid,
  p_idempotency_key text,
  p_request_id uuid,
  p_fingerprint text,
  p_name text,
  p_phone text,
  p_company text,
  p_vehicle_or_service text,
  p_notes text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
  v_event_id uuid;
  v_prior public.orkto_wia_events%rowtype;
  v_client public.clients%rowtype;
  v_key text := 'core:create_client:' || p_idempotency_key;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_request_id is null
     or p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 128
     or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_name is null or length(btrim(p_name)) not between 1 and 200
     or p_phone is null or length(btrim(p_phone)) not between 3 and 80
     or length(coalesce(p_company,'')) > 200
     or length(coalesce(p_vehicle_or_service,'')) > 240
     or length(coalesce(p_notes,'')) > 4000 then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  select w.owner_user_id into v_owner
  from public.orkto_workspace_members m
  join public.orkto_workspaces w on w.id = m.workspace_id
  where m.workspace_id = p_workspace_id and m.user_id = p_actor_user_id
    and m.status = 'active' and m.role in ('owner','admin','manager','member')
  for share of m, w;
  if v_owner is null then
    raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode = 'P0001';
  end if;

  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,idempotency_key,payload)
  values
    (p_workspace_id,p_actor_user_id,'client.created','user','client',v_key,
     jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint,'result','created'))
  on conflict (workspace_id,idempotency_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events
    where workspace_id = p_workspace_id and idempotency_key = v_key;
    if v_prior.id is null or v_prior.event_type <> 'client.created'
       or v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    select * into v_client from public.clients
    where id = v_prior.entity_ref::uuid and workspace_id = p_workspace_id;
    if v_client.id is null then
      raise exception 'ORKTO_INTERNAL_ERROR' using errcode = 'P0001';
    end if;
    return jsonb_build_object('result','REPLAY','client',to_jsonb(v_client));
  end if;

  insert into public.clients
    (user_id,workspace_id,name,phone,company,vehicle_or_service,notes)
  values
    (v_owner,p_workspace_id,btrim(p_name),btrim(p_phone),p_company,p_vehicle_or_service,p_notes)
  returning * into v_client;

  update public.orkto_wia_events
  set entity_ref = v_client.id::text
  where id = v_event_id;

  return jsonb_build_object('result','CREATED','client',to_jsonb(v_client));
end;
$$;

revoke all on function public.orkto_create_client_command(uuid,uuid,text,uuid,text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.orkto_create_client_command(uuid,uuid,text,uuid,text,text,text,text,text,text)
  to service_role;
