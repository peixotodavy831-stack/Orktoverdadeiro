begin;
do $$ declare count_plans integer; wid uuid; uid uuid; reserved jsonb; request_id uuid; begin
 select count(*) into count_plans from public.orkto_plan_catalog where commercial_available;
 if count_plans<>5 then raise exception 'Five offers required'; end if;
 if exists(select 1 from public.orkto_plan_catalog where commercial_available and
 (plan_key='starter' and (display_name<>'Start' or price_cents<>7990) or plan_key='pro' and price_cents<>14990
 or plan_key='business' and price_cents<>29990 or plan_key='scale' and price_cents<>59990 or plan_key='enterprise' and price_cents is not null)) then raise exception 'Price mismatch'; end if;
 if has_table_privilege('authenticated','public.orkto_pulso_ledger','INSERT') or has_table_privilege('authenticated','public.orkto_billing_bindings','UPDATE') then raise exception 'Browser billing privilege'; end if;
 select workspace_id,user_id into wid,uid from public.orkto_workspace_members where role='owner' and status='active' limit 1;
 if wid is null then raise exception 'Synthetic owner fixture required'; end if;
 reserved:=public.orkto_reserve_pulso(wid,'billing-test-0001','normal');
 if reserved->>'allowed'<>'false' then raise exception 'Unapproved Pulso accepted'; end if;
 insert into public.orkto_pulso_policies(workspace_id,version,allowance_milli,approved_by,expires_at,reason)
 values(wid,1,1000,uid,now()+interval '1 hour','Disposable CI fixture policy only');
 reserved:=public.orkto_reserve_pulso(wid,'billing-test-0001','normal');
 if reserved->>'allowed'<>'true' then raise exception 'Approved allocation denied'; end if;
 reserved:=public.orkto_reserve_pulso(wid,'billing-test-0002','normal');
 if reserved->>'reason'<>'limit_reached' then raise exception 'Quota bypass'; end if;
 request_id:=public.orkto_request_commercial_proposal(wid,uid,'proposal-test-001','Synthetic Enterprise request');
 if request_id is distinct from public.orkto_request_commercial_proposal(wid,uid,'proposal-test-001','Synthetic Enterprise request') then raise exception 'Duplicate request'; end if;
 begin
 update public.orkto_plan_price_versions set price_cents=1 where plan_key='starter' and version=2;
 raise exception 'Price mutation accepted'; exception when check_violation then null; end;
end $$;
rollback;
