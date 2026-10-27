-- Disposable local PostgreSQL fixture only; no provider calls; all rows rolled back.
begin;
do $$
declare a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 c uuid:=gen_random_uuid(); claim record; r record; send_id uuid:=gen_random_uuid(); result text; fn regprocedure;
begin
 foreach fn in array array[
  'public.orkto_ingest_meta_unsupported_message(uuid,text,uuid,text,text,text,timestamptz)'::regprocedure,
  'public.orkto_record_meta_receipt(uuid,uuid,text,text,text,text,timestamptz)'::regprocedure
 ] loop
  if has_function_privilege('anon',fn,'EXECUTE') or has_function_privilege('authenticated',fn,'EXECUTE')
   or not has_function_privilege('service_role',fn,'EXECUTE') then raise exception 'Meta states ACL mismatch'; end if;
 end loop;
 insert into public.orkto_channel_connections(id,workspace_id,provider,status,waba_id,phone_number_id,token_secret_id,verified_at,connected_by)
 values(c,a,'meta_whatsapp_cloud','connected','98765432101','98765432102',gen_random_uuid(),now(),a);
 select * into claim from public.orkto_claim_meta_webhook_event('98765432102','98765432101','message:unsupported',repeat('a',64),'message',now());
 select * into r from public.orkto_ingest_meta_unsupported_message(c,'message:unsupported',gen_random_uuid(),'wamid.unsupported','5511999990000','audio',now());
 if r.decision<>'EVENT_NOT_CLAIMED' then raise exception 'Foreign claim accepted'; end if;
 select * into r from public.orkto_ingest_meta_unsupported_message(c,'message:unsupported',claim.claim_token,'wamid.unsupported','5511999990000','audio',now());
 if r.decision<>'APPLIED' or not exists(select 1 from public.orkto_messages m where m.id=r.message_id and m.workspace_id=a
  and m.message_type='audio' and m.metadata->>'content_state'='unsupported' and m.metadata->>'content_processed'='false') then
   raise exception 'Unsupported inbound content not explicitly persisted'; end if;
 if exists(select 1 from public.orkto_messages m where m.external_event_id='wamid.unsupported' and m.workspace_id=b) then raise exception 'Cross tenant write'; end if;
 perform public.orkto_ingest_meta_unsupported_message(c,'message:unsupported',claim.claim_token,'wamid.unsupported','5511999990000','audio',now());
 if (select count(*) from public.orkto_messages where external_event_id='wamid.unsupported')<>1 then raise exception 'Duplicate unsupported message'; end if;
 insert into public.orkto_channel_send_requests(id,workspace_id,conversation_id,channel,provider,idempotency_key,request_fingerprint,status,provider_message_id)
 values(send_id,a,r.conversation_id,'whatsapp','meta_whatsapp_cloud','synthetic-receipt',repeat('b',64),'REQUEST_ACCEPTED','wamid.receipt');
 insert into public.orkto_messages(workspace_id,conversation_id,sender_role,content,message_type,direction,external_event_id,sent_at,metadata)
 values(a,r.conversation_id,'operator','Synthetic reply','text','outgoing','wamid.receipt',now(),jsonb_build_object('provider','meta_whatsapp_cloud','send_request_id',send_id));
 result:=public.orkto_record_meta_receipt(b,send_id,'receipt:foreign',repeat('c',64),'wamid.receipt','read',now());
 if result<>'NOT_FOUND' then raise exception 'Foreign receipt accepted'; end if;
 result:=public.orkto_record_meta_receipt(a,send_id,'receipt:read',repeat('d',64),'wamid.receipt','read',now());
 if result<>'APPLIED' then raise exception 'Read receipt not applied'; end if;
 perform public.orkto_record_meta_receipt(a,send_id,'receipt:delivered',repeat('e',64),'wamid.receipt','delivered',now()+interval '1 second');
 if not exists(select 1 from public.orkto_messages where external_event_id='wamid.receipt' and metadata->>'provider_receipt_status'='read') then
   raise exception 'Read receipt regressed'; end if;
 if (select count(*) from public.orkto_channel_send_requests where id=send_id)<>1 then raise exception 'Receipt created send'; end if;
 select * into claim from public.orkto_claim_meta_webhook_event('98765432102','98765432101','message:unknown',repeat('f',64),'message',now());
 perform public.orkto_ingest_meta_unsupported_message(c,'message:unknown',claim.claim_token,'wamid.unknown','5511999990000','unknown',now());
 if not exists(select 1 from public.orkto_messages where external_event_id='wamid.unknown' and direction='internal' and sender_role='system')
  or exists(select 1 from public.orkto_whatsapp_usage_events where provider_message_id='wamid.unknown') then
  raise exception 'Unknown notification opened customer service window'; end if;
end $$;
rollback;
