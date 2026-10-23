-- PostgreSQL 17 disposable fixture only. Never apply to linked/remote databases.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('97500000-0000-4000-8000-000000000001','recovery-a@example.invalid','{}'),
 ('97500000-0000-4000-8000-000000000002','recovery-b@example.invalid','{}'),
 ('97500000-0000-4000-8000-000000000003','recovery-member@example.invalid','{}');
insert into public.orkto_workspace_members(workspace_id,user_id,role,status)
 values('97500000-0000-4000-8000-000000000001','97500000-0000-4000-8000-000000000003','member','active');

do $$
declare
 a uuid:='97500000-0000-4000-8000-000000000001';
 b uuid:='97500000-0000-4000-8000-000000000002';
 m uuid:='97500000-0000-4000-8000-000000000003';
 q uuid:=gen_random_uuid();trace uuid:=gen_random_uuid();request uuid:=gen_random_uuid();
 action_id uuid; rejected_id uuid; task_id uuid; r jsonb; payload jsonb;
begin
 insert into public.quotes(id,user_id,workspace_id,quote_number,client_name,client_phone,status,sent_at,total)
 values(q,a,a,'R2-fixture','Synthetic recovery','00000000000','sent',now()-interval '72 hours',100);
 payload:=jsonb_build_object('contextRefs',jsonb_build_array('quote:'||q),'path','t0','mode','live',
 'decision',jsonb_build_object('action','send_proposal_followup','messageDraft','Revisar proposta sintética; somente tarefa interna.',
 'sourceIds',jsonb_build_array('quote:'||q),'requiresApproval',true,'confidenceSignal','high','reasonCode','playbook_proposal_recovery_r1'),
 'usage',jsonb_build_object('provider','none','model','t0-deterministic','taskType','fast','promptTokens',0,'completionTokens',0,'totalTokens',0),
 'toolExecutions',jsonb_build_array(jsonb_build_object('toolName','prepare_proposal_recovery','status','succeeded','sourceIds',jsonb_build_array('quote:'||q),'durationMs',0)));
 perform public.orkto_wia_claim_request(a,a,trace,'sales_agent',request,10,repeat('c',64));
 r:=public.orkto_wia_finish_request(a,a,trace,'sales_agent','succeeded',payload,request);
 action_id:=(r->>'action_id')::uuid;
 if action_id is null or not exists(select 1 from public.orkto_wia_actions where id=action_id and workspace_id=a and status='awaiting_approval' and requires_approval) then raise exception 'No approval persisted';end if;
 if exists(select 1 from public.orkto_tasks where workspace_id=a) then raise exception 'Task created before approval';end if;
 begin
  perform public.orkto_wia_decide_command(b,b,action_id,'APPROVE',request,null);
  raise exception 'Cross tenant action accepted';
 exception when sqlstate 'P0001' then if sqlerrm<>'ORKTO_NOT_FOUND' then raise;end if;end;
 begin
  perform public.orkto_wia_decide_command(m,a,action_id,'APPROVE',request,null);
  raise exception 'Member approved task';
 exception when sqlstate 'P0001' then if sqlerrm<>'ORKTO_PERMISSION_DENIED' then raise;end if;end;
 r:=public.orkto_wia_decide_command(a,a,action_id,'APPROVE',request,null);
 if r->>'result'<>'EXECUTED' then raise exception 'Approval not executed';end if;
 select id into task_id from public.orkto_tasks where workspace_id=a and idempotency_key='approved-action:'||action_id;
 if task_id is null then raise exception 'Internal task missing';end if;
 if not exists(select 1 from public.orkto_wia_actions where id=action_id and result->>'execution'='internal_task_created' and result->>'taskId'=task_id::text) then raise exception 'False task acknowledgment';end if;
 r:=public.orkto_wia_decide_command(a,a,action_id,'APPROVE',gen_random_uuid(),null);
 if r->>'result'<>'REPLAY' or (select count(*) from public.orkto_tasks where workspace_id=a)<>1 then raise exception 'Duplicate task';end if;
 if (select count(*) from public.orkto_wia_events where workspace_id=a and event_type='wia.action.approved_and_executed')<>1 then raise exception 'Decision audit not exactly once';end if;
 if (select count(*) from public.orkto_audit_log where workspace_id=a and event_type='wia.decision.proposed')<>1 then raise exception 'Preparation audit missing';end if;
 if exists(select 1 from public.orkto_model_usage where workspace_id=a) then raise exception 'Deterministic preparation billed as model';end if;
 trace:=gen_random_uuid();
 perform public.orkto_wia_claim_request(a,a,trace,'sales_agent',request,10,repeat('d',64));
 r:=public.orkto_wia_finish_request(a,a,trace,'sales_agent','succeeded',payload,request);rejected_id:=(r->>'action_id')::uuid;
 perform public.orkto_wia_decide_command(a,a,rejected_id,'REJECT',request,'Fixture rejection');
 if (select count(*) from public.orkto_tasks where workspace_id=a)<>1 then raise exception 'Rejection created task';end if;
 begin
  perform public.orkto_wia_decide_command(a,a,rejected_id,'APPROVE',request,null);
  raise exception 'Rejected action later approved';
 exception when sqlstate 'P0001' then if sqlerrm<>'ORKTO_CONFLICT' then raise;end if;end;
 update public.orkto_workspace_members set status='suspended' where workspace_id=a and user_id=a;
 begin
  perform public.orkto_wia_decide_command(a,a,action_id,'APPROVE',request,null);
  raise exception 'Suspended actor replay allowed';
 exception when sqlstate 'P0001' then if sqlerrm<>'ORKTO_PERMISSION_DENIED' then raise;end if;end;
end $$;

-- RLS reads are executed as the browser role, never as the database owner.
select set_config('request.jwt.claim.sub','97500000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.orkto_tasks where workspace_id='97500000-0000-4000-8000-000000000001') then raise exception 'Task RLS leak';end if;
 if exists(select 1 from public.quotes where workspace_id='97500000-0000-4000-8000-000000000001') then raise exception 'Quote RLS leak';end if;
end $$;
reset role;
rollback;
