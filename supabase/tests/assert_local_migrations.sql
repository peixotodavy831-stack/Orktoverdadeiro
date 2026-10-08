-- Executed only by scripts/validate-migrations-local.ps1 against its disposable cluster.
do $$
declare bad_count integer;
begin
  select count(*) into bad_count from pg_tables t
  join pg_class c on c.relname=t.tablename
  join pg_namespace n on n.oid=c.relnamespace and n.nspname=t.schemaname
  where t.schemaname='public' and not c.relrowsecurity;
  if bad_count<>0 then raise exception '% public tables lack RLS',bad_count; end if;

  select count(*) into bad_count from pg_constraint where contype='f' and not convalidated;
  if bad_count<>0 then raise exception '% foreign keys are not validated',bad_count; end if;

  if (select count(*) from public.orkto_workspaces)<>2 then raise exception 'workspace backfill did not create exactly two fixture workspaces'; end if;
  if (select count(*) from public.orkto_workspace_members where role='owner' and status='active')<>2 then raise exception 'owner memberships were not backfilled'; end if;
  if (select count(*) from public.clients where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>1 then raise exception 'legacy client A was not preserved'; end if;
  if (select count(*) from public.clients where workspace_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>1 then raise exception 'legacy client B was not preserved'; end if;
  if (select count(*) from public.quotes where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>1 then raise exception 'legacy quote A was not preserved'; end if;
  if (select count(*) from public.quotes where workspace_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>1 then raise exception 'legacy quote B was not preserved'; end if;
  if exists (select 1 from pg_available_extensions where name='pg_cron' and installed_version is not null) then
    raise exception 'pg_cron unexpectedly installed in the core migration test';
  end if;
end;
$$;

-- Core command boundary: browser table/RPC writes stay revoked after migrations 19-31.
do $$
declare signature text;
begin
  if has_table_privilege('authenticated','public.clients','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.services','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.orkto_deals','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.orkto_wia_actions','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.orkto_tasks','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.quotes','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.profiles','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.orkto_conversations','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.orkto_messages','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.orkto_wia_events','INSERT,UPDATE,DELETE') then
    raise exception 'authenticated can bypass the core mutation gateway';
  end if;
  foreach signature in array array[
    'public.orkto_create_client_command(uuid,uuid,text,uuid,text,text,text,text,text,text)',
    'public.orkto_update_client_command(uuid,uuid,uuid,text,uuid,text,jsonb)',
    'public.orkto_archive_client_command(uuid,uuid,uuid,text,uuid,text)',
    'public.orkto_catalog_item_command(uuid,uuid,text,uuid,text,uuid,text,jsonb)',
    'public.orkto_deal_command(uuid,uuid,text,uuid,text,uuid,text,jsonb)',
    'public.orkto_wia_decide_command(uuid,uuid,uuid,text,uuid,text)',
    'public.orkto_create_quote_command(uuid,uuid,text,uuid,text,jsonb,integer)',
    'public.orkto_set_conversation_priority_command(uuid,uuid,uuid,text,text,uuid,text)',
    'public.orkto_complete_onboarding_command(uuid,uuid,text,uuid,text,jsonb)',
    'public.orkto_inbox_state_command(uuid,uuid,text,uuid,text,text,uuid,text)',
    'public.orkto_archive_quote_command(uuid,uuid,uuid,text,uuid,text)',
    'public.orkto_update_quote_command(uuid,uuid,uuid,timestamptz,jsonb,text,uuid,text)',
    'public.orkto_transition_deal_command(uuid,uuid,uuid,text,text,text,uuid,text)',
    'public.orkto_wia_start_command(uuid,uuid,uuid,text,uuid,numeric)',
    'public.orkto_wia_complete_command(uuid,uuid,uuid,text,text,jsonb,uuid)',
    'public.orkto_publish_live_quote_command(uuid,uuid,uuid,text,text,uuid,text)',
    'public.orkto_public_live_quote_command(text,text,text,text,uuid)'
  ] loop
    if to_regprocedure(signature) is null then raise exception 'client command missing: %',signature; end if;
    if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE') then
      raise exception 'browser can call privileged client command: %',signature;
    end if;
    if not has_function_privilege('service_role',signature,'EXECUTE') then
      raise exception 'Edge service role cannot call client command: %',signature;
    end if;
  end loop;
  if not exists (select 1 from pg_indexes where schemaname='public' and tablename='orkto_wia_events'
                 and indexdef ilike '%UNIQUE%' and indexdef ilike '%workspace_id%'
                 and indexdef ilike '%idempotency_key%') then
    raise exception 'client command idempotency uniqueness missing';
  end if;
end;
$$;

insert into public.proposals(slug,quote_id,user_id,workspace_id,expires_at)
select 'FIXA0001',q.id,q.user_id,q.workspace_id,now()+interval '2 days' from public.quotes q where q.quote_number='A-LEGACY';
insert into public.proposals(slug,quote_id,user_id,workspace_id,expires_at)
select 'FIXB0001',q.id,q.user_id,q.workspace_id,now()+interval '2 days' from public.quotes q where q.quote_number='B-LEGACY';

insert into public.orkto_conversations(user_id,workspace_id,contact_name,contact_phone,status,source_channel)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Contato A','+5511999990001','active','manual'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Contato B','+5511999990002','active','manual');
insert into public.orkto_messages(conversation_id,workspace_id,sender_role,content,direction)
select id,workspace_id,'contact','Mensagem fixture','incoming' from public.orkto_conversations;
insert into public.orkto_approval_tasks(conversation_id,workspace_id,bot_name,proposed_content,reason,policy_applied)
select id,workspace_id,'WIA','Rascunho fixture','test','approval_required' from public.orkto_conversations;
insert into auth.users(id,email) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','member-a@example.test'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','member-a-other@example.test') on conflict(id) do nothing;
insert into public.orkto_workspace_members(workspace_id,user_id,role,status,joined_at) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','member','active',now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dddddddd-dddd-4ddd-8ddd-dddddddddddd','member','active',now())
 on conflict(workspace_id,user_id) do update set status='active';
insert into public.orkto_sussurros(workspace_id,conversation_id,from_user_id,to_user_id,source,content,expires_at)
select workspace_id,id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','manager','A-private-to-member',now()+interval '1 day'
from public.orkto_conversations where contact_name='Contato A';
insert into public.orkto_sussurros(workspace_id,conversation_id,from_user_id,to_user_id,source,content,expires_at)
select workspace_id,id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'manager','A-team-note',now()+interval '1 day'
from public.orkto_conversations where contact_name='Contato A';
insert into public.orkto_sussurros(workspace_id,conversation_id,from_user_id,to_user_id,source,content,expires_at)
select workspace_id,id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null,'manager','B-team-note',now()+interval '1 day'
from public.orkto_conversations where contact_name='Contato B';
insert into public.orkto_deals(workspace_id,customer_ref,conversation_ref,title,stage,status,value_cents)
select c.workspace_id,c.id::text,cv.id,'Negócio fixture', 'new','open',10000
from public.clients c join public.orkto_conversations cv on cv.workspace_id=c.workspace_id;

-- Core relation triggers/FKs also reject cross-tenant conversation links.
do $$
begin
  begin
    update public.orkto_conversations a set customer_id=b.id
    from public.clients b
    where a.workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and b.workspace_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    raise exception 'cross-tenant conversation/customer relation unexpectedly succeeded';
  exception when foreign_key_violation then null; end;

  begin
    insert into public.orkto_messages(conversation_id,workspace_id,sender_role,content,direction)
    select id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','contact','cross tenant','incoming'
    from public.orkto_conversations where workspace_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    raise exception 'cross-tenant message/conversation relation unexpectedly succeeded';
  exception when foreign_key_violation then null; end;

  begin
    insert into public.orkto_approval_tasks(conversation_id,workspace_id,bot_name,proposed_content,reason,policy_applied)
    select id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','WIA','cross tenant','test','approval_required'
    from public.orkto_conversations where workspace_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    raise exception 'cross-tenant approval/conversation relation unexpectedly succeeded';
  exception when foreign_key_violation then null; end;
end;
$$;

-- The relationship trigger must reject a client reference owned by another workspace.
do $$
begin
  begin
    insert into public.orkto_deals(workspace_id,customer_ref,title,stage,status,value_cents)
    select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id::text,'Referência cruzada','new','open',100
    from public.clients where workspace_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    raise exception 'cross-tenant deal/customer reference unexpectedly succeeded';
  exception when foreign_key_violation then null; end;
end;
$$;

-- Bypass RLS only for this constraint assertion: it verifies the composite FK
-- itself rejects a cross-workspace quote reference even for service-side writes.
alter table public.proposals disable trigger aaa_bind_proposal_retention;
do $$
begin
  begin
    insert into public.proposals(slug,quote_id,user_id,workspace_id,expires_at)
    select 'CROSS001',q.id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()+interval '2 days'
    from public.quotes q where q.quote_number='B-LEGACY';
    raise exception 'cross-tenant quote relation unexpectedly succeeded';
  exception when foreign_key_violation then null; end;
end;
$$;
alter table public.proposals enable trigger aaa_bind_proposal_retention;

set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $$
declare row_count integer; t text; tenant uuid;
begin
  select count(*) into row_count from public.clients;
  if row_count<>1 then raise exception 'tenant A can see % clients, expected 1',row_count; end if;
  select count(*) into row_count from public.services;
  if row_count<>1 then raise exception 'tenant A can see % services, expected 1',row_count; end if;
  select count(*) into row_count from public.quotes;
  if row_count<>1 then raise exception 'tenant A can see % quotes, expected 1',row_count; end if;
  select count(*) into row_count from public.proposals;
  if row_count<>1 then raise exception 'tenant A can see % proposals, expected 1',row_count; end if;
  select count(*) into row_count from public.orkto_conversations;
  if row_count<>1 then raise exception 'tenant A can see % conversations, expected 1',row_count; end if;
  select count(*) into row_count from public.orkto_messages;
  if row_count<>1 then raise exception 'tenant A can see % messages, expected 1',row_count; end if;
  select count(*) into row_count from public.orkto_approval_tasks;
  if row_count<>1 then raise exception 'tenant A can see % approval tasks, expected 1',row_count; end if;
  select count(*) into row_count from public.orkto_sussurros;
  if row_count<>2 then raise exception 'tenant A sender can see % own/team Sussurros, expected 2',row_count; end if;
  select count(*) into row_count from public.orkto_deals;
  if row_count<>1 then raise exception 'tenant A can see % deals, expected 1',row_count; end if;
  foreach t in array array['clients','services','quotes','proposals','orkto_conversations','orkto_messages','orkto_approval_tasks','orkto_wia_actions','orkto_workspace_members','orkto_sussurros'] loop
    if has_table_privilege(current_user,'public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE') then
      raise exception 'browser can bypass API write policy on %',t;
    end if;
    foreach tenant in array array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid] loop
      begin
        execute format('update public.%I set workspace_id=workspace_id where workspace_id=$1',t) using tenant;
        raise exception 'browser updated % without API authorization',t;
      exception when insufficient_privilege then null; end;
      begin
        execute format('delete from public.%I where workspace_id=$1',t) using tenant;
        raise exception 'browser deleted % without API authorization',t;
      exception when insufficient_privilege then null; end;
    end loop;
  end loop;
  begin
    insert into public.clients(workspace_id,user_id,name,phone)
    values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','spoofed','+5500');
    raise exception 'tenant A inserted into tenant B';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
