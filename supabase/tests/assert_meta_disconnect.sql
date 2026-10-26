-- Disposable fixture only, no live provider or token retrieval.
begin;
do $$
declare
 a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 conn uuid:=gen_random_uuid(); thread uuid:=gen_random_uuid(); sending uuid:=gen_random_uuid();
begin
 insert into public.orkto_channel_connections(id,workspace_id,provider,status,waba_id,phone_number_id,token_secret_id,verified_at,connected_by)
 values(conn,a,'meta_whatsapp_cloud','connected','999999991','999999992',gen_random_uuid(),now(),a);
 insert into public.orkto_whatsapp_controls(workspace_id,connection_id,updated_by)values(a,conn,a);
 begin
  perform public.orkto_disconnect_meta_connection(a,b);
  raise exception 'Cross-tenant disconnect was allowed';
 exception when insufficient_privilege then null;end;
 insert into public.orkto_conversations(id,user_id,workspace_id,contact_name,contact_phone,status,source_channel)
 values(thread,a,a,'Synthetic','5511999990011','active','whatsapp');
 insert into public.orkto_channel_send_requests(id,workspace_id,conversation_id,channel,provider,idempotency_key,request_fingerprint,status)
 values(sending,a,thread,'whatsapp','meta_whatsapp_cloud','disconnect-fixture',repeat('c',64),'QUEUED');
 if public.orkto_disconnect_meta_connection(a,a)<>'RECONCILIATION_REQUIRED' then raise exception 'Pending send abandoned';end if;
 if (select status from public.orkto_channel_connections where id=conn)<>'connected' then raise exception 'Blocked operation mutated connection';end if;
 update public.orkto_channel_send_requests set status='FAILED' where id=sending;
 if public.orkto_disconnect_meta_connection(a,a)<>'DISCONNECTED' then raise exception 'Disconnect failed';end if;
 if public.orkto_disconnect_meta_connection(a,a)<>'REPLAY' then raise exception 'Disconnect not idempotent';end if;
 if public.orkto_read_meta_token(conn) is not null then raise exception 'Revoked token remained accessible';end if;
 if not (select human_takeover from public.orkto_whatsapp_controls where workspace_id=a) then raise exception 'Takeover not enabled';end if;
 if (select count(*) from public.orkto_audit_log where workspace_id=a and event_type='channel.meta.disconnected')<>1 then raise exception 'Audit not exactly once';end if;
 if has_function_privilege('anon','public.orkto_disconnect_meta_connection(uuid,uuid)','EXECUTE')
  or has_function_privilege('authenticated','public.orkto_disconnect_meta_connection(uuid,uuid)','EXECUTE') then raise exception 'Disconnect RPC exposed';end if;
end $$;
rollback;
