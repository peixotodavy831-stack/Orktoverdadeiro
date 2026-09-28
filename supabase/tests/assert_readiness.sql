-- Transactional regression checks. Changes are rolled back by this file.
begin;
do $$ declare counter integer; begin
  -- A versioned Scale subscription must not inherit the old profile free cap=5.
  update public.orkto_workspace_subscriptions set plan_key='scale',status='active'
    where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  for counter in 1..6 loop
    insert into public.quotes(workspace_id,user_id,quote_number,client_name,client_phone)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SCALE-'||counter,'Synthetic','+5500');
  end loop;
  if (select count(*) from public.quotes where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and quote_number like 'SCALE-%')<>6 then
    raise exception 'Scale entitlement did not allow more than the legacy five proposals';
  end if;
  delete from public.quotes where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and quote_number like 'SCALE-%';
  update public.orkto_workspace_subscriptions set plan_key='starter'
    where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  -- The fixture already contains one active legacy proposal. Starter allows
  -- five active proposals total, so four new proposals fit and the next fails.
  for counter in 1..4 loop
    insert into public.quotes(workspace_id,user_id,quote_number,client_name,client_phone)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','STARTER-'||counter,'Synthetic','+5500');
  end loop;
  if (select count(*) from public.quotes where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and archived_at is null and status not in ('rejected','expired')
      and (retention_expires_at is null or retention_expires_at>now()))<>5 then
    raise exception 'Starter entitlement did not allow exactly five active proposals including the legacy fixture';
  end if;
  begin
    insert into public.quotes(workspace_id,user_id,quote_number,client_name,client_phone)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','STARTER-OVER-CAP','Synthetic','+5500');
    raise exception 'versioned proposal cap bypassed';
  exception when check_violation then null; end;
  if (select count(*) from public.quotes where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and archived_at is null and status not in ('rejected','expired')
      and (retention_expires_at is null or retention_expires_at>now()))<>5 then
    raise exception 'Starter proposal cap changed after rejecting the sixth proposal';
  end if;
  update public.orkto_workspace_subscriptions set plan_key='scale',status='trial',trial_ends_at=now()-interval '1 day'
    where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  begin
    insert into public.quotes(workspace_id,user_id,quote_number,client_name,client_phone)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','EXPIRED-TRIAL','Synthetic','+5500');
    raise exception 'expired trial bypassed';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from pg_trigger where not tgisinternal and tgenabled='D'
    and tgrelid in ('public.quotes'::regclass,'public.proposals'::regclass)) then
    raise exception 'backfill left a business trigger disabled';
  end if;
end $$;

-- SECURITY DEFINER regression contract: these routines are intentionally
-- narrow, fixed-search-path helpers. No browser role may call trigger or
-- service-only routines; membership helpers are callable only by authenticated.
do $$
declare f record; definer_count integer := 0;
begin
  for f in
    select p.oid, p.proname, p.proconfig, p.prosecdef
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
  loop
    definer_count := definer_count + 1;
    if f.proname not in (
      'orkto_is_workspace_member','orkto_is_workspace_admin','orkto_provision_workspace_for_profile',
      'orkto_legacy_owner_matches','orkto_create_default_workspace_trial','orkto_consume_plan_usage',
      'orkto_claim_payment_intent','orkto_finish_payment_intent','orkto_claim_payment_webhook_event',
      'orkto_finish_payment_webhook_event','orkto_reserve_channel_send','orkto_mark_channel_send',
      'orkto_record_channel_delivery_event','tony_search_context'
    ) then
      raise exception 'Unexpected SECURITY DEFINER routine in public: %', f.proname;
    end if;
    if not coalesce(f.proconfig, array[]::text[]) @> array['search_path=public'] then
      raise exception 'SECURITY DEFINER routine % has no fixed search_path', f.proname;
    end if;
    if has_function_privilege('anon', f.oid, 'EXECUTE') then
      raise exception 'SECURITY DEFINER routine % is executable by anon', f.proname;
    end if;
    if f.proname in ('orkto_is_workspace_member','orkto_is_workspace_admin','orkto_legacy_owner_matches') then
      if not has_function_privilege('authenticated', f.oid, 'EXECUTE') then
        raise exception 'Workspace authorization helper % is unavailable to authenticated RLS policies', f.proname;
      end if;
    elsif has_function_privilege('authenticated', f.oid, 'EXECUTE') then
      raise exception 'Service/trigger SECURITY DEFINER routine % is executable by authenticated', f.proname;
    end if;
    if not has_function_privilege('service_role', f.oid, 'EXECUTE') then
      raise exception 'Server role cannot execute required routine %', f.proname;
    end if;
  end loop;
  if definer_count <> (13 + case when to_regprocedure('public.tony_search_context(text,text,integer)') is null then 0 else 1 end) then
    raise exception 'Unexpected SECURITY DEFINER routine count: %', definer_count;
  end if;
end $$;

-- Durable payment idempotency, webhook claim fencing, and delivery receipts.
do $$
declare
  quote_id uuid;
  conversation_id uuid;
  decision text;
  intent_id uuid;
  claim_id uuid;
  claim_token uuid;
  attempt_count integer;
  provider_reference text;
  finish_ok boolean;
  send_id uuid;
  send_status text;
  returned_message_id text;
  receipt_result text;
