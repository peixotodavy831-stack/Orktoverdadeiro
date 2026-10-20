-- Disabled by default. Activate only in audited staging after recovery checkpoint.
-- No password/role/email supplied by the browser can approve an admission.
create schema if not exists orkto_pilot_private;
revoke all on schema orkto_pilot_private from public, anon, authenticated;
create table orkto_pilot_private.configuration (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into orkto_pilot_private.configuration values (true,false);
create table orkto_pilot_private.admissions (
  id uuid primary key default gen_random_uuid(),
  email_sha256 text not null unique check (email_sha256 ~ '^[0-9a-f]{64}$'),
  user_id uuid unique,
  google_subject text unique,
  workspace_id uuid references public.orkto_workspaces(id),
  create_workspace boolean not null default false,
  member_role text not null check (member_role in ('owner','admin','manager','member')),
  active boolean not null default true,
  expires_at timestamptz not null,
  approved_by text not null check (length(approved_by) between 3 and 160),
  created_at timestamptz not null default now(),
  check ((create_workspace and member_role='owner' and workspace_id is null)
      or (not create_workspace and member_role<>'owner' and workspace_id is not null))
);
create table orkto_pilot_private.audit (
  id bigint generated always as identity primary key,
  admission_id uuid, actor text not null, action text not null,
  occurred_at timestamptz not null default now()
);
alter table orkto_pilot_private.configuration enable row level security;
alter table orkto_pilot_private.admissions enable row level security;
alter table orkto_pilot_private.audit enable row level security;
revoke all on all tables in schema orkto_pilot_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema orkto_pilot_private from public,anon,authenticated,service_role;

create function orkto_pilot_private.is_enabled() returns boolean
language sql stable security definer set search_path='' as $$
  select enabled from orkto_pilot_private.configuration where singleton;
$$;

-- One audited identity must be bound to a still-active admission. No metadata role.
create function orkto_pilot_private.identity_allowed(p_user uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
  return exists(select 1 from orkto_pilot_private.admissions a
    join auth.users u on u.id=a.user_id
    join auth.identities i on i.user_id=u.id and i.provider='google' and i.provider_id=a.google_subject
    where a.user_id=p_user and a.active and a.expires_at>now()
      and coalesce(u.encrypted_password,'')=''
      and a.email_sha256=encode(pg_catalog.sha256(convert_to(lower(btrim(u.email)),'UTF8')),'hex'));
end;
$$;

create function public.orkto_pilot_session_allowed() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare v_claims jsonb; v_session uuid;
begin
  if not orkto_pilot_private.is_enabled() then return true; end if;
  if auth.uid() is null or not orkto_pilot_private.identity_allowed(auth.uid()) then return false; end if;
  v_claims := auth.jwt();
  if not coalesce(v_claims->'amr' @> '[{"method":"oauth"}]'::jsonb,false) then return false; end if;
  begin v_session := (v_claims->>'session_id')::uuid;
  exception when invalid_text_representation then return false; end;
  return exists(select 1 from auth.sessions s where s.id=v_session and s.user_id=auth.uid()
    and (s.not_after is null or s.not_after>now()));
end;
$$;
revoke all on function public.orkto_pilot_session_allowed() from public,anon;
grant execute on function public.orkto_pilot_session_allowed() to authenticated,service_role;

create function orkto_pilot_private.guard_auth_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not orkto_pilot_private.is_enabled() then return new; end if;
  if coalesce(new.encrypted_password,'')<>'' then
    raise exception 'ORKTO_GOOGLE_ONLY' using errcode='42501';
  end if;
  if tg_op='INSERT' then
    if coalesce(new.raw_app_meta_data->>'provider','')<>'google'
      or not exists(select 1 from orkto_pilot_private.admissions a
        where a.email_sha256=encode(pg_catalog.sha256(convert_to(lower(btrim(new.email)),'UTF8')),'hex')
          and a.active and a.expires_at>now() and (a.user_id is null or a.user_id=new.id)) then
      raise exception 'ORKTO_PILOT_ACCESS_DENIED' using errcode='42501';
    end if;
  elsif new.email is distinct from old.email or coalesce(new.email_change,'')<>'' then
    raise exception 'ORKTO_PILOT_IDENTITY_CHANGE_DENIED' using errcode='42501';
  end if;
  return new;
end;
$$;
create trigger orkto_pilot_guard_auth_user before insert or update on auth.users
for each row execute function orkto_pilot_private.guard_auth_user();

create function orkto_pilot_private.guard_identity() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_admission orkto_pilot_private.admissions%rowtype;
begin
  if not orkto_pilot_private.is_enabled() then return new; end if;
  if new.provider<>'google' then raise exception 'ORKTO_GOOGLE_ONLY' using errcode='42501'; end if;
  select * into v_admission from orkto_pilot_private.admissions
    where user_id=new.user_id and active and expires_at>now() for update;
  if not found or (v_admission.google_subject is not null and v_admission.google_subject<>new.provider_id)
    or (tg_op='UPDATE' and (new.user_id<>old.user_id or new.provider_id<>old.provider_id)) then
    raise exception 'ORKTO_PILOT_IDENTITY_LINK_DENIED' using errcode='42501';
  end if;
  if v_admission.google_subject is null then
    update orkto_pilot_private.admissions set google_subject=new.provider_id where id=v_admission.id;
  end if;
  return new;
end;
$$;
create trigger orkto_pilot_guard_identity before insert or update on auth.identities
for each row execute function orkto_pilot_private.guard_identity();

create or replace function public.orkto_provision_workspace_for_profile()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_admission orkto_pilot_private.admissions%rowtype;
begin
  if orkto_pilot_private.is_enabled() then
    select * into v_admission from orkto_pilot_private.admissions a
      where a.email_sha256=encode(pg_catalog.sha256(convert_to(lower(btrim(new.email)),'UTF8')),'hex')
        and a.active and a.expires_at>now() and (a.user_id is null or a.user_id=new.id) for update;
    if not found then raise exception 'ORKTO_PILOT_ACCESS_DENIED' using errcode='42501'; end if;
    update orkto_pilot_private.admissions set user_id=new.id where id=v_admission.id;
    if v_admission.create_workspace then
      insert into public.orkto_workspaces(id,owner_user_id,name) values(new.id,new.id,'Minha empresa');
      insert into public.orkto_workspace_members(workspace_id,user_id,role,status,joined_at)
        values(new.id,new.id,'owner','active',now());
    else
      insert into public.orkto_workspace_members(workspace_id,user_id,role,status,joined_at)
        values(v_admission.workspace_id,new.id,v_admission.member_role,'active',now());
    end if;
    insert into orkto_pilot_private.audit(admission_id,actor,action)
      values(v_admission.id,'auth','ADMISSION_BOUND');
    return new;
  end if;
  insert into public.orkto_workspaces(id,owner_user_id,name)
    values(new.id,new.id,coalesce(nullif(new.company_name,''),nullif(new.display_name,''),'Minha empresa')) on conflict(id) do nothing;
  insert into public.orkto_workspace_members(workspace_id,user_id,role,status,joined_at)
    values(new.id,new.id,'owner','active',now()) on conflict(workspace_id,user_id) do nothing;
  return new;
end;
$$;

-- An allowlist removal denies already-issued JWTs through RLS and Edge, and
-- removes refreshable sessions. Audit stores no email, password or token.
create function orkto_pilot_private.audit_admission() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into orkto_pilot_private.audit(admission_id,actor,action)
    values(coalesce(new.id,old.id),session_user,
      case when tg_op='DELETE' then 'ADMISSION_REMOVED' when tg_op='INSERT' then 'ADMISSION_APPROVED' else 'ADMISSION_CHANGED' end);
  if tg_op='DELETE' or not new.active then
    delete from auth.refresh_tokens where user_id=coalesce(old.user_id,new.user_id)::text;
    delete from auth.sessions where user_id=coalesce(old.user_id,new.user_id);
  end if;
  return coalesce(new,old);
end;
$$;
create trigger orkto_pilot_audit_admission after insert or update or delete
on orkto_pilot_private.admissions for each row execute function orkto_pilot_private.audit_admission();

-- Hooks are optional defense in depth on top of database triggers; activation
-- requires configuring both in Auth. These never trust editable user_metadata.
create function orkto_pilot_private.before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not orkto_pilot_private.is_enabled() then return '{}'::jsonb; end if;
  if coalesce(event#>>'{user,app_metadata,provider}','')='google' and exists(
    select 1 from orkto_pilot_private.admissions a where a.active and a.expires_at>now()
    and a.user_id is null and a.email_sha256=encode(pg_catalog.sha256(convert_to(lower(btrim(event#>>'{user,email}')),'UTF8')),'hex')
  ) then return '{}'::jsonb; end if;
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','PILOT_ACCESS_DENIED'));
end;
$$;
create function orkto_pilot_private.access_token_hook(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not orkto_pilot_private.is_enabled() then return jsonb_build_object('claims',event->'claims'); end if;
  if coalesce(event->>'authentication_method','') not in ('oauth','token_refresh')
    or not coalesce(event#>'{claims,amr}' @> '[{"method":"oauth"}]'::jsonb,false)
    or not orkto_pilot_private.identity_allowed((event->>'user_id')::uuid) then
    return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','PILOT_ACCESS_DENIED'));
  end if;
  return jsonb_build_object('claims',event->'claims');
end;
$$;
revoke all on all functions in schema orkto_pilot_private from public,anon,authenticated,service_role;
grant usage on schema orkto_pilot_private to supabase_auth_admin;
grant execute on function orkto_pilot_private.before_user_created(jsonb),
  orkto_pilot_private.access_token_hook(jsonb) to supabase_auth_admin;

-- Restrictive predicates never grant SELECT or DML by themselves. Existing
-- tenant policies and grants remain required, including profile/legacy paths.
do $$ declare t record; begin
  for t in select c.relname,n.nspname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where (n.nspname='public' or (n.nspname='storage' and c.relname='objects'))
      and c.relkind='r' and c.relrowsecurity loop
    execute format('create policy orkto_pilot_session_gate on %I.%I as restrictive for all to authenticated using ((select public.orkto_pilot_session_allowed())) with check ((select public.orkto_pilot_session_allowed()))',t.nspname,t.relname);
  end loop;
end $$;
create or replace function public.orkto_is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.orkto_pilot_session_allowed() and exists(select 1 from public.orkto_workspace_members m
    where m.workspace_id=target_workspace and m.user_id=auth.uid() and m.status='active');
$$;
create or replace function public.orkto_is_workspace_admin(target_workspace uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.orkto_pilot_session_allowed() and exists(select 1 from public.orkto_workspace_members m
    where m.workspace_id=target_workspace and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin'));
$$;
-- Same-project logical recovery checkpoint, exclusively postgres-controlled.
-- Never contains live sessions/refresh tokens. No credential-bearing payload is returned.
create table orkto_pilot_private.recovery_checkpoints (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  synthetic_ids uuid[] not null, verified boolean not null default false
);
create table orkto_pilot_private.recovery_rows (
  checkpoint_id uuid references orkto_pilot_private.recovery_checkpoints(id),
  table_schema text, table_name text, payload jsonb not null,
  row_count bigint not null, sha256 text not null,
  primary key(checkpoint_id,table_schema,table_name)
);
alter table orkto_pilot_private.recovery_checkpoints enable row level security;
alter table orkto_pilot_private.recovery_rows enable row level security;
revoke all on orkto_pilot_private.recovery_checkpoints,orkto_pilot_private.recovery_rows
  from public,anon,authenticated,service_role,supabase_auth_admin;

create function orkto_pilot_private.capture_recovery_checkpoint() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_ids uuid[]; v_run uuid; t record; v_rows jsonb; v_restored jsonb; v_digest text; v_n int:=0;
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
  insert into orkto_pilot_private.recovery_checkpoints(synthetic_ids) values(v_ids) returning id into v_run;
  for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and (n.nspname='public' or (n.nspname='auth' and c.relname in ('users','identities'))) loop
    execute format('select coalesce(jsonb_agg(row_data order by row_data::text),''[]''::jsonb) from (select to_jsonb(x) row_data from %I.%I x %s) q',
      t.nspname,t.relname,case when t.nspname='auth' then
        case when t.relname='users' then 'where id=any($1)' else 'where user_id=any($1)' end else '' end)
      into v_rows using v_ids;
    if pg_column_size(v_rows)>10000000 then raise exception 'CHECKPOINT_SIZE_REVIEW_REQUIRED'; end if;
    v_digest:=encode(pg_catalog.sha256(convert_to(v_rows::text,'UTF8')),'hex');
    insert into orkto_pilot_private.recovery_rows values(v_run,t.nspname,t.relname,v_rows,jsonb_array_length(v_rows),v_digest);
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
revoke all on function orkto_pilot_private.capture_recovery_checkpoint()
  from public,anon,authenticated,service_role,supabase_auth_admin;

create function orkto_pilot_private.cleanup_verified_synthetic(p_checkpoint uuid) returns jsonb
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
    execute format('select coalesce(jsonb_agg(row_data order by row_data::text),''[]''::jsonb) from (select to_jsonb(x) row_data from %I.%I x %s) q',
      t.table_schema,t.table_name,case when t.table_schema='auth' then
        case when t.table_name='users' then 'where id=any($1)' else 'where user_id=any($1)' end else '' end)
      into v_rows using v_ids;
    if encode(pg_catalog.sha256(convert_to(v_rows::text,'UTF8')),'hex')<>t.sha256 then
      raise exception 'CHECKPOINT_DRIFT';
    end if;
  end loop;
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
revoke all on function orkto_pilot_private.cleanup_verified_synthetic(uuid)
  from public,anon,authenticated,service_role,supabase_auth_admin;
notify pgrst,'reload schema';
