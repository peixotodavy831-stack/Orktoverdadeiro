-- Atomic WIA preparation lifecycle. Browser and Vercel runtimes cannot execute
-- these functions; the authenticated mutation Edge Function is the only caller.
create or replace function public.orkto_wia_start_command(
  p_actor_user_id uuid, p_workspace_id uuid, p_trace_id uuid, p_agent text,
  p_request_id uuid, p_monthly_limit numeric default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_run public.orkto_wia_runs%rowtype;
  v_usage record;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_trace_id is null or p_request_id is null
     or p_agent not in ('qualification_agent','sales_agent','objection_agent','followup_agent',
       'recovery_agent','collection_agent','risk_agent','reporting_agent','customer_success_agent')
     or (p_monthly_limit is not null and (p_monthly_limit < 0 or trunc(p_monthly_limit) <> p_monthly_limit)) then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;
  if not exists(select 1 from public.orkto_workspace_members m
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id and m.status='active'
      and m.role in ('owner','admin','manager','member')) then
    raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001';
  end if;

  insert into public.orkto_wia_runs
    (workspace_id,user_id,feature,agent,task_type,status,trace_id,context_refs,started_at)
  values(p_workspace_id,p_actor_user_id,'wia_contact',p_agent,'standard','running',p_trace_id::text,'[]'::jsonb,now())
  on conflict(workspace_id,trace_id) do nothing returning * into v_run;

  if v_run.id is null then
    select * into v_run from public.orkto_wia_runs
      where workspace_id=p_workspace_id and trace_id=p_trace_id::text for update;
    if v_run.id is null or v_run.user_id is distinct from p_actor_user_id or v_run.agent is distinct from p_agent then
      raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    return jsonb_build_object('result','REPLAY','wia_run_id',v_run.id,'status',v_run.status);
  end if;

  select * into v_usage from public.orkto_consume_plan_usage(
    p_workspace_id,date_trunc('month',now())::date,'monthly_wia_runs',1,p_monthly_limit);
  if not coalesce(v_usage.allowed,false) then
    raise exception 'ORKTO_RATE_LIMITED' using errcode='P0001';
  end if;
  insert into public.orkto_wia_events
    (workspace_id,run_id,actor_user_id,event_type,source,entity_type,entity_ref,idempotency_key,payload)
  values(p_workspace_id,v_run.id,p_actor_user_id,'wia.run.started','user','wia_run',v_run.id::text,
    'wia-start:'||p_trace_id,jsonb_build_object('request_id',p_request_id,'agent',p_agent));
  return jsonb_build_object('result','STARTED','wia_run_id',v_run.id,'status',v_run.status);
end;
$$;

create or replace function public.orkto_wia_complete_command(
  p_actor_user_id uuid, p_workspace_id uuid, p_trace_id uuid, p_agent text,
  p_status text, p_payload jsonb, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_run public.orkto_wia_runs%rowtype;
  v_decision jsonb;
  v_usage jsonb;
  v_tool jsonb;
  v_action public.orkto_wia_actions%rowtype;
  v_context_refs jsonb;
  v_path text;
  v_mode text;
  v_confidence numeric;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_trace_id is null or p_request_id is null
     or p_status not in ('succeeded','failed') or p_payload is null or jsonb_typeof(p_payload)<>'object'
     or p_agent not in ('qualification_agent','sales_agent','objection_agent','followup_agent',
       'recovery_agent','collection_agent','risk_agent','reporting_agent','customer_success_agent') then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;
  if not exists(select 1 from public.orkto_workspace_members m
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id and m.status='active'
      and m.role in ('owner','admin','manager','member')) then
    raise exception 'ORKTO_WORKSPACE_ACCESS_DENIED' using errcode='P0001';
  end if;
  select * into v_run from public.orkto_wia_runs
    where workspace_id=p_workspace_id and trace_id=p_trace_id::text for update;
  if v_run.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
  if v_run.user_id is distinct from p_actor_user_id or v_run.agent is distinct from p_agent then
    raise exception 'ORKTO_PERMISSION_DENIED' using errcode='P0001';
  end if;
  if v_run.status<>'running' then
    if v_run.status=p_status then
      select * into v_action from public.orkto_wia_actions
        where workspace_id=p_workspace_id and run_id=v_run.id order by created_at limit 1;
      return jsonb_build_object('result','REPLAY','wia_run_id',v_run.id,'action_id',v_action.id,'status',v_run.status);
    end if;
    raise exception 'ORKTO_CONFLICT' using errcode='P0001';
  end if;

  if p_status='failed' then
    if jsonb_typeof(p_payload->'errorCategory')<>'string' or length(p_payload->>'errorCategory') not between 1 and 100 then
      raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
    end if;
    update public.orkto_wia_runs set status='failed',error_category=p_payload->>'errorCategory',completed_at=now()
      where id=v_run.id returning * into v_run;
    insert into public.orkto_wia_events
      (workspace_id,run_id,actor_user_id,event_type,source,entity_type,entity_ref,idempotency_key,payload)
    values(p_workspace_id,v_run.id,p_actor_user_id,'wia.run.failed','wia','wia_run',v_run.id::text,
      'wia-complete:'||p_trace_id,jsonb_build_object('request_id',p_request_id,'error_category',p_payload->>'errorCategory'));
    insert into public.orkto_audit_log
      (user_id,workspace_id,event_type,actor_type,actor_id,trace_id,event_data)
    values(p_actor_user_id,p_workspace_id,'wia.run.failed','bot','wia',p_trace_id::text,
      jsonb_build_object('run_id',v_run.id,'error_category',p_payload->>'errorCategory','request_id',p_request_id));
    return jsonb_build_object('result','FAILED','wia_run_id',v_run.id,'status',v_run.status);
  end if;

  v_decision:=p_payload->'decision'; v_usage:=p_payload->'usage';
  v_context_refs:=p_payload->'contextRefs'; v_path:=p_payload->>'path'; v_mode:=p_payload->>'mode';
  if jsonb_typeof(v_decision)<>'object' or jsonb_typeof(v_usage)<>'object'
     or jsonb_typeof(v_context_refs)<>'array' or jsonb_typeof(p_payload->'toolExecutions')<>'array'
     or v_path not in ('t0','model') or v_mode not in ('live','simulated') then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;
  v_confidence:=case v_decision->>'confidenceSignal' when 'high' then 0.9 when 'medium' then 0.65 else 0.3 end;
  update public.orkto_wia_runs set status='succeeded',task_type=v_usage->>'taskType',provider=v_usage->>'provider',
    model=v_usage->>'model',context_refs=v_context_refs,summary=v_decision->>'messageDraft',error_category=null,completed_at=now()
    where id=v_run.id returning * into v_run;

  insert into public.orkto_wia_events
    (workspace_id,run_id,actor_user_id,event_type,source,entity_type,entity_ref,idempotency_key,payload)
  values(p_workspace_id,v_run.id,p_actor_user_id,'wia.decision.prepared','wia','wia_run',v_run.id::text,
    'wia-complete:'||p_trace_id,jsonb_build_object('request_id',p_request_id,'action',v_decision->>'action',
      'requires_approval',(v_decision->>'requiresApproval')::boolean,'agent',p_agent,'reason_code',v_decision->>'reasonCode'));

  if v_path='model' then
    insert into public.orkto_model_usage
      (user_id,workspace_id,trace_id,provider,model,prompt_tokens,cached_input_tokens,completion_tokens,total_tokens,
       latency_ms,mode,task_class,feature,gateway,billing_period_start)
    values(p_actor_user_id,p_workspace_id,p_trace_id::text,v_usage->>'provider',v_usage->>'model',
      (v_usage->>'promptTokens')::integer,(v_usage->>'cachedInputTokens')::integer,
      (v_usage->>'completionTokens')::integer,(v_usage->>'totalTokens')::integer,
      (v_usage->>'latencyMs')::integer,v_mode,v_usage->>'taskType','wia',v_usage->>'gateway',date_trunc('month',now())::date)
    on conflict(user_id,trace_id) do nothing;
  end if;
  for v_tool in select value from jsonb_array_elements(p_payload->'toolExecutions') loop
    insert into public.orkto_wia_tool_calls
      (workspace_id,run_id,tool_name,status,output_summary,error_category,duration_ms)
    values(p_workspace_id,v_run.id,v_tool->>'toolName',v_tool->>'status',
      jsonb_build_object('sourceIds',coalesce(v_tool->'sourceIds','[]'::jsonb)),
      nullif(v_tool#>>'{error,code}',''),(v_tool->>'durationMs')::integer);
  end loop;
  if v_decision->>'action' not in ('answer','ask_clarification') then
    insert into public.orkto_wia_actions
      (workspace_id,run_id,action_type,payload,rationale,risk_level,confidence,status,requires_approval,idempotency_key,created_by)
    values(p_workspace_id,v_run.id,v_decision->>'action',
      jsonb_build_object('messageDraft',v_decision->>'messageDraft','sourceIds',v_decision->'sourceIds'),
      v_decision->>'reasonCode',case when (v_decision->>'requiresApproval')::boolean then 'medium' else 'low' end,
      v_confidence,case when (v_decision->>'requiresApproval')::boolean then 'awaiting_approval' else 'prepared' end,
      (v_decision->>'requiresApproval')::boolean,'wia-action:'||p_trace_id,p_actor_user_id)
    returning * into v_action;
  end if;
  insert into public.orkto_audit_log
    (user_id,workspace_id,event_type,actor_type,actor_id,trace_id,event_data)
  values(p_actor_user_id,p_workspace_id,'wia.decision.proposed','bot','wia',p_trace_id::text,
    jsonb_build_object('run_id',v_run.id,'action_id',v_action.id,'action',v_decision->>'action',
      'requires_approval',(v_decision->>'requiresApproval')::boolean,'mode',v_mode,'path',v_path,
      'provider',v_usage->>'provider','model',v_usage->>'model','request_id',p_request_id));
  return jsonb_build_object('result','COMPLETED','wia_run_id',v_run.id,'action_id',v_action.id,'status',v_run.status);
end;
$$;

revoke all on function public.orkto_wia_start_command(uuid,uuid,uuid,text,uuid,numeric) from public,anon,authenticated;
grant execute on function public.orkto_wia_start_command(uuid,uuid,uuid,text,uuid,numeric) to service_role;
revoke all on function public.orkto_wia_complete_command(uuid,uuid,uuid,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.orkto_wia_complete_command(uuid,uuid,uuid,text,text,jsonb,uuid) to service_role;
