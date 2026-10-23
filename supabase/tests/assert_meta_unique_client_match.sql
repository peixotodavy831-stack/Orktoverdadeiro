-- Disposable PostgreSQL 17 only. Synthetic rows are rolled back.
begin;
do $$
declare
  a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  connection uuid := gen_random_uuid();
  client_a uuid := gen_random_uuid();
  client_duplicate uuid := gen_random_uuid();
  claim record;
  result record;
  expected uuid;
  actual uuid;
  scenario integer;
  phone text;
  event_id text;
  message_count bigint;
begin
  insert into public.orkto_channel_connections(id,workspace_id,provider,status,waba_id,phone_number_id,
    token_secret_id,verified_at,connected_by)
  values(connection,a,'meta_whatsapp_cloud','connected','98765432101','98765432102',gen_random_uuid(),now(),a);

  for scenario in 0..4 loop
    phone := '55110000900'||scenario::text;
    event_id := 'message:unique-match-'||scenario::text;
    expected := null;
    -- A foreign workspace always has a matching phone and must never be linked.
    insert into public.clients(user_id,workspace_id,name,phone) values(b,b,'Synthetic B',phone);
    if scenario in (1,2,3,4) then
      client_a := gen_random_uuid();
      insert into public.clients(id,user_id,workspace_id,name,phone,archived_at)
      values(client_a,a,a,'Synthetic A',phone,case when scenario=3 then now() else null end);
    end if;
    if scenario in (2,4) then
      client_duplicate := gen_random_uuid();
      insert into public.clients(id,user_id,workspace_id,name,phone,archived_at)
      values(client_duplicate,a,a,'Synthetic duplicate',phone,case when scenario=4 then now() else null end);
    end if;
    if scenario in (1,4) then expected := client_a; end if;
    select * into claim from public.orkto_claim_meta_webhook_event(
      '98765432102','98765432101',event_id,repeat('c',64),'message',now());
    if claim.decision <> 'CLAIMED' then raise exception 'Fixture claim failed'; end if;
    select * into result from public.orkto_ingest_meta_text_message(
      connection,event_id,claim.claim_token,'wamid.unique-match-'||scenario::text,phone,'Synthetic message',now());
    if result.decision <> 'APPLIED' then raise exception 'Ingest failed for scenario %',scenario; end if;
    select customer_id into actual from public.orkto_conversations where id=result.conversation_id and workspace_id=a;
    if actual is distinct from expected then raise exception 'Unsafe client association scenario %',scenario; end if;
    select count(*) into message_count from public.orkto_messages where workspace_id=a;
    perform public.orkto_ingest_meta_text_message(
      connection,event_id,claim.claim_token,'wamid.unique-match-'||scenario::text,phone,'Synthetic message',now());
    if (select count(*) from public.orkto_messages where workspace_id=a) <> message_count then
      raise exception 'Webhook replay created another message';
    end if;
  end loop;
  -- Explicit existing associations are retained when phone matching later becomes ambiguous.
  insert into public.clients(user_id,workspace_id,name,phone) values(a,a,'Later duplicate','551100009001');
  select * into claim from public.orkto_claim_meta_webhook_event(
    '98765432102','98765432101','message:retain-link',repeat('d',64),'message',now());
  select customer_id into expected from public.orkto_conversations where workspace_id=a and contact_phone='551100009001';
  select * into result from public.orkto_ingest_meta_text_message(
    connection,'message:retain-link',claim.claim_token,'wamid.retain-link','551100009001','Another synthetic message',now());
  select customer_id into actual from public.orkto_conversations where id=result.conversation_id;
  if actual is distinct from expected then raise exception 'Existing association was changed'; end if;
  if has_function_privilege('anon','public.orkto_ingest_meta_text_message(uuid,text,uuid,text,text,text,timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','public.orkto_ingest_meta_text_message(uuid,text,uuid,text,text,text,timestamptz)','EXECUTE') then
    raise exception 'Ingest execution privileges expanded';
  end if;
end $$;
rollback;
