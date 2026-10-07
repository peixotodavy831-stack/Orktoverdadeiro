-- Catalog-specific transaction; only the Edge runtime's service role may invoke it.
create or replace function public.orkto_catalog_item_command(
  p_actor_user_id uuid, p_workspace_id uuid, p_command text, p_service_id uuid,
  p_idempotency_key text, p_request_id uuid, p_fingerprint text, p_fields jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_role text;
  v_event_id uuid;
  v_prior public.orkto_wia_events%rowtype;
  v_service public.services%rowtype;
  v_event_type text;
  v_key text;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_request_id is null
     or p_command is null or p_command not in ('CREATE_CATALOG_ITEM','UPDATE_CATALOG_ITEM','ARCHIVE_CATALOG_ITEM')
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 128
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_fields) is distinct from 'object'
     or exists(select 1 from jsonb_object_keys(p_fields) k where k not in ('name','description','unit_price','category'))
     or (p_fields ? 'name' and (jsonb_typeof(p_fields->'name') <> 'string' or length(btrim(p_fields->>'name')) not between 1 and 200))
     or (p_fields ? 'category' and (jsonb_typeof(p_fields->'category') <> 'string' or length(btrim(p_fields->>'category')) not between 1 and 120))
     or (p_fields ? 'description' and (jsonb_typeof(p_fields->'description') not in ('string','null') or length(coalesce(p_fields->>'description','')) > 2000))
     or (p_fields ? 'unit_price' and (jsonb_typeof(p_fields->'unit_price') <> 'number' or (p_fields->>'unit_price')::numeric not between 0 and 100000000))
     or (p_command = 'CREATE_CATALOG_ITEM' and (p_service_id is not null or not (p_fields ?& array['name','unit_price','category'])))
     or (p_command = 'UPDATE_CATALOG_ITEM' and (p_service_id is null or p_fields = '{}'::jsonb))
     or (p_command = 'ARCHIVE_CATALOG_ITEM' and (p_service_id is null or p_fields <> '{}'::jsonb)) then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;

  select w.owner_user_id,m.role into v_owner,v_role
  from public.orkto_workspace_members m
  join public.orkto_workspaces w on w.id=m.workspace_id
  where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id and m.status='active'
    and m.role in ('owner','admin','manager','member')
  for share of m,w;
  if v_owner is null then raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001'; end if;
  if p_command='ARCHIVE_CATALOG_ITEM' and v_role not in ('owner','admin') then
    raise exception 'ORKTO_PERMISSION_DENIED' using errcode='P0001';
  end if;

  v_event_type := case p_command when 'CREATE_CATALOG_ITEM' then 'catalog_item.created'
                    when 'UPDATE_CATALOG_ITEM' then 'catalog_item.updated' else 'catalog_item.archived' end;
  v_key := 'core:' || lower(p_command) || ':' || p_idempotency_key;
  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,idempotency_key,payload)
  values (p_workspace_id,p_actor_user_id,v_event_type,'user','service',v_key,
          jsonb_build_object('request_id',p_request_id,'fingerprint',p_fingerprint,'changed_fields',(select jsonb_agg(k) from jsonb_object_keys(p_fields) k)))
  on conflict (workspace_id,idempotency_key) do nothing returning id into v_event_id;
  if v_event_id is null then
    select * into v_prior from public.orkto_wia_events where workspace_id=p_workspace_id and idempotency_key=v_key;
    if v_prior.id is null or v_prior.event_type <> v_event_type
       or v_prior.actor_user_id is distinct from p_actor_user_id
       or v_prior.payload->>'fingerprint' is distinct from p_fingerprint
       or (p_service_id is not null and v_prior.entity_ref is distinct from p_service_id::text) then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    if p_command='ARCHIVE_CATALOG_ITEM' then
      return jsonb_build_object('result','REPLAY','service_id',p_service_id);
    end if;
    select * into v_service from public.services where id=v_prior.entity_ref::uuid and workspace_id=p_workspace_id;
    if v_service.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
    return jsonb_build_object('result','REPLAY','service',to_jsonb(v_service));
  end if;

  if p_command='CREATE_CATALOG_ITEM' then
    insert into public.services(user_id,workspace_id,name,description,unit_price,category)
    values(v_owner,p_workspace_id,btrim(p_fields->>'name'),p_fields->>'description',(p_fields->>'unit_price')::numeric,btrim(p_fields->>'category'))
    returning * into v_service;
  elsif p_command='UPDATE_CATALOG_ITEM' then
    update public.services set
      name=case when p_fields ? 'name' then btrim(p_fields->>'name') else name end,
      description=case when p_fields ? 'description' then p_fields->>'description' else description end,
      unit_price=case when p_fields ? 'unit_price' then (p_fields->>'unit_price')::numeric else unit_price end,
      category=case when p_fields ? 'category' then btrim(p_fields->>'category') else category end,
      updated_at=now()
    where id=p_service_id and workspace_id=p_workspace_id and archived_at is null
    returning * into v_service;
  else
    update public.services set archived_at=now(),updated_at=now()
    where id=p_service_id and workspace_id=p_workspace_id and archived_at is null
    returning * into v_service;
  end if;
  if v_service.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
  update public.orkto_wia_events set entity_ref=v_service.id::text where id=v_event_id;
  if p_command='ARCHIVE_CATALOG_ITEM' then
    return jsonb_build_object('result','ARCHIVED','service_id',v_service.id);
  end if;
  return jsonb_build_object('result',case when p_command='CREATE_CATALOG_ITEM' then 'CREATED' else 'UPDATED' end,'service',to_jsonb(v_service));
end;
$$;

revoke all on function public.orkto_catalog_item_command(uuid,uuid,text,uuid,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.orkto_catalog_item_command(uuid,uuid,text,uuid,text,uuid,text,jsonb) to service_role;
