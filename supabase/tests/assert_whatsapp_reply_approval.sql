-- Disposable PostgreSQL only: prove durable WIA approval with no external send.
begin;
do $$
declare
 a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 conversation uuid:=gen_random_uuid(); inbound uuid:=gen_random_uuid(); trace uuid:=gen_random_uuid(); request uuid:=gen_random_uuid();
 payload jsonb; result jsonb; action_id uuid; task_count bigint; message_count bigint; send_count bigint; pulso_count bigint;
begin
 insert into public.orkto_conversations(id,user_id,workspace_id,contact_name,contact_phone,status,source_channel)
 values(conversation,a,a,'Synthetic','5511999990012','active','whatsapp');
 insert into public.orkto_messages(id,workspace_id,conversation_id,sender_role,content,message_type,direction,sent_at)
 values(inbound,a,conversation,'contact','Synthetic incoming evidence','text','incoming',now());
 select count(*) into task_count from public.orkto_tasks;
 select count(*) into message_count from public.orkto_messages;
 select count(*) into send_count from public.orkto_channel_send_requests;
 select count(*) into pulso_count from public.orkto_pulso_ledger;
 payload:=jsonb_build_object('contextRefs',jsonb_build_array('conversation:'||conversation,'message:'||inbound),'path','t0','mode','live',
  'decision',jsonb_build_object('action','request_approval','messageDraft','Resposta determinística sintética para revisão.',
   'sourceIds',jsonb_build_array('conversation:'||conversation,'message:'||inbound),'requiresApproval',true,'confidenceSignal','high','reasonCode','deterministic_whatsapp_reply_review'),
  'usage',jsonb_build_object('provider','none','model','t0-deterministic','taskType','fast','promptTokens',0,'completionTokens',0,'totalTokens',0),
  'toolExecutions',jsonb_build_array(jsonb_build_object('toolName','prepare_whatsapp_reply','status','succeeded','sourceIds',jsonb_build_array('conversation:'||conversation,'message:'||inbound),'durationMs',0)));
 perform public.orkto_wia_claim_request(a,a,trace,'sales_agent',request,10,repeat('b',64));
 result:=public.orkto_wia_finish_request(a,a,trace,'sales_agent','succeeded',payload,request);
 action_id:=(result->>'action_id')::uuid;
 if action_id is null or not exists(select 1 from public.orkto_wia_actions where id=action_id and workspace_id=a and status='awaiting_approval' and requires_approval) then raise exception 'Reply approval missing';end if;
 if (select count(*) from public.orkto_tasks)<>task_count then raise exception 'Task created before approval';end if;
 begin
  perform public.orkto_wia_decide_command(b,b,action_id,'APPROVE',request,null);
  raise exception 'Foreign workspace approved reply';
 exception when sqlstate 'P0001' then if sqlerrm<>'ORKTO_NOT_FOUND' then raise;end if;end;
 perform public.orkto_wia_decide_command(a,a,action_id,'APPROVE',request,null);
 perform public.orkto_wia_decide_command(a,a,action_id,'APPROVE',request,null);
 if (select count(*) from public.orkto_tasks)<>task_count+1 then raise exception 'Approval not exactly once';end if;
 if (select count(*) from public.orkto_messages)<>message_count
  or (select count(*) from public.orkto_channel_send_requests)<>send_count
  or (select count(*) from public.orkto_pulso_ledger)<>pulso_count then raise exception 'Approval sent message or consumed Pulso';end if;
end $$;
rollback;
