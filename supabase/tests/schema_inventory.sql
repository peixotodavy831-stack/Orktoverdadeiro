-- Catalog-only schema inventory. Safe for a remote read-only connection.
-- Does not read table rows, secrets, sequence values, or customer content.
-- Function bodies are represented by a fingerprint so embedded literals are not exported.
-- Includes all non-system schemas; Supabase migration history is captured separately.
begin transaction read only;
select jsonb_build_object(
  'inventory_version', 2,
  'captured_at', now(),
  'server_version', current_setting('server_version'),
  'server_version_num', current_setting('server_version_num')::integer,
  'server_version_full', version(),
  'schemas', coalesce((
    select jsonb_agg(nspname order by nspname)
    from pg_namespace
    where nspname !~ '^pg_' and nspname not in ('information_schema','supabase_migrations')
  ), '[]'::jsonb),
  'tables', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'name', c.relname,
      'kind', c.relkind,
      'owner', pg_get_userbyid(c.relowner),
      'rls', c.relrowsecurity,
      'force_rls', c.relforcerowsecurity,
      'partitioned', c.relispartition,
      'definition_fingerprint_md5', case when c.relkind in ('v','m') then md5(pg_get_viewdef(c.oid, true)) else null end
    ) order by n.nspname, c.relname)
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname !~ '^pg_' and n.nspname not in ('information_schema','supabase_migrations')
      and c.relkind in ('r','p','v','m','f')
  ), '[]'::jsonb),
  'columns', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', table_schema,
      'table', table_name,
      'ordinal', ordinal_position,
      'name', column_name,
      'data_type', data_type,
      'udt_name', udt_name,
      'nullable', is_nullable,
      'default_defined', column_default is not null,
      'default_fingerprint_md5', case when column_default is null then null else md5(column_default) end,
      'generated', is_generated,
      'identity', is_identity,
      'identity_generation', identity_generation
    ) order by table_schema, table_name, ordinal_position)
    from information_schema.columns
    where table_schema !~ '^pg_' and table_schema not in ('information_schema','supabase_migrations')
  ), '[]'::jsonb),
  'types', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'name', t.typname,
      'kind', t.typtype,
      'category', t.typcategory,
      'base_type', case when t.typbasetype=0 then null else format_type(t.typbasetype, null) end,
      'not_null', t.typnotnull,
      'default_defined', t.typdefault is not null,
      'default_fingerprint_md5', case when t.typdefault is null then null else md5(t.typdefault) end,
      'enum_labels', coalesce((
        select jsonb_agg(e.enumlabel order by e.enumsortorder)
        from pg_enum e where e.enumtypid=t.oid
      ), '[]'::jsonb),
      'range_subtype', case when r.rngsubtype is null then null else format_type(r.rngsubtype, null) end
    ) order by n.nspname, t.typname)
    from pg_type t
    join pg_namespace n on n.oid=t.typnamespace
    left join pg_range r on r.rngtypid=t.oid
    where n.nspname !~ '^pg_' and n.nspname not in ('information_schema','supabase_migrations')
      and (t.typtype in ('d','e','r','m') or (t.typtype='c' and t.typrelid=0))
  ), '[]'::jsonb),
  'constraints', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'name', con.conname,
      'type', case con.contype when 'p' then 'PRIMARY KEY' when 'f' then 'FOREIGN KEY' when 'u' then 'UNIQUE' when 'c' then 'CHECK' when 'x' then 'EXCLUSION' else con.contype::text end,
      'definition', pg_get_constraintdef(con.oid),
      'validated', con.convalidated,
      'deferrable', con.condeferrable,
      'initially_deferred', con.condeferred
    ) order by n.nspname, c.relname, con.conname)
    from pg_constraint con
    join pg_class c on c.oid=con.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname !~ '^pg_' and n.nspname not in ('information_schema','supabase_migrations')
  ), '[]'::jsonb),
  'indexes', coalesce((
    select jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename, 'name', indexname, 'definition', indexdef) order by schemaname, tablename, indexname)
    from pg_indexes where schemaname !~ '^pg_' and schemaname not in ('information_schema','supabase_migrations')
  ), '[]'::jsonb),
  'policies', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', schemaname,
      'table', tablename,
      'name', policyname,
      'permissive', permissive,
      'command', cmd,
      'roles', roles,
      'using', qual,
      'with_check', with_check
    ) order by schemaname, tablename, policyname)
    from pg_policies where schemaname !~ '^pg_' and schemaname not in ('information_schema','supabase_migrations')
  ), '[]'::jsonb),
  'grants', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', table_schema,
      'table', table_name,
      'grantee', grantee,
      'privilege', privilege_type,
      'grantable', is_grantable
    ) order by table_schema, table_name, grantee, privilege_type)
    from information_schema.role_table_grants where table_schema !~ '^pg_' and table_schema not in ('information_schema','supabase_migrations')
  ), '[]'::jsonb),
  'columnGrants', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', table_schema,
      'table', table_name,
      'column', column_name,
      'grantee', grantee,
      'privilege', privilege_type,
      'grantable', is_grantable
    ) order by table_schema, table_name, column_name, grantee, privilege_type)
    from information_schema.column_privileges where table_schema !~ '^pg_' and table_schema not in ('information_schema','supabase_migrations')
  ), '[]'::jsonb),
  'schemaGrants', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'grantee', case when acl.grantee=0 then 'PUBLIC' else coalesce(r.rolname, acl.grantee::text) end,
      'grantor', pg_get_userbyid(acl.grantor),
      'privilege', acl.privilege_type,
      'grantable', acl.is_grantable
    ) order by n.nspname, acl.grantee, acl.privilege_type)
    from pg_namespace n
    cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) acl
    left join pg_roles r on r.oid=acl.grantee
    where n.nspname !~ '^pg_' and n.nspname not in ('information_schema','supabase_migrations')
  ), '[]'::jsonb),
  'defaultPrivileges', coalesce((
    select jsonb_agg(jsonb_build_object(
      'owner', pg_get_userbyid(d.defaclrole),
      'schema', n.nspname,
      'object_type', d.defaclobjtype,
      'grantee', case when acl.grantee=0 then 'PUBLIC' else coalesce(r.rolname, acl.grantee::text) end,
      'grantor', pg_get_userbyid(acl.grantor),
      'privilege', acl.privilege_type,
      'grantable', acl.is_grantable
    ) order by d.defaclrole, d.defaclnamespace, d.defaclobjtype, acl.grantee, acl.privilege_type)
    from pg_default_acl d
    left join pg_namespace n on n.oid=d.defaclnamespace
    cross join lateral aclexplode(d.defaclacl) acl
    left join pg_roles r on r.oid=acl.grantee
    where d.defaclnamespace=0 or (n.nspname !~ '^pg_' and n.nspname not in ('information_schema','supabase_migrations'))
  ), '[]'::jsonb),
  'sequences', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'name', c.relname,
      'owner', pg_get_userbyid(c.relowner),
      'start', s.seqstart,
      'increment', s.seqincrement,
      'minimum', s.seqmin,
      'maximum', s.seqmax,
      'cache', s.seqcache,
      'cycle', s.seqcycle,
      'owned_by', (select format('%I.%I.%I', tn.nspname, tc.relname, a.attname)
                  from pg_depend d
                  join pg_class tc on tc.oid=d.refobjid
                  join pg_namespace tn on tn.oid=tc.relnamespace
                  join pg_attribute a on a.attrelid=tc.oid and a.attnum=d.refobjsubid
                  where d.classid='pg_class'::regclass and d.objid=c.oid and d.refclassid='pg_class'::regclass and d.deptype in ('a','i')
                  limit 1)
    ) order by n.nspname, c.relname)
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    join pg_sequence s on s.seqrelid=c.oid
    where n.nspname !~ '^pg_' and n.nspname not in ('information_schema','supabase_migrations') and c.relkind='S'
  ), '[]'::jsonb),
  'sequenceGrants', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'sequence', c.relname,
      'grantee', case when acl.grantee=0 then 'PUBLIC' else coalesce(r.rolname, acl.grantee::text) end,
      'privilege', acl.privilege_type,
      'grantable', acl.is_grantable
    ) order by n.nspname, c.relname, acl.grantee, acl.privilege_type)
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('S', c.relowner))) acl
    left join pg_roles r on r.oid=acl.grantee
    where n.nspname !~ '^pg_' and n.nspname not in ('information_schema','supabase_migrations') and c.relkind='S'
  ), '[]'::jsonb),
  'functions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'name', p.proname,
      'identity', pg_get_function_identity_arguments(p.oid),
      'language', l.lanname,
      'security_definer', p.prosecdef,
      'volatility', p.provolatile,
      'configuration', p.proconfig,
      'definition_fingerprint_md5', md5(pg_get_functiondef(p.oid))
    ) order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    join pg_language l on l.oid=p.prolang
    where n.nspname !~ '^pg_' and n.nspname not in ('information_schema','supabase_migrations') and p.prokind='f'
      and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
  ), '[]'::jsonb),
  'functionGrants', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', nspname,
      'function', proname,
      'identity', identity_arguments,
      'grantee', grantee,
      'grantor', grantor,
      'privilege', privilege_type,
      'grantable', is_grantable
    ) order by nspname, proname, identity_arguments, grantee, privilege_type)
    from (
      select n.nspname,
        p.proname,
        pg_get_function_identity_arguments(p.oid) as identity_arguments,
        case when acl.grantee=0 then 'PUBLIC' else coalesce(gr.rolname, acl.grantee::text) end as grantee,
        pg_get_userbyid(acl.grantor) as grantor,
        acl.privilege_type,
        acl.is_grantable
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      left join pg_roles gr on gr.oid=acl.grantee
      where n.nspname !~ '^pg_' and n.nspname not in ('information_schema','supabase_migrations') and p.prokind='f'
        and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
    ) function_acl
  ), '[]'::jsonb),
  'triggers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'name', t.tgname,
      'enabled', t.tgenabled,
      'definition', pg_get_triggerdef(t.oid)
    ) order by n.nspname, c.relname, t.tgname)
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname !~ '^pg_' and n.nspname not in ('information_schema','supabase_migrations') and not t.tgisinternal
  ), '[]'::jsonb),
  'extensions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', e.extname,
      'owner', pg_get_userbyid(e.extowner),
      'version', e.extversion,
      'schema', n.nspname,
      'relocatable', e.extrelocatable
    ) order by e.extname)
    from pg_extension e
    join pg_namespace n on n.oid=e.extnamespace
  ), '[]'::jsonb)
);
commit;