begin
  select id into quote_id from public.quotes where quote_number='A-LEGACY';
  if quote_id is null then raise exception 'Legacy quote required for payment-idempotency assertions is missing'; end if;

  select c.decision,c.intent_id,c.claim_token,c.attempt_count into decision,intent_id,claim_token,attempt_count
  from public.orkto_claim_payment_intent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',quote_id,'test','readiness-payment-01',repeat('a',64),10000,'BRL') c;
  if decision<>'RESERVED' or intent_id is null or claim_token is null or attempt_count<>1 then raise exception 'Payment idempotency first claim failed'; end if;
  select c.decision into decision from public.orkto_claim_payment_intent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',quote_id,'test','readiness-payment-01',repeat('a',64),10000,'BRL') c;
  if decision<>'IN_PROGRESS' then raise exception 'Concurrent duplicate payment request was not rejected as IN_PROGRESS'; end if;
  select c.decision into decision from public.orkto_claim_payment_intent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',quote_id,'test','readiness-payment-01',repeat('b',64),10000,'BRL') c;
  if decision<>'IDEMPOTENCY_CONFLICT' then raise exception 'Same payment key with changed payload was not rejected'; end if;
  select public.orkto_finish_payment_intent(intent_id,claim_token,'succeeded','provider-test-001','paid',null) into finish_ok;
  if not finish_ok then raise exception 'Payment success transition rejected the active claim'; end if;
  select c.decision,c.provider_reference into decision,provider_reference
    from public.orkto_claim_payment_intent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',quote_id,'test','readiness-payment-01',repeat('a',64),10000,'BRL') c;
  if decision<>'REPLAY_SUCCEEDED' or provider_reference<>'provider-test-001' then raise exception 'Completed payment retry did not replay safely'; end if;

  select c.decision,c.event_record_id,c.claim_token,c.attempt_count into decision,claim_id,claim_token,attempt_count
  from public.orkto_claim_payment_webhook_event('test','readiness-event-01','PAYMENT_RECEIVED',repeat('c',64),now()) c;
  if decision<>'CLAIMED' or claim_id is null or claim_token is null or attempt_count<>1 then raise exception 'Webhook event claim failed'; end if;
  select c.decision into decision from public.orkto_claim_payment_webhook_event('test','readiness-event-01','PAYMENT_RECEIVED',repeat('c',64),now()) c;
  if decision<>'IN_PROGRESS' then raise exception 'Concurrent webhook duplicate was not fenced'; end if;
  select c.decision into decision from public.orkto_claim_payment_webhook_event('test','readiness-event-01','PAYMENT_RECEIVED',repeat('d',64),now()) c;
  if decision<>'PAYLOAD_CONFLICT' then raise exception 'Webhook ID reuse with changed payload was not rejected'; end if;
  select public.orkto_finish_payment_webhook_event('test','readiness-event-01',repeat('c',64),gen_random_uuid(),'processed',null) into finish_ok;
  if finish_ok then raise exception 'Stale webhook claim token completed a newer claim'; end if;
  select public.orkto_finish_payment_webhook_event('test','readiness-event-01',repeat('c',64),claim_token,'processed',null) into finish_ok;
  if not finish_ok then raise exception 'Active webhook claim could not be completed'; end if;
  select c.decision into decision from public.orkto_claim_payment_webhook_event('test','readiness-event-01','PAYMENT_RECEIVED',repeat('c',64),now()) c;
  if decision<>'DUPLICATE' then raise exception 'Processed webhook retry was not deduplicated'; end if;

  insert into public.orkto_conversations(user_id,workspace_id,contact_name,contact_phone,status,source_channel)
  values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Ledger test','+550000000001','active','manual')
  returning id into conversation_id;
  select c.decision,c.send_request_id,c.send_status into decision,send_id,send_status
    from public.orkto_reserve_channel_send('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',conversation_id,'manual','test-channel','readiness-send-01',repeat('e',64)) c;
  if decision<>'RESERVED' or send_id is null or send_status<>'PREPARED' then raise exception 'Channel send reservation failed'; end if;
  select c.decision into decision from public.orkto_reserve_channel_send('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',conversation_id,'manual','test-channel','readiness-send-01',repeat('e',64)) c;
  if decision<>'IN_PROGRESS' then raise exception 'Duplicate channel send was not held'; end if;
  select public.orkto_mark_channel_send('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',send_id,'REQUEST_ACCEPTED','provider-message-1',null,now()) into receipt_result;
  if receipt_result<>'APPLIED' then raise exception 'Channel request acceptance was not persisted'; end if;
  select public.orkto_record_channel_delivery_event('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',send_id,'test-channel','delivery-event-1',repeat('f',64),'provider-message-1','DELIVERED',now(),null) into receipt_result;
  if receipt_result<>'APPLIED' then raise exception 'Provider delivery receipt was not persisted'; end if;
  select public.orkto_record_channel_delivery_event('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',send_id,'test-channel','delivery-event-1',repeat('f',64),'provider-message-1','DELIVERED',now(),null) into receipt_result;
  if receipt_result<>'DUPLICATE' then raise exception 'Duplicate provider receipt was not deduplicated'; end if;
  select public.orkto_record_channel_delivery_event('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',send_id,'test-channel','delivery-event-old',repeat('1',64),'provider-message-1','FAILED',now()-interval '1 day','provider_transient') into receipt_result;
  if receipt_result<>'STALE_IGNORED' then raise exception 'Out-of-order delivery receipt was not ignored'; end if;
  if (select status from public.orkto_channel_send_requests where id=send_id)<>'DELIVERED' then raise exception 'Out-of-order provider receipt downgraded DELIVERED'; end if;
end $$;

rollback;
