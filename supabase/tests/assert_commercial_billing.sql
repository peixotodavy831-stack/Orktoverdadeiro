begin;
do $$ declare count_plans integer; wid uuid; uid uuid; reserved jsonb; request_id uuid; binding jsonb; outcome text; began timestamptz:=now(); begin
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
 insert into public.orkto_pulso_policies(workspace_id,plan_key,version,allowance_milli,approved_by,operation_rates,expires_at,reason)
 select wid,s.plan_key,1,1000,uid,'{"normal":1000}',now()+interval '1 hour','Disposable CI fixture policy only' from public.orkto_workspace_subscriptions s where s.workspace_id=wid and not s.billing_pending order by s.created_at desc limit 1;
 reserved:=public.orkto_reserve_pulso(wid,'billing-test-0001','normal');
 if reserved->>'allowed'<>'true' then raise exception 'Approved allocation denied'; end if;
 reserved:=public.orkto_reserve_pulso(wid,'billing-test-0002','normal');
 if reserved->>'reason'<>'limit_reached' then raise exception 'Quota bypass'; end if;
 request_id:=public.orkto_request_commercial_proposal(wid,uid,'proposal-test-001','Synthetic Enterprise request');
 if request_id is distinct from public.orkto_request_commercial_proposal(wid,uid,'proposal-test-001','Synthetic Enterprise request') then raise exception 'Duplicate request'; end if;
 insert into public.orkto_billing_customers(workspace_id,provider,environment,customer_ref,approved_by)
 values(wid,'asaas','sandbox','cus_fixture_ci',uid);
 binding:=public.orkto_begin_sandbox_subscription(wid,uid,'sandbox-test-001','starter','cus_fixture_ci');
 if binding->>'created'<>'true' then raise exception 'Sandbox reservation failed'; end if;
 if not exists(select 1 from public.orkto_workspace_subscriptions s join public.orkto_billing_bindings b on b.subscription_id=s.id
 where b.id=(binding->>'bindingId')::uuid and s.billing_pending and s.status='suspended') then raise exception 'Unpaid reservation granted access'; end if;
 update public.orkto_billing_bindings set provider_subscription_id='sub_fixture_ci',creation_state='created',provider_status='ACTIVE' where id=(binding->>'bindingId')::uuid;
 outcome:=public.orkto_reconcile_subscription((binding->>'bindingId')::uuid,'payment-event-ci','sub_fixture_ci',7990,'BRL','confirmed',began,began+interval '30 days',began);
 if outcome<>'APPLIED' then raise exception 'Reconciliation failed'; end if;
 outcome:=public.orkto_reconcile_subscription((binding->>'bindingId')::uuid,'payment-event-ci','sub_fixture_ci',7990,'BRL','confirmed',began,began+interval '30 days',began);
 if outcome<>'REPLAY' then raise exception 'Duplicate payment was not replayed'; end if;
 if not exists(select 1 from public.orkto_workspace_subscriptions s join public.orkto_billing_bindings b on b.subscription_id=s.id
 where b.id=(binding->>'bindingId')::uuid and not s.billing_pending and s.status='active') then raise exception 'Confirmed reservation not activated'; end if;
 begin
 perform public.orkto_reconcile_subscription((binding->>'bindingId')::uuid,'wrong-price-ci','sub_fixture_ci',1,'BRL','confirmed',began,began+interval '30 days',began);
 raise exception 'Invalid amount accepted';
 exception when raise_exception then if SQLERRM<>'BILLING_RECONCILIATION_INVALID' then raise; end if; end;
 begin
 update public.orkto_plan_price_versions set price_cents=1 where plan_key='starter' and version=2;
 raise exception 'Price mutation accepted'; exception when check_violation then null; end;
end $$;
rollback;