do $$
declare row_count integer;
begin
  select count(*) into row_count from public.clients;
  if row_count<>1 then raise exception 'active workspace member can see % shared clients, expected 1',row_count; end if;
  select count(*) into row_count from public.quotes;
  if row_count<>1 then raise exception 'active workspace member can see % shared quotes, expected 1',row_count; end if;
  select count(*) into row_count from public.orkto_deals;
  if row_count<>1 then raise exception 'active workspace member can see % shared deals, expected 1',row_count; end if;
  select count(*) into row_count from public.orkto_sussurros;
  if row_count<>2 then raise exception 'intended recipient can see % assigned/team Sussurros, expected 2',row_count; end if;
  if not exists(select 1 from public.orkto_sussurros where content='A-private-to-member') then raise exception 'intended recipient cannot read addressed Sussurro'; end if;
  if has_table_privilege(current_user,'public.orkto_sussurros','INSERT') then raise exception 'authenticated users can bypass the Sussurro API and insert directly'; end if;
end;
$$;

select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
do $$
declare row_count integer;
begin
  select count(*) into row_count from public.orkto_sussurros;
  if row_count<>1 then raise exception 'unrelated workspace member can see % Sussurros, expected only the team note',row_count; end if;
  if exists(select 1 from public.orkto_sussurros where content='A-private-to-member') then raise exception 'unrelated workspace member can read a targeted Sussurro'; end if;
