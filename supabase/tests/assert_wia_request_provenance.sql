-- Disposable PostgreSQL fixture only. No real user data retained.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('96000000-0000-4000-8000-000000000001','wia-a@example.invalid','{}'),
 ('96000000-0000-4000-8000-000000000002','wia-b@example.invalid','{}');
do $$
declare a uuid:='96000000-0000-4000-8000-000000000001';
 b uuid:='96000000-0000-4000-8000-000000000002';
 trace uuid:=gen_random_uuid();request uuid:=gen_random_uuid();r jsonb;n int;fn text;
 payload jsonb:='{"contextRefs":[],"path":"model","mode":"live","decision":{"action":"ask_clarification","messageDraft":"Qual contexto?","sourceIds":[],"confidenceSignal":"low","requiresApproval":false,"reasonCode":"needs_context"},"usage":{"provider":"gemini","model":"fixture-only","taskType":"standard","promptTokens":30,"cachedInputTokens":0,"completionTokens":20,"totalTokens":55,"latencyMs":15,"gateway":"supabase-edge-google-direct"},"toolExecutions":[]}';
begin
 foreach fn in array array['public.orkto_wia_claim_request(uuid,uuid,uuid,text,uuid,numeric,text)',
 'public.orkto_wia_finish_request(uuid,uuid,uuid,text,text,jsonb,uuid)'] loop
   if has_function_privilege('anon',fn,'EXECUTE') or has_function_privilege('authenticated',fn,'EXECUTE')
     or not has_function_privilege('service_role',fn,'EXECUTE') then raise exception 'WIA request ACL mismatch';end if;
 end loop;
 r:=public.orkto_wia_claim_request(a,a,trace,'sales_agent',request,10,repeat('a',64));
 if r->>'result'<>'STARTED' then raise exception 'Initial claim failed';end if;
 r:=public.orkto_wia_claim_request(a,a,trace,'sales_agent',request,10,repeat('a',64));
 if r->>'result'<>'REPLAY' or r->>'status'<>'running' then raise exception 'Running replay mismatch';end if;
 begin
   perform public.orkto_wia_claim_request(a,a,trace,'sales_agent',request,10,repeat('b',64));
   raise exception 'Changed request accepted';
 exception when sqlstate 'P0001' then if sqlerrm<>'ORKTO_IDEMPOTENCY_CONFLICT' then raise;end if;end;
 begin
   perform public.orkto_wia_finish_request(b,a,trace,'sales_agent','succeeded',payload,request);
   raise exception 'Foreign actor accepted';
 exception when sqlstate 'P0001' then if sqlerrm<>'ORKTO_WORKSPACE_ACCESS_DENIED' then raise;end if;end;
 r:=public.orkto_wia_finish_request(a,a,trace,'sales_agent','succeeded',payload,request);
 if r->>'result'<>'COMPLETED' then raise exception 'Completion failed';end if;
 r:=public.orkto_wia_claim_request(a,a,trace,'sales_agent',request,10,repeat('a',64));
 if r->>'status'<>'succeeded' or r->'runtime_response' is distinct from payload then raise exception 'Persisted replay mismatch';end if;
 r:=public.orkto_wia_finish_request(a,a,trace,'sales_agent','succeeded',payload||'{"mode":"simulated"}',request);
 if r->>'result'<>'REPLAY' then raise exception 'Completion replay failed';end if;
 if (select runtime_response from public.orkto_wia_runs where workspace_id=a and trace_id=trace::text) is distinct from payload then raise exception 'Replay overwrote trusted response';end if;
 select count(*) into n from public.orkto_model_usage where workspace_id=a and trace_id=trace::text;
 if n<>1 then raise exception 'Model usage not exactly once';end if;
 select count(*) into n from public.orkto_wia_events where workspace_id=a and event_type='wia.decision.prepared';
 if n<>1 then raise exception 'Decision audit not exactly once';end if;
 update public.orkto_workspace_members set status='suspended' where workspace_id=a and user_id=a;
 begin
   perform public.orkto_wia_claim_request(a,a,trace,'sales_agent',request,10,repeat('a',64));
   raise exception 'Suspended replay allowed';
 exception when sqlstate 'P0001' then if sqlerrm<>'ORKTO_WORKSPACE_ACCESS_DENIED' then raise;end if;end;
end $$;
rollback;
