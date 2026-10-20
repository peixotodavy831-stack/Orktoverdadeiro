-- Personal profile command: actor is resolved by the authenticated Edge gateway.
-- No table grants, identity changes or workspace/role updates are introduced.
create or replace function public.orkto_update_self_profile_command(
  p_actor_user_id uuid, p_workspace_id uuid, p_idempotency_key text,
  p_request_id uuid, p_fingerprint text, p_display_name text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_prior public.orkto_wia_events%rowtype;
  v_name text;
  v_key text := 'core:update_self_profile:' || p_actor_user_id::text || ':' || p_idempotency_key;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_request_id is null
     or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$'
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_display_name is null or length(btrim(p_display_name)) not between 1 and 100
     or p_display_name ~ '[[:cntrl:]]' then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;
  -- Check membership again inside the transaction; caller cannot target another profile.
  if not exists (select 1 from public.orkto_workspace_members m
    join public.orkto_workspaces w on w.id=m.workspace_id
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id
      and m.status='active' and m.role in ('owner','admin','manager','member')) then
    raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001';
  end if;
  perform 1 from public.profiles where id=p_actor_user_id for update;
  if not found then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,idempotency_key,payload)
  values (p_workspace_id,p_actor_user_id,'profile.personal_updated','user','profile',
    p_actor_user_id::text,v_key,jsonb_build_object('request_id',p_request_id,
      'fingerprint',p_fingerprint,'result','updated','changed_fields',jsonb_build_array('display_name')))
  on conflict(workspace_id,idempotency_key) do nothing returning id into v_event_id;
  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events where workspace_id=p_workspace_id and idempotency_key=v_key;
    if v_prior.id is null or v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.event_type <> 'profile.personal_updated'
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    select display_name into v_name from public.profiles where id=p_actor_user_id;
    return jsonb_build_object('result','REPLAY','profile',jsonb_build_object('id',p_actor_user_id,'display_name',v_name));
  end if;
  update public.profiles set display_name=btrim(p_display_name) where id=p_actor_user_id returning display_name into v_name;
  return jsonb_build_object('result','UPDATED','profile',jsonb_build_object('id',p_actor_user_id,'display_name',v_name));
end;
$$;
revoke all on function public.orkto_update_self_profile_command(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.orkto_update_self_profile_command(uuid,uuid,text,uuid,text,text) to service_role;