end;
$$;

select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $$
declare row_count integer;
begin
  select count(*) into row_count from public.clients;
  if row_count<>1 then raise exception 'tenant B can see % clients, expected 1',row_count; end if;
  if not exists (select 1 from public.clients where name='Cliente B') then raise exception 'tenant B cannot read its own client'; end if;
  select count(*) into row_count from public.orkto_sussurros;
  if row_count<>1 then raise exception 'tenant B can see % Sussurros, expected its own team note only',row_count; end if;
  if exists(select 1 from public.orkto_sussurros where content='A-private-to-member' or content='A-team-note') then raise exception 'tenant B can see an A Sussurro'; end if;
end;
$$;
reset role;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='proposals_quote_workspace_fkey' and convalidated) then raise exception 'proposal workspace FK missing or unvalidated'; end if;
  if not exists (select 1 from pg_constraint where conname='orkto_messages_conversation_workspace_fkey' and convalidated) then raise exception 'message workspace FK missing or unvalidated'; end if;
  if not exists (select 1 from pg_constraint where conname='orkto_approval_conversation_workspace_fkey' and convalidated) then raise exception 'approval workspace FK missing or unvalidated'; end if;
  if not exists (select 1 from pg_constraint where conname='quotes_customer_workspace_fkey' and convalidated) then raise exception 'quote customer workspace FK missing or unvalidated'; end if;
  if not exists (select 1 from pg_constraint where conname='quotes_deal_workspace_fkey' and convalidated) then raise exception 'quote deal workspace FK missing or unvalidated'; end if;
  if not exists (select 1 from pg_constraint where conname='conversations_customer_workspace_fkey' and convalidated) then raise exception 'conversation customer workspace FK missing or unvalidated'; end if;
  if not exists (select 1 from pg_constraint where conname='conversations_deal_workspace_fkey' and convalidated) then raise exception 'conversation deal workspace FK missing or unvalidated'; end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='quotes_workspace_deal_active_idx') then raise exception 'quote deal tenant index missing'; end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='clients_workspace_created_idx') then raise exception 'clients tenant index missing'; end if;
