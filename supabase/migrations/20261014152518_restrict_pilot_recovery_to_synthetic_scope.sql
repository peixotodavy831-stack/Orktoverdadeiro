-- Forward correction: no checkpoint was created by migration 42's original
-- routine. Never capture unverified accounts or unrelated global/public rows.
do $$ begin
  if exists(select 1 from orkto_pilot_private.recovery_checkpoints) then
    raise exception 'EXISTING_CHECKPOINT_REQUIRES_REVIEW';
  end if;
end $$;
alter table orkto_pilot_private.recovery_rows add column scope_column name not null;

create function orkto_pilot_private.recovery_scope_column(p_schema text,p_table text)
returns name language plpgsql stable security invoker set search_path='' as $$
declare v_col name;
begin
  if (p_schema,p_table) in (('auth','users'),('public','profiles')) then return 'id'; end if;
  if p_schema='auth' and p_table='identities' then return 'user_id'; end if;
  if p_schema<>'public' then return null; end if;
  select a.attname into v_col from pg_attribute a join pg_class c on c.oid=a.attrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname=p_schema and c.relname=p_table and a.attnum>0 and not a.attisdropped
      and a.attname in ('workspace_id','user_id','owner_user_id')
    order by case a.attname when 'workspace_id' then 1 when 'user_id' then 2 else 3 end limit 1;
  return v_col;
end;
$$;
revoke all on function orkto_pilot_private.recovery_scope_column(text,text)
  from public,anon,authenticated,service_role,supabase_auth_admin;

-- Detect any FK side effect on a row outside the proven synthetic ownership.
-- Refuse cleanup instead of capturing or changing that other account's data.
create function orkto_pilot_private.assert_recovery_dependencies(p_ids uuid[]) returns void
language plpgsql security invoker set search_path='' as $$
declare f record; v_child name; v_parent name; v_join text; v_bad boolean;
begin
  for f in select k.*,cn.nspname child_schema,cc.relname child_table,
    pn.nspname parent_schema,pc.relname parent_table
    from pg_constraint k join pg_class cc on cc.oid=k.conrelid join pg_namespace cn on cn.oid=cc.relnamespace
    join pg_class pc on pc.oid=k.confrelid join pg_namespace pn on pn.oid=pc.relnamespace
    where k.contype='f' and cn.nspname='public' and pn.nspname in ('public','auth') loop
    v_child:=orkto_pilot_private.recovery_scope_column(f.child_schema,f.child_table);
    v_parent:=orkto_pilot_private.recovery_scope_column(f.parent_schema,f.parent_table);
    if v_parent is null then continue; end if;
    select string_agg(format('c.%I=p.%I',ca.attname,pa.attname),' and ') into v_join
      from unnest(f.conkey,f.confkey) as a(child_col,parent_col)
      join pg_attribute ca on ca.attrelid=f.conrelid and ca.attnum=a.child_col
      join pg_attribute pa on pa.attrelid=f.confrelid and pa.attnum=a.parent_col;
    execute format('select exists(select 1 from %I.%I c join %I.%I p on %s where p.%I::text=any(select unnest($1)::text) and not coalesce(%s,false))',
      f.child_schema,f.child_table,f.parent_schema,f.parent_table,v_join,v_parent,
      case when v_child is null then 'false' else format('c.%I::text=any(select unnest($1)::text)',v_child) end)
      into v_bad using p_ids;
    if v_bad then raise exception 'NON_SYNTHETIC_DEPENDENCY_FOUND'; end if;
  end loop;
end;
$$;
revoke all on function orkto_pilot_private.assert_recovery_dependencies(uuid[])
  from public,anon,authenticated,service_role,supabase_auth_admin;

