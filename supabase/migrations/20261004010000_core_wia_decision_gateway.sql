-- Approval and rejection are workspace-scoped commands. Approval can create only
-- an internal review task. It never sends a message or calls a provider.
create or replace function public.orkto_wia_decide_command(
  p_actor_user_id uuid, p_workspace_id uuid, p_action_id uuid, p_decision text,
  p_request_id uuid, p_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_action public.orkto_wia_actions%rowtype;
  v_task public.orkto_tasks%rowtype;
  v_title text;
  v_description text;
  v_customer_ref text;
  v_result jsonb;
begin
  if p_actor_user_id is null or p_workspace_id is null or p_action_id is null or p_request_id is null
     or p_decision is null or p_decision not in ('APPROVE','REJECT') or length(coalesce(p_reason,'')) > 500 then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;
  if not exists (select 1 from public.orkto_workspace_members m
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id and m.status='active'
      and m.role in ('owner','admin','manager')) then
    raise exception 'ORKTO_PERMISSION_DENIED' using errcode='P0001';
  end if;
  select * into v_action from public.orkto_wia_actions
    where workspace_id=p_workspace_id and id=p_action_id for update;
  if v_action.id is null then raise exception 'ORKTO_NOT_FOUND' using errcode='P0001'; end if;
  if (p_decision='APPROVE' and v_action.status='executed')
     or (p_decision='REJECT' and v_action.status='rejected') then
    return jsonb_build_object('result','REPLAY','action',to_jsonb(v_action));
  end if;
  if v_action.status<>'awaiting_approval' or not v_action.requires_approval then
    raise exception 'ORKTO_CONFLICT' using errcode='P0001';
  end if;
  if p_decision='APPROVE' then
    if v_action.action_type in ('send_proposal_followup','prepare_repurchase_followup','prepare_collection_contact') then
      v_title := case v_action.action_type
        when 'send_proposal_followup' then 'Revisar follow-up da proposta'
        when 'prepare_collection_contact' then 'Revisar contato de cobrança preparado pela WIA'
        else 'Revisar contato de recompra' end;
      v_description := coalesce(nullif(btrim(v_action.payload->>'messageDraft'),''),'A mensagem precisa ser redigida antes do envio.');
      v_customer_ref := coalesce(nullif(v_action.payload->>'customerPhone',''),nullif(v_action.payload->>'customerRef',''));
    elsif v_action.action_type='create_task' then
      v_title := btrim(coalesce(v_action.payload->>'title',''));
      v_description := coalesce(v_action.payload->>'description','');
      v_customer_ref := nullif(v_action.payload->>'customerRef','');
      if length(v_title) not between 1 and 180 or length(v_description)>4000 then
        raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
      end if;
    elsif v_action.action_type='request_approval' then
      v_title := 'Revisar ação preparada pela WIA';
      v_description := btrim(coalesce(v_action.payload->>'messageDraft',''));
      if v_description='' then raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001'; end if;
    else
      raise exception 'ORKTO_CONFIGURATION_REQUIRED' using errcode='P0001';
    end if;
    if length(v_description)>4000 or length(coalesce(v_customer_ref,''))>200 then
      raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
    end if;
    insert into public.orkto_tasks
      (workspace_id,customer_ref,title,description,status,source,idempotency_key,created_by)
    values(p_workspace_id,v_customer_ref,v_title,v_description,'open','wia','approved-action:'||p_action_id,p_actor_user_id)
    on conflict(workspace_id,idempotency_key) do nothing returning * into v_task;
    if v_task.id is null then
      select * into v_task from public.orkto_tasks
        where workspace_id=p_workspace_id and idempotency_key='approved-action:'||p_action_id;
    end if;
    if v_task.id is null then raise exception 'ORKTO_CONFLICT' using errcode='P0001'; end if;
    v_result := jsonb_build_object('taskId',v_task.id,'execution','internal_task_created',
      'externalDelivery',case when v_action.action_type='prepare_collection_contact'
        then 'CONFIGURATION_REQUIRED' else 'not_sent_channel_not_configured' end);
    update public.orkto_wia_actions set status='executed',approved_by=p_actor_user_id,
      approved_at=now(),executed_at=now(),result=v_result,updated_at=now()
      where id=p_action_id and workspace_id=p_workspace_id returning * into v_action;
  else
    v_result := jsonb_build_object('rejectionReason',coalesce(p_reason,''));
    update public.orkto_wia_actions set status='rejected',approved_by=p_actor_user_id,
      approved_at=now(),result=v_result,updated_at=now()
      where id=p_action_id and workspace_id=p_workspace_id returning * into v_action;
  end if;
  insert into public.orkto_wia_events
    (workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,idempotency_key,payload)
  values(p_workspace_id,p_actor_user_id,case when p_decision='APPROVE' then 'wia.action.approved_and_executed' else 'wia.action.rejected' end,
    'user','wia_action',p_action_id::text,'core:wia:decision:'||p_action_id,
    jsonb_build_object('request_id',p_request_id,'result',v_result));
  return jsonb_build_object('result',case when p_decision='APPROVE' then 'EXECUTED' else 'REJECTED' end,
    'action',to_jsonb(v_action),'external_delivery',v_result->>'externalDelivery');
end;
$$;

revoke all on function public.orkto_wia_decide_command(uuid,uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.orkto_wia_decide_command(uuid,uuid,uuid,text,uuid,text) to service_role;