end;
$$;

do $$
declare plan_count integer; trial_count integer;
begin
  select count(*) into plan_count from public.orkto_plan_price_versions where status='approved' and price_is_public=false and price_cents is null;
  if plan_count<>7 then raise exception 'expected seven internal-only versioned plan entitlements, got %',plan_count; end if;
  if not exists(select 1 from public.orkto_plan_catalog where plan_key='legacy_standard') then raise exception 'Legacy Standard was not preserved'; end if;
  select count(*) into trial_count from public.orkto_workspace_subscriptions where status='trial' and trial_ends_at is not null;
  if trial_count=0 then raise exception 'default trial subscription was not created for legacy workspaces'; end if;
  if has_function_privilege('authenticated','public.orkto_consume_plan_usage(uuid,date,text,numeric,numeric)','EXECUTE') then raise exception 'browser role can bypass quota endpoint'; end if;
  if not has_function_privilege('service_role','public.orkto_consume_plan_usage(uuid,date,text,numeric,numeric)','EXECUTE') then raise exception 'server quota function is not executable by service_role'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='orkto_model_usage' and column_name='cached_input_tokens') then raise exception 'cached token telemetry missing'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='orkto_model_usage' and column_name='actual_cash_cost_cents') then raise exception 'actual AI cost provenance missing'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='orkto_model_usage' and column_name='normalized_cost_cents') then raise exception 'normalized AI cost provenance missing'; end if;
  if not exists(select 1 from pg_constraint where conname='orkto_finance_transactions_workspace_id_fkey' and convalidated) then raise exception 'finance workspace FK missing or unvalidated'; end if;
