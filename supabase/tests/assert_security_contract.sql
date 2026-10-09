-- Run after candidate 18 on a disposable PostgreSQL 17 database only.
-- The caller supplies --single-transaction so fixture writes are rolled back.
do $$
declare
  t record;
  operation text;
  expected_select boolean;
  table_count integer := 0;
  select_tables text[] := array[
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
  if not has_schema_privilege('authenticated','public','USAGE')
    or not has_schema_privilege('service_role','public','USAGE')
    or has_schema_privilege('anon','public','CREATE')
    or has_schema_privilege('authenticated','public','CREATE') then
    raise exception 'Public schema privilege contract failed';
  end if;
  for t in
    select c.oid,c.relname,c.relrowsecurity,pg_get_userbyid(c.relowner) owner
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'
      and (c.relname like 'orkto\_%' escape '\' or c.relname=any(array[
        'asaas_webhook_events','clients','payment_records','profiles','proposals',
        'quote_extensions','quotes','services','tony_conversations','tony_memories']))
  loop
    table_count := table_count+1;
    if t.owner<>'postgres' or not t.relrowsecurity then
      raise exception 'Unexpected owner or RLS on public.%: owner %, RLS %',t.relname,t.owner,t.relrowsecurity;
    end if;
    expected_select := t.relname=any(select_tables);
    foreach operation in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
      if has_table_privilege('anon',t.oid,operation) then
        raise exception 'Anon retained % on public.%',operation,t.relname;
      end if;
      if has_table_privilege('authenticated',t.oid,operation)<>(expected_select and operation='SELECT') then
        raise exception 'Authenticated % mismatch on public.%',operation,t.relname;
      end if;
      if operation=any(array['SELECT','INSERT','UPDATE','DELETE']) and not has_table_privilege('service_role',t.oid,operation) then
        raise exception 'Service role missing % on public.%',operation,t.relname;
      end if;
    end loop;
    if exists (
      select 1 from pg_attribute a cross join lateral aclexplode(a.attacl) x
      where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped
        and x.grantee in (0,'anon'::regrole::oid,'authenticated'::regrole::oid)
    ) then raise exception 'Browser/PUBLIC column grant remains on public.%',t.relname; end if;
  end loop;
  if table_count<>61 then raise exception 'Expected 61 tables, found %',table_count; end if;
  if (select count(*) from public.proposals where is_active is null or created_at is null)>0 then
    raise exception 'Proposals contain NULL in required columns';
  end if;
  if (select count(*) from pg_attribute a join pg_class c on c.oid=a.attrelid
      where c.oid='public.proposals'::regclass and a.attname in ('is_active','created_at') and a.attnotnull)<>2 then
    raise exception 'Proposals required columns remain nullable';
  end if;
end $$;

do $$ declare f record; expected_browser boolean; function_count integer := 0; begin
  for f in select p.oid,p.proname,pg_get_userbyid(p.proowner) owner
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
  loop
    function_count := function_count+1;
    expected_browser := f.proname=any(array['orkto_is_workspace_member','orkto_is_workspace_admin','orkto_legacy_owner_matches']);
    if f.owner<>'postgres' or has_function_privilege('anon',f.oid,'EXECUTE')
       or has_function_privilege('authenticated',f.oid,'EXECUTE')<>expected_browser
       or not has_function_privilege('service_role',f.oid,'EXECUTE') then
      raise exception 'Function privilege mismatch: %',f.oid::regprocedure;
    end if;
  end loop;
  if function_count<16 then raise exception 'Expected at least 16 public ORKTO functions, found %',function_count; end if;
  if has_function_privilege('authenticated','public.orkto_consume_plan_usage(uuid,date,text,numeric,numeric)','EXECUTE') then
    raise exception 'Browser can consume quota directly';
  end if;
  if has_function_privilege('anon','public.orkto_decide_approval_task_command(uuid,uuid,text,uuid,text,uuid,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.orkto_decide_approval_task_command(uuid,uuid,text,uuid,text,uuid,text,text)','EXECUTE')
     or not has_function_privilege('service_role','public.orkto_decide_approval_task_command(uuid,uuid,text,uuid,text,uuid,text,text)','EXECUTE')
     or (select p.proconfig from pg_proc p where p.oid='public.orkto_decide_approval_task_command(uuid,uuid,text,uuid,text,uuid,text,text)'::regprocedure)
        is distinct from array['search_path=']::text[] then
    raise exception 'Approval decision command privilege or search path mismatch';
  end if;
end $$;

