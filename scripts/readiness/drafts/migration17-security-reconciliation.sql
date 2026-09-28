-- CANDIDATE ONLY. Never apply to production or move into supabase/migrations
-- until Supabase-like baseline, negative security tests, and remote diff pass.
-- Forward-only: normalizes privileges on exactly the 57 ORKTO-owned public tables.
-- Does not change Supabase default ACLs or auth/storage/platform objects.
-- PostgreSQL transaction is supplied by the replay runner.

do $$
declare
  t record;
  col record;
  table_count integer;
  browser_select_tables text[] := array[
    'clients','services','quotes','proposals','quote_extensions','payment_records','profiles',
    'orkto_approval_tasks','orkto_audit_log','orkto_automation_jobs','orkto_automation_runs',
    'orkto_automations','orkto_case_studies','orkto_channel_usage','orkto_collection_cases',
    'orkto_collection_events','orkto_contacts','orkto_conversations','orkto_customer_signals',
    'orkto_deals','orkto_duplicate_reviews','orkto_feature_configs','orkto_import_jobs',
    'orkto_import_rows','orkto_live_quote_events','orkto_live_quotes','orkto_messages',
    'orkto_model_usage','orkto_notifications','orkto_plan_usage','orkto_purchases',
    'orkto_replay_records','orkto_reports','orkto_risk_assessments','orkto_sussurros',
    'orkto_tasks','orkto_wia_actions','orkto_wia_chat_messages','orkto_wia_events',
    'orkto_wia_memories','orkto_wia_runs','orkto_wia_tool_calls',
    'orkto_workspace_invites','orkto_workspace_members','orkto_workspace_subscriptions',
    'orkto_workspaces','orkto_wrapped'
  ];
begin
  select count(*) into table_count from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
    and (c.relname like 'orkto\_%' escape '\' or c.relname=any(array[
      'asaas_webhook_events','clients','payment_records','profiles','proposals',
      'quote_extensions','quotes','services','tony_conversations','tony_memories']));
  if table_count<>57 then raise exception 'Expected 57 ORKTO public tables, found %; review ownership before privilege reconciliation',table_count; end if;

  for t in select c.oid,c.relname,c.relrowsecurity,pg_get_userbyid(c.relowner) as owner
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'
      and (c.relname like 'orkto\_%' escape '\' or c.relname=any(array[
        'asaas_webhook_events','clients','payment_records','profiles','proposals',
        'quote_extensions','quotes','services','tony_conversations','tony_memories']))
  loop
    if t.owner<>'postgres' then raise exception 'Unexpected owner % for public.%',t.owner,t.relname; end if;
    if not t.relrowsecurity then raise exception 'RLS disabled on public.%',t.relname; end if;
    execute format('revoke all privileges on table public.%I from PUBLIC, anon, authenticated',t.relname);
    -- Existing column-level ACLs survive a table-level REVOKE. Remove them
    -- explicitly, including legacy profile INSERT/UPDATE and Supabase grants.
    for col in select attname from pg_attribute where attrelid=t.oid and attnum>0 and not attisdropped loop
      execute format('revoke all privileges (%I) on table public.%I from PUBLIC, anon, authenticated',col.attname,t.relname);
    end loop;
    if t.relname=any(browser_select_tables) then
      execute format('grant select on table public.%I to authenticated',t.relname);
    end if;
    execute format('grant all privileges on table public.%I to service_role',t.relname);
  end loop;
end $$;

-- Server/admin-only sequences. Do not change default privileges globally.
do $$ declare sequence_name text; begin
  foreach sequence_name in array array[
    'tony_conversations_id_seq','tony_memories_id_seq',
    'orkto_finance_assumptions_version_seq'
  ] loop
    if to_regclass(format('public.%I',sequence_name)) is null then
      raise exception 'Expected ORKTO sequence public.% is missing',sequence_name;
    end if;
    execute format('revoke all privileges on sequence public.%I from PUBLIC, anon, authenticated',sequence_name);
    execute format('grant all privileges on sequence public.%I to service_role',sequence_name);
  end loop;
end $$;

-- Public-schema functions created by ORKTO include legacy non-orkto names.
-- Trigger functions should not retain inherited browser EXECUTE grants either.
do $$ declare f record; function_count integer := 0; begin
  for f in select p.oid::regprocedure as signature,p.proname,pg_get_userbyid(p.proowner) as owner
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
  loop
    function_count := function_count+1;
    if f.owner<>'postgres' then raise exception 'Unexpected owner % for function %',f.owner,f.signature; end if;
    execute format('revoke all privileges on function %s from PUBLIC, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
    if f.proname in ('orkto_is_workspace_member','orkto_is_workspace_admin','orkto_legacy_owner_matches') then
      execute format('grant execute on function %s to authenticated',f.signature);
    end if;
  end loop;
  if function_count<>17 then raise exception 'Expected 17 ORKTO public functions, found %',function_count; end if;
end $$;

-- Remote baseline is NOT NULL; vanilla CI target was nullable. There are no
-- production proposal rows at the read-only capture, but fail closed if data
-- appears before promotion. No data backfill is guessed.
do $$ begin
  if exists(select 1 from public.proposals where is_active is null or created_at is null) then
    raise exception 'Cannot enforce proposals nullability: existing NULL values require reviewed backfill';
  end if;
end $$;
alter table public.proposals alter column is_active set not null;
alter table public.proposals alter column created_at set not null;
