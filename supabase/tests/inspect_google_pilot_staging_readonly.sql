-- READ ONLY. Run only in the staging project ghrjongiodziasupakrk.
-- No user identifiers, credentials, row payloads or migration SQL are returned.
with ledger as (
  select version, name, statements from supabase_migrations.schema_migrations
), session_functions as (
  select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in
    ('orkto_pilot_session_allowed','orkto_google_pilot_session_allowed')
    and p.pronargs=0
), checks as (
  select '01_ledger_count' as check_name, count(*)::text as observed from ledger
  union all select '02_ledger_distinct_versions',count(distinct version)::text from ledger
  union all select '03_duplicate_logical_names',count(*)::text from
    (select name from ledger group by name having count(*)>1) d
  union all select '04_migration44_occurrences',count(*)::text from ledger
    where name='google_pilot_gate_fails_closed'
  union all select '05_migration44_version',version from ledger
    where name='google_pilot_gate_fails_closed'
  union all select '06_migration44_normalized_sql_md5',
    md5(regexp_replace(regexp_replace(regexp_replace(
      replace(array_to_string(statements,chr(10)),chr(13),''),
      '--[^'||chr(10)||']*','','g'),'[[:space:]]+','','g'),';','','g'))
    from ledger where name='google_pilot_gate_fails_closed'
  union all select '07_function_body_md5:'||proname,md5(replace(prosrc,chr(13),''))
    from session_functions
  union all select '08_function_normalized_body_md5:'||proname,
    md5(regexp_replace(replace(prosrc,chr(13),''),'[[:space:]]+','','g')) from session_functions
  union all select '09_function_access:'||proname,
    jsonb_build_object('security_definer',prosecdef,'volatility',provolatile,
      'settings',proconfig,'anon_execute',has_function_privilege('anon',oid,'EXECUTE'),
      'authenticated_execute',has_function_privilege('authenticated',oid,'EXECUTE'),
      'service_role_execute',has_function_privilege('service_role',oid,'EXECUTE'),
      'public_execute',exists(select 1 from aclexplode(coalesce(proacl,acldefault('f',proowner))) a
        where a.grantee=0 and a.privilege_type='EXECUTE'))::text from session_functions
  union all select '10_pilot_enabled',enabled::text from orkto_pilot_private.configuration where singleton
  union all select '11_admissions_count',count(*)::text from orkto_pilot_private.admissions
  union all select '12_auth_users_count',count(*)::text from auth.users
  union all select '13_google_identities_count',count(*)::text from auth.identities where provider='google'
  union all select '14_active_sessions_count',count(*)::text from auth.sessions
    where not_after is null or not_after>now()
  union all select '15_private_browser_schema_access',
    jsonb_build_object('anon_usage',has_schema_privilege('anon','orkto_pilot_private','USAGE'),
      'authenticated_usage',has_schema_privilege('authenticated','orkto_pilot_private','USAGE'))::text
  union all select '16_closed_pilot_runtime_without_jwt',public.orkto_google_pilot_session_allowed()::text
  union all select '17_recovery_checkpoints',count(*)::text from orkto_pilot_private.recovery_checkpoints
  union all select '18_verified_recovery_checkpoints',count(*)::text from orkto_pilot_private.recovery_checkpoints where verified
  union all select '19_protected_recovery_rows',count(*)::text from orkto_pilot_private.recovery_rows
  union all select '20_total_sessions',count(*)::text from auth.sessions
  union all select '21_total_refresh_tokens',count(*)::text from auth.refresh_tokens
)
select check_name,observed from checks order by check_name;

-- Inspect intentional private-table RLS defaults without returning any row data.
select c.relname as table_name,c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policy p where p.polrelid=c.oid) as policies,
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_any_data_grant,
  has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_any_data_grant
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='orkto_pilot_private' and c.relkind in ('r','p') order by c.relname;
