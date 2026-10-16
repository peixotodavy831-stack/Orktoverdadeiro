-- Run after migration 47 against a disposable PostgreSQL 17 database.
-- This assertion contains no provider credentials and rolls its fixtures back.
begin;

do $$
declare
  v_table_name text;
  fn regprocedure;
  definition text;
  connection_id uuid := '47474747-4747-4747-8747-474747474747';
  first_claim record;
  second_claim record;
  third_claim record;
  finished boolean;
begin
  foreach v_table_name in array array[
    'orkto_channel_connections','orkto_whatsapp_controls','orkto_whatsapp_rate_cards',
    'orkto_whatsapp_webhook_events','orkto_whatsapp_usage_events'
  ] loop
    if not (select relrowsecurity from pg_class where oid=format('public.%I',v_table_name)::regclass) then
      raise exception 'RLS missing on public.%',v_table_name;
    end if;
    if has_table_privilege('anon',format('public.%I',v_table_name),'SELECT')
      or has_table_privilege('authenticated',format('public.%I',v_table_name),'SELECT')
      or not has_table_privilege('service_role',format('public.%I',v_table_name),'SELECT') then
      raise exception 'WhatsApp table privilege mismatch on public.%',v_table_name;
    end if;
  end loop;

  foreach fn in array array[
    'public.orkto_store_meta_connection(uuid,uuid,text,text,text,text,text,text,text[],text,jsonb)'::regprocedure,
    'public.orkto_read_meta_token(uuid)'::regprocedure,
    'public.orkto_set_whatsapp_mode(uuid,uuid,text,boolean)'::regprocedure,
    'public.orkto_claim_meta_webhook_event(text,text,text,text,text,timestamptz)'::regprocedure,
    'public.orkto_ingest_meta_text_message(uuid,text,uuid,text,text,text,timestamptz)'::regprocedure,
    'public.orkto_finish_meta_webhook_event(text,uuid,text,text)'::regprocedure,
    'public.orkto_reserve_meta_send(uuid,uuid,text,text,uuid)'::regprocedure,
    'public.orkto_accept_meta_send(uuid,uuid,uuid,text,text,timestamptz)'::regprocedure
  ] loop
    if has_function_privilege('anon',fn,'EXECUTE')
      or has_function_privilege('authenticated',fn,'EXECUTE')
      or not has_function_privilege('service_role',fn,'EXECUTE')
      or (select p.proconfig from pg_proc p where p.oid=fn) is distinct from array['search_path=""']::text[] then
      raise exception 'WhatsApp function privilege or search path mismatch: %',fn;
    end if;
  end loop;

  if exists(select 1 from public.orkto_whatsapp_rate_cards where status='approved') then
    raise exception 'A provider price was approved without commercial review';
  end if;
  if exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='orkto_channel_connections'
      and column_name in ('access_token','token','client_secret','app_secret')
  ) then raise exception 'Plaintext provider credential column exists'; end if;
  if not exists(
    select 1 from pg_indexes where schemaname='public'
      and indexname='orkto_conversations_workspace_channel_phone_uidx'
  ) then raise exception 'Workspace conversation uniqueness is missing'; end if;

  insert into public.orkto_channel_connections(id,workspace_id,provider,status,waba_id,phone_number_id,
    token_secret_id,verified_at,connected_by)
  values(connection_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','meta_whatsapp_cloud','connected',
    '12345678901','10987654321',gen_random_uuid(),now(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  insert into public.orkto_whatsapp_controls(workspace_id,connection_id,updated_by)
  values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',connection_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

  select * into first_claim from public.orkto_claim_meta_webhook_event(
    '10987654321','12345678901','message:wamid.fixture',repeat('a',64),'message',now());
  if first_claim.decision<>'CLAIMED' or first_claim.claim_token is null then
    raise exception 'First webhook claim failed';
  end if;
  select * into second_claim from public.orkto_claim_meta_webhook_event(
    '10987654321','12345678901','message:wamid.fixture',repeat('a',64),'message',now());
  if second_claim.decision<>'IN_PROGRESS' or second_claim.claim_token is not null then
    raise exception 'Concurrent webhook claim was not blocked';
  end if;
  select public.orkto_finish_meta_webhook_event('message:wamid.fixture',gen_random_uuid(),'processed',null)
    into finished;
  if finished then raise exception 'Foreign claim token finished webhook event'; end if;
  select public.orkto_finish_meta_webhook_event('message:wamid.fixture',first_claim.claim_token,'processed',null)
    into finished;
  if not finished then raise exception 'Owning claim token could not finish webhook event'; end if;
  select * into third_claim from public.orkto_claim_meta_webhook_event(
    '10987654321','12345678901','message:wamid.fixture',repeat('a',64),'message',now());
  if third_claim.decision<>'DUPLICATE' then raise exception 'Processed webhook was not deduplicated'; end if;

  definition:=pg_get_functiondef('public.orkto_store_meta_connection(uuid,uuid,text,text,text,text,text,text,text[],text,jsonb)'::regprocedure);
  if position('vault.create_secret' in definition)=0 or position('vault.update_secret' in definition)=0 then
    raise exception 'Vault credential storage contract is missing';
  end if;
end $$;

rollback;
