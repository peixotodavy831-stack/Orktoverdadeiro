-- Bind a WIA request to its original input and persist replay data atomically.
-- No new browser grants, policy changes, secrets, or model input text stored.
alter table public.orkto_wia_runs add column if not exists request_fingerprint text;
alter table public.orkto_wia_runs add column if not exists runtime_response jsonb;

create or replace function public.orkto_wia_claim_request(
  p_actor_user_id uuid,p_workspace_id uuid,p_trace_id uuid,p_agent text,
  p_request_id uuid,p_monthly_limit numeric,p_fingerprint text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_run public.orkto_wia_runs%rowtype;
begin
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'ORKTO_VALIDATION_FAILED' using errcode='P0001';
  end if;
  v_result:=public.orkto_wia_start_command(p_actor_user_id,p_workspace_id,p_trace_id,p_agent,p_request_id,p_monthly_limit);
  select * into v_run from public.orkto_wia_runs
    where workspace_id=p_workspace_id and trace_id=p_trace_id::text for update;
  if v_result->>'result'='STARTED' then
    update public.orkto_wia_runs set request_fingerprint=p_fingerprint where id=v_run.id;
  elsif v_run.request_fingerprint is distinct from p_fingerprint then
    raise exception 'ORKTO_IDEMPOTENCY_CONFLICT' using errcode='P0001';
  end if;
  return v_result || jsonb_build_object('runtime_response',v_run.runtime_response);
end $$;

create or replace function public.orkto_wia_finish_request(
  p_actor_user_id uuid,p_workspace_id uuid,p_trace_id uuid,p_agent text,
  p_status text,p_payload jsonb,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_run public.orkto_wia_runs%rowtype;
begin
  -- Completion RPC checks active membership, actor, agent and locks the run.
  -- Require a claimed request; legacy runs cannot acquire trusted replay data.
  select * into v_run from public.orkto_wia_runs
    where workspace_id=p_workspace_id and trace_id=p_trace_id::text for update;
  if v_run.id is null or v_run.request_fingerprint is null then
    raise exception 'ORKTO_NOT_FOUND' using errcode='P0001';
  end if;
  v_result:=public.orkto_wia_complete_command(p_actor_user_id,p_workspace_id,p_trace_id,p_agent,p_status,p_payload,p_request_id);
  if v_result->>'result' <> 'REPLAY' then
    update public.orkto_wia_runs set runtime_response=p_payload where id=v_run.id;
  end if;
  return v_result;
end $$;

revoke all on function public.orkto_wia_claim_request(uuid,uuid,uuid,text,uuid,numeric,text) from public,anon,authenticated;
grant execute on function public.orkto_wia_claim_request(uuid,uuid,uuid,text,uuid,numeric,text) to service_role;
revoke all on function public.orkto_wia_finish_request(uuid,uuid,uuid,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.orkto_wia_finish_request(uuid,uuid,uuid,text,text,jsonb,uuid) to service_role;
