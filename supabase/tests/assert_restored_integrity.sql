-- Read-only checks after restoring an existing fixture snapshot: never recreate fixture rows.
begin;
do $$ declare fk record; predicate text; nonnull text; orphan boolean; begin
 for fk in select * from pg_constraint where contype='f' and connamespace='public'::regnamespace loop
  select string_agg(format('p.%I=c.%I',pa.attname,ca.attname),' and '),string_agg(format('c.%I is not null',ca.attname),' and ')
  into predicate,nonnull from unnest(fk.conkey,fk.confkey) keys(child,parent)
  join pg_attribute ca on ca.attrelid=fk.conrelid and ca.attnum=keys.child
  join pg_attribute pa on pa.attrelid=fk.confrelid and pa.attnum=keys.parent;
  execute format('select exists(select 1 from %s c where %s and not exists(select 1 from %s p where %s))',
   fk.conrelid::regclass,nonnull,fk.confrelid::regclass,predicate) into orphan;
  if orphan then raise exception 'RESTORE_ORPHAN: %',fk.conname; end if;
 end loop;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
 and c.relname like 'orkto\_%' escape '\' and c.relkind='r' and not c.relrowsecurity) then raise exception 'RESTORE_RLS_MISSING'; end if;
 if has_table_privilege('authenticated','public.orkto_billing_bindings','UPDATE') or has_table_privilege('anon','public.quotes','SELECT')
 or has_function_privilege('authenticated','public.orkto_reconcile_subscription(uuid,text,text,bigint,text,text,timestamptz,timestamptz,timestamptz)','EXECUTE') then raise exception 'RESTORE_PRIVILEGE_REGRESSION'; end if;
 if (select count(*) from public.orkto_plan_catalog where commercial_available)<>5 then raise exception 'RESTORE_CATALOG_MISMATCH'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$ begin
 if exists(select 1 from public.quotes where workspace_id<>'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 or exists(select 1 from public.orkto_workspace_members where workspace_id<>'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then raise exception 'RESTORE_TENANT_LEAK'; end if;
end $$;
rollback;