do $$ declare sequence_name text; operation text; begin
  foreach sequence_name in array array['tony_conversations_id_seq','tony_memories_id_seq','orkto_finance_assumptions_version_seq'] loop
    foreach operation in array array['USAGE','SELECT','UPDATE'] loop
      if has_sequence_privilege('anon',format('public.%I',sequence_name),operation)
        or has_sequence_privilege('authenticated',format('public.%I',sequence_name),operation)
        or not has_sequence_privilege('service_role',format('public.%I',sequence_name),operation) then
        raise exception 'Sequence privilege mismatch: %, %',sequence_name,operation;
      end if;
    end loop;
  end loop;
end $$;

-- Actual role execution, not only catalog assertions.
set role anon;
do $$ begin
  begin
    perform 1 from public.clients limit 1;
    raise exception 'anon read clients';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- The decision, idempotency record and audit must share one SQL transaction.
do $$
declare
  a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  fixture_conversation_id uuid;
  fixture_task_id uuid;
  key text := 'security-approval-' || gen_random_uuid()::text;
  result jsonb;
begin
  insert into public.orkto_conversations(workspace_id,user_id,contact_name,contact_phone,source_channel)
  values(a,a,'Security fixture','+5500000000777','manual') returning id into fixture_conversation_id;
  insert into public.orkto_approval_tasks(workspace_id,conversation_id,bot_name,proposed_content,reason,policy_applied)
  values(a,fixture_conversation_id,'fixture','No external send','Security assertion','approval_required')
  returning id into fixture_task_id;
  result := public.orkto_decide_approval_task_command(a,a,key,gen_random_uuid(),repeat('a',64),fixture_task_id,'APPROVE','Reviewed');
  if result->>'result'<>'DECIDED' or result->'task'->>'status'<>'approved' then
    raise exception 'Approval decision failed';
  end if;
  result := public.orkto_decide_approval_task_command(a,a,key,gen_random_uuid(),repeat('a',64),fixture_task_id,'APPROVE','Reviewed');
  if result->>'result'<>'REPLAY' then raise exception 'Approval replay failed'; end if;
  if (select count(*) from public.orkto_audit_log where approval_task_id=fixture_task_id and event_type='wia.draft.approved')<>1 then
    raise exception 'Approval audit is not exactly once';
  end if;
  begin
    perform public.orkto_decide_approval_task_command(a,a,key,gen_random_uuid(),repeat('b',64),fixture_task_id,'APPROVE','Changed');
    raise exception 'Changed-payload replay succeeded';
  exception when raise_exception then
    if sqlerrm<>'ORKTO_IDEMPOTENCY_CONFLICT' then raise; end if;
  end;
  begin
    perform public.orkto_decide_approval_task_command(b,b,'foreign-approval-'||gen_random_uuid()::text,
      gen_random_uuid(),repeat('c',64),fixture_task_id,'APPROVE','Foreign');
    raise exception 'Cross-workspace approval succeeded';
  exception when raise_exception then
    if sqlerrm<>'ORKTO_NOT_FOUND' then raise; end if;
  end;
  if exists(select 1 from public.orkto_messages where conversation_id=fixture_conversation_id and direction='outgoing') then
    raise exception 'Draft approval created outgoing message';
  end if;
end $$;

insert into auth.users(id,email) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','no-membership@example.test')
  on conflict(id) do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',false);
do $$ begin
  if exists(select 1 from public.clients) or exists(select 1 from public.quotes)
    or exists(select 1 from public.orkto_workspaces)
    or public.orkto_is_workspace_member('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    or public.orkto_is_workspace_admin('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'User without membership accessed tenant data or privileged RPC';
  end if;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $$ declare a_count integer; b_count integer; begin
  select count(*) into a_count from public.clients where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  select count(*) into b_count from public.clients where workspace_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if a_count<1 or b_count<>0 then raise exception 'Workspace A SELECT isolation failed: A %, B %',a_count,b_count; end if;
  if public.orkto_is_workspace_member('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then
    raise exception 'Arbitrary tenant RPC returned membership';
  end if;
  if public.orkto_is_workspace_admin('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    or public.orkto_legacy_owner_matches('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then
    raise exception 'Privileged RPC accepted another tenant';
  end if;
  begin
    update public.clients set name='cross-tenant' where workspace_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    raise exception 'authenticated updated B';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.clients where workspace_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    raise exception 'authenticated deleted B';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $$ declare a_count integer; b_count integer; begin
  select count(*) into a_count from public.clients where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  select count(*) into b_count from public.clients where workspace_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if b_count<1 or a_count<>0 then raise exception 'Workspace B SELECT isolation failed: A %, B %',a_count,b_count; end if;
end $$;
reset role;

set role service_role;
do $$ begin
  if (select count(distinct workspace_id) from public.clients)<2 then
    raise exception 'Service role does not see both synthetic tenants';
  end if;
end $$;
reset role;