create or replace function orkto_pilot_private.capture_recovery_checkpoint() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_ids uuid[]; v_run uuid; t record; v_rows jsonb; v_restored jsonb; v_digest text; v_n int:=0; v_col name;
begin
  if orkto_pilot_private.is_enabled() then raise exception 'CHECKPOINT_REQUIRES_PREFLIGHT'; end if;
  select array_agg(id order by id) into v_ids from auth.users
    where email ~ '^orkto-readiness-[ab]-[a-z0-9-]+@example[.]invalid$'
       or (raw_user_meta_data->>'synthetic'='true' and raw_user_meta_data ? 'orkto_fixture');
  if coalesce(cardinality(v_ids),0)<>18 then raise exception 'SYNTHETIC_INVENTORY_CHANGED'; end if;
  if exists(select 1 from public.orkto_workspace_members m join public.orkto_workspaces w on w.id=m.workspace_id
    where w.owner_user_id=any(v_ids) and not(m.user_id=any(v_ids))) then
    raise exception 'NON_SYNTHETIC_DEPENDENCY_FOUND';
  end if;
  perform orkto_pilot_private.assert_recovery_dependencies(v_ids);
  insert into orkto_pilot_private.recovery_checkpoints(synthetic_ids) values(v_ids) returning id into v_run;
  for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and (n.nspname='public' or (n.nspname='auth' and c.relname in ('users','identities'))) loop
    v_col:=orkto_pilot_private.recovery_scope_column(t.nspname,t.relname);
    if v_col is null then continue; end if;
    execute format('select coalesce(jsonb_agg(row_data order by row_data::text),''[]''::jsonb) from (select to_jsonb(x) row_data from %I.%I x where %I::text=any(select unnest($1)::text)) q',t.nspname,t.relname,v_col) into v_rows using v_ids;
    if pg_column_size(v_rows)>10000000 then raise exception 'CHECKPOINT_SIZE_REVIEW_REQUIRED'; end if;
    v_digest:=encode(pg_catalog.sha256(convert_to(v_rows::text,'UTF8')),'hex');
    insert into orkto_pilot_private.recovery_rows values(v_run,t.nspname,t.relname,v_rows,jsonb_array_length(v_rows),v_digest,v_col);
    -- Typed round-trip, not a full disaster restore or FK/trigger rehearsal.
    execute format('create temporary table orkto_restore_roundtrip on commit drop as table %I.%I with no data',t.nspname,t.relname);
    execute 'insert into pg_temp.orkto_restore_roundtrip select * from jsonb_populate_recordset(null::pg_temp.orkto_restore_roundtrip,$1)' using v_rows;
    execute 'select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb) from pg_temp.orkto_restore_roundtrip x' into v_restored;
    if v_rows is distinct from v_restored then raise exception 'CHECKPOINT_ROUNDTRIP_FAILED'; end if;
    drop table pg_temp.orkto_restore_roundtrip;
    v_n:=v_n+1;
  end loop;
  update orkto_pilot_private.recovery_checkpoints set verified=true where id=v_run;
  return jsonb_build_object('checkpoint_id',v_run,'synthetic_users',cardinality(v_ids),'tables',v_n,
    'typed_roundtrip','PASS','full_disaster_restore','NOT_RUN','storage','SAME_PROJECT_PRIVATE',
    'manifest_sha256',(select encode(pg_catalog.sha256(convert_to(string_agg(table_schema||'.'||table_name||':'||sha256,E'\n' order by table_schema,table_name),'UTF8')),'hex')
      from orkto_pilot_private.recovery_rows where checkpoint_id=v_run));
end;
$$;

create or replace function orkto_pilot_private.cleanup_verified_synthetic(p_checkpoint uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_ids uuid[]; v_count int; v_before int; t record; v_rows jsonb;
begin
  select synthetic_ids into v_ids from orkto_pilot_private.recovery_checkpoints
    where id=p_checkpoint and verified for update;
  if coalesce(cardinality(v_ids),0)<>18 then raise exception 'VERIFIED_CHECKPOINT_REQUIRED'; end if;
  lock table auth.users in share row exclusive mode;
  if (select count(*) from auth.users where id=any(v_ids) and
    (email ~ '^orkto-readiness-[ab]-[a-z0-9-]+@example[.]invalid$'
      or (raw_user_meta_data->>'synthetic'='true' and raw_user_meta_data ? 'orkto_fixture')))<>18 then
    raise exception 'SYNTHETIC_INVENTORY_CHANGED';
  end if;
  -- Refuse any drift after the checkpoint. Locks are held to transaction end.
  for t in select * from orkto_pilot_private.recovery_rows where checkpoint_id=p_checkpoint
    order by table_schema,table_name loop
    execute format('lock table %I.%I in share row exclusive mode',t.table_schema,t.table_name);
    execute format('select coalesce(jsonb_agg(row_data order by row_data::text),''[]''::jsonb) from (select to_jsonb(x) row_data from %I.%I x where %I::text=any(select unnest($1)::text)) q',t.table_schema,t.table_name,t.scope_column) into v_rows using v_ids;
    if encode(pg_catalog.sha256(convert_to(v_rows::text,'UTF8')),'hex')<>t.sha256 then
      raise exception 'CHECKPOINT_DRIFT';
    end if;
  end loop;
  perform orkto_pilot_private.assert_recovery_dependencies(v_ids);
  select count(*) into v_before from auth.users;
  delete from auth.refresh_tokens where user_id=any(select unnest(v_ids)::text);
  delete from auth.sessions where user_id=any(v_ids);
  -- FK/retention/immutability triggers stay enabled; any denial rolls back ALL.
  delete from auth.users where id=any(v_ids);
  get diagnostics v_count=row_count;
  if v_count<>18 or (select count(*) from auth.users)<>v_before-18 then
    raise exception 'CLEANUP_COUNT_MISMATCH';
  end if;
  insert into orkto_pilot_private.audit(actor,action) values('staging-maintenance','SYNTHETIC_CLEANUP_18');
  return jsonb_build_object('deleted_users',v_count,'preserved_users',v_before-v_count,
    'checkpoint_id',p_checkpoint,'sessions_retained',0,'constraints_bypassed',false);
end;
$$;