end;
$$;

-- Quote archive must commit its dependent state atomically and replay once.
-- This fixture runs only inside the disposable PostgreSQL 17 replay.
do $$
declare
  v_quote uuid;
  v_link uuid;
  v_result jsonb;
  v_workspace uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_actor uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_request uuid := '11111111-1111-4111-8111-111111111111';
  v_fingerprint text := repeat('a',64);
  v_error text;
begin
  insert into public.quotes(user_id,workspace_id,quote_number,client_name,client_phone,status)
    values(v_actor,v_workspace,'CI-ARCHIVE-TEST','Synthetic CI Quote','+550000000001','pending')
    returning id into v_quote;
  insert into public.proposals(slug,quote_id,user_id,workspace_id,expires_at,is_active)
    values('ARC10001',v_quote,v_actor,v_workspace,now()+interval '1 day',true);
  insert into public.orkto_live_quotes(workspace_id,quote_ref,public_token_hash,version,snapshot,current_price_cents,status)
    values(v_workspace,v_quote::text,repeat('b',64),1,'{}'::jsonb,0,'active') returning id into v_link;
  insert into public.orkto_automation_jobs(workspace_id,entity_type,entity_ref,step_key,due_at,status,idempotency_key)
    values(v_workspace,'quote',v_quote::text,'D+1',now()+interval '1 day','scheduled','ci-archive-job');
  insert into public.orkto_wia_actions(workspace_id,action_type,payload,idempotency_key)
    values(v_workspace,'send_proposal_followup',jsonb_build_object('quoteId',v_quote::text),'ci-archive-action');

  begin
    perform public.orkto_archive_quote_command('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      v_workspace,v_quote,'ci-archive-denied',v_request,v_fingerprint);
    raise exception 'foreign actor archived a quote';
  exception when raise_exception then
    get stacked diagnostics v_error=message_text;
    if v_error <> 'ORKTO_WORKSPACE_ACCESS_DENIED' then raise; end if;
  end;

  v_result := public.orkto_archive_quote_command(v_actor,v_workspace,v_quote,
    'ci-archive-once',v_request,v_fingerprint);
  if v_result->>'result' <> 'ARCHIVED' or (v_result->>'revoked_links')::integer <> 1
     or (v_result->>'cancelled_jobs')::integer <> 1
     or (v_result->>'cancelled_actions')::integer <> 1 then
    raise exception 'quote archive did not report all dependent effects';
  end if;
  v_result := public.orkto_archive_quote_command(v_actor,v_workspace,v_quote,
    'ci-archive-once',v_request,v_fingerprint);
  if v_result->>'result' <> 'REPLAY' then raise exception 'quote archive replay failed'; end if;
  if not exists(select 1 from public.quotes where id=v_quote and archived_at is not null)
     or exists(select 1 from public.proposals where quote_id=v_quote and is_active)
     or exists(select 1 from public.orkto_live_quotes where id=v_link and status<>'revoked')
     or exists(select 1 from public.orkto_automation_jobs where entity_ref=v_quote::text and status<>'cancelled')
     or exists(select 1 from public.orkto_wia_actions where payload->>'quoteId'=v_quote::text and status<>'cancelled')
     or (select count(*) from public.orkto_wia_events where event_type='quote.archived' and entity_ref=v_quote::text)<>1 then
    raise exception 'quote archive left a dependent effect active or duplicated audit';
  end if;
end;
$$;

-- Quote terms: server-priced fields, dependent cancellation, concurrency and replay.
do $$
declare
  v_quote public.quotes%rowtype;
  v_link uuid;
  v_result jsonb;
  v_fields jsonb;
  v_workspace uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_actor uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_request uuid := '22222222-2222-4222-8222-222222222222';
  v_fingerprint text := repeat('d',64);
  v_error text;
begin
  insert into public.quotes(user_id,workspace_id,quote_number,client_name,client_phone,status)
    values(v_actor,v_workspace,'CI-UPDATE-TEST','Synthetic CI Quote','+550000000002','pending')
    returning * into v_quote;
  insert into public.proposals(slug,quote_id,user_id,workspace_id,expires_at,is_active)
    values('UPD10001',v_quote.id,v_actor,v_workspace,now()+interval '1 day',true);
  insert into public.orkto_live_quotes(workspace_id,quote_ref,public_token_hash,version,snapshot,current_price_cents,status)
    values(v_workspace,v_quote.id::text,repeat('e',64),1,'{}'::jsonb,0,'active') returning id into v_link;
  insert into public.orkto_automation_jobs(workspace_id,entity_type,entity_ref,step_key,due_at,status,idempotency_key)
    values(v_workspace,'quote',v_quote.id::text,'D+1',now()+interval '1 day','scheduled','ci-update-job');
  insert into public.orkto_wia_actions(workspace_id,action_type,payload,idempotency_key)
    values(v_workspace,'send_proposal_followup',jsonb_build_object('quoteId',v_quote.id::text),'ci-update-action');
  v_fields := jsonb_build_object('notes','Changed in CI','items',jsonb_build_array(
    jsonb_build_object('name','Synthetic line','description','','quantity',2,'unitPrice',25,'discount',10)),
    'subtotal',50,'discount_total',5,'taxes',2,'total',47);
  begin
    perform public.orkto_update_quote_command('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      v_workspace,v_quote.id,v_quote.updated_at,v_fields,'ci-update-denied',v_request,v_fingerprint);
    raise exception 'foreign actor updated a quote';
  exception when raise_exception then
    get stacked diagnostics v_error=message_text;
    if v_error <> 'ORKTO_WORKSPACE_ACCESS_DENIED' then raise; end if;
  end;
  v_result := public.orkto_update_quote_command(v_actor,v_workspace,v_quote.id,v_quote.updated_at,
    v_fields,'ci-update-once',v_request,v_fingerprint);
  if v_result->>'result' <> 'UPDATED' or (v_result->>'revoked_links')::integer <> 1
     or (v_result->>'cancelled_jobs')::integer <> 1
     or (v_result->>'cancelled_actions')::integer <> 1 then
    raise exception 'quote update did not report dependent effects';
  end if;
  v_result := public.orkto_update_quote_command(v_actor,v_workspace,v_quote.id,v_quote.updated_at,
    v_fields,'ci-update-once',v_request,v_fingerprint);
  if v_result->>'result' <> 'REPLAY' then raise exception 'quote update replay failed'; end if;
  if not exists(select 1 from public.quotes q where q.id=v_quote.id and q.notes='Changed in CI' and q.total=47)
     or exists(select 1 from public.proposals where quote_id=v_quote.id and is_active)
     or exists(select 1 from public.orkto_live_quotes where id=v_link and status<>'revoked')
     or exists(select 1 from public.orkto_automation_jobs where entity_ref=v_quote.id::text and status<>'cancelled')
     or exists(select 1 from public.orkto_wia_actions where payload->>'quoteId'=v_quote.id::text and status<>'cancelled')
     or (select count(*) from public.orkto_wia_events where event_type='quote.updated' and entity_ref=v_quote.id::text)<>1 then
    raise exception 'quote update did not commit one complete state change';
  end if;
  begin
    perform public.orkto_update_quote_command(v_actor,v_workspace,v_quote.id,v_quote.updated_at,
      v_fields,'ci-update-stale',v_request,repeat('f',64));
    raise exception 'stale quote version was accepted';
  exception when raise_exception then
    get stacked diagnostics v_error=message_text;
    if v_error <> 'ORKTO_CONFLICT' then raise; end if;
  end;
  -- Keep the disposable fixture from consuming a plan slot in later assertions.
  update public.quotes set archived_at=now() where id=v_quote.id;
end;
$$;

-- Terminal deal transitions: authorization, atomic outcome, replay and audit.
do $$
declare
  v_deal uuid;
  v_result jsonb;
  v_workspace uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_actor uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_request uuid := '33333333-3333-4333-8333-333333333333';
  v_fingerprint text := repeat('1',64);
  v_error text;
begin
  select id into strict v_deal from public.orkto_deals
    where workspace_id=v_workspace and title='Negócio fixture';
  begin
    perform public.orkto_transition_deal_command(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,v_workspace,v_deal,'won',null,
      'ci-deal-denied',v_request,v_fingerprint);
    raise exception 'foreign actor transitioned a deal';
  exception when raise_exception then
    get stacked diagnostics v_error=message_text;
    if v_error <> 'ORKTO_WORKSPACE_ACCESS_DENIED' then raise; end if;
  end;
  v_result := public.orkto_transition_deal_command(
    v_actor,v_workspace,v_deal,'won',null,'ci-deal-won-once',v_request,v_fingerprint);
  if v_result->>'result' <> 'UPDATED'
     or not exists(select 1 from public.orkto_deals where id=v_deal and stage='won' and status='won')
     or (select count(*) from public.orkto_wia_events
         where event_type='deal.stage_changed' and entity_ref=v_deal::text)<>1 then
    raise exception 'deal outcome was not committed with one audit event';
  end if;
  v_result := public.orkto_transition_deal_command(
    v_actor,v_workspace,v_deal,'won',null,'ci-deal-won-once',v_request,v_fingerprint);
  if v_result->>'result' <> 'REPLAY' then raise exception 'deal outcome replay failed'; end if;
  begin
    perform public.orkto_transition_deal_command(
      v_actor,v_workspace,v_deal,'lost','late conflict','ci-deal-invalid',v_request,repeat('2',64));
    raise exception 'terminal deal accepted a second outcome';
  exception when raise_exception then
    get stacked diagnostics v_error=message_text;
    if v_error <> 'ORKTO_CONFLICT' then raise; end if;
  end;
  v_result := public.orkto_transition_deal_command(
    v_actor,v_workspace,v_deal,'archived',null,'ci-deal-archive-once',v_request,repeat('3',64));
  if v_result->>'result' <> 'UPDATED'
     or not exists(select 1 from public.orkto_deals where id=v_deal and stage='won' and status='archived')
     or (select count(*) from public.orkto_wia_events
         where event_type='deal.archived' and entity_ref=v_deal::text)<>1 then
    raise exception 'deal archive did not preserve outcome or audit exactly once';
  end if;
end;
$$;
