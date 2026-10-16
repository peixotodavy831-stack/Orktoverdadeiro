-- Disposable PostgreSQL 17 only. No provider request and no commercial policy approval.
begin;
do $$ declare wid uuid; uid uuid; bid uuid; rid jsonb; cmd jsonb; result text; started timestamptz:=now(); begin
 select workspace_id,user_id into wid,uid from public.orkto_workspace_members where role='owner' and status='active' limit 1;
 insert into public.orkto_billing_customers(workspace_id,provider,environment,customer_ref,approved_by)
 values(wid,'asaas','sandbox','cus_lifecycle_ci',uid);
 rid:=public.orkto_begin_sandbox_subscription(wid,uid,'lifecycle-create','starter','cus_lifecycle_ci');
 bid:=(rid->>'bindingId')::uuid;
 update public.orkto_billing_bindings set provider_subscription_id='sub_lifecycle_ci',creation_state='created' where id=bid;
 result:=public.orkto_reconcile_subscription(bid,'unknown-status-ci','sub_lifecycle_ci',7990,'BRL','confirmed',started,started+interval '30 days',started);
 if result<>'RECORDED_POLICY_REQUIRED' then raise exception 'Unknown subscription activated access'; end if;
 result:=public.orkto_observe_subscription('sub_lifecycle_ci','lifecycle-active','cus_lifecycle_ci','orkto-sub:'||bid,7990,'ACTIVE');
 if result<>'RECORDED' then raise exception 'Provider observation failed'; end if;
 if public.orkto_observe_subscription('sub_lifecycle_ci','lifecycle-active','cus_lifecycle_ci','orkto-sub:'||bid,7990,'ACTIVE')<>'REPLAY' then raise exception 'Observation replay failed'; end if;
 result:=public.orkto_reconcile_subscription(bid,'active-payment-ci','sub_lifecycle_ci',7990,'BRL','confirmed',started,started+interval '30 days',started+interval '1 second');
 if result<>'APPLIED' then raise exception 'Confirmed active subscription denied'; end if;
 cmd:=public.orkto_reserve_subscription_command(wid,uid,bid,'lifecycle-cancel','cancel','{}');
 if cmd->>'execute'<>'true' then raise exception 'Command not reserved'; end if;
 if public.orkto_reserve_subscription_command(wid,uid,bid,'lifecycle-cancel','cancel','{}')->>'execute'<>'false' then raise exception 'Concurrent replay executed'; end if;
 begin
 perform public.orkto_reserve_subscription_command(wid,uid,bid,'lifecycle-cancel','update','{"status":"INACTIVE"}');
 raise exception 'Conflicting replay accepted'; exception when raise_exception then if SQLERRM<>'BILLING_EVENT_CONFLICT' then raise; end if; end;
 begin
 perform public.orkto_reserve_subscription_command(wid,uid,bid,'second-cancel-key','cancel','{}');
 raise exception 'Concurrent command accepted'; exception when unique_violation then null; end;
 perform public.orkto_finish_subscription_command((cmd->>'id')::uuid,'unknown');
 if public.orkto_reserve_subscription_command(wid,uid,bid,'lifecycle-cancel','cancel','{}')->>'state'<>'unknown' then raise exception 'Unknown result resent'; end if;
 perform public.orkto_observe_subscription('sub_lifecycle_ci','lifecycle-inactive','cus_lifecycle_ci','orkto-sub:'||bid,7990,'INACTIVE');
 result:=public.orkto_reconcile_subscription(bid,'inactive-payment-ci','sub_lifecycle_ci',7990,'BRL','confirmed',started,started+interval '60 days',started+interval '2 seconds');
 if result<>'RECORDED_POLICY_REQUIRED' then raise exception 'Inactive subscription extended access'; end if;
 perform public.orkto_observe_subscription('sub_lifecycle_ci','lifecycle-deleted','cus_lifecycle_ci','orkto-sub:'||bid,7990,'DELETED');
 if not exists(select 1 from public.orkto_workspace_subscriptions s join public.orkto_billing_bindings b on b.subscription_id=s.id
  where b.id=bid and s.status='active' and s.current_period_end=started+interval '30 days') then raise exception 'Unapproved termination or extension applied'; end if;
 begin
 perform public.orkto_observe_subscription('sub_lifecycle_ci','resurrect-deleted','cus_lifecycle_ci','orkto-sub:'||bid,7990,'ACTIVE');
 raise exception 'Deleted subscription resurrected'; exception when raise_exception then if SQLERRM<>'BILLING_STATE_CONFLICT' then raise; end if; end;
 begin
 perform public.orkto_observe_subscription('sub_lifecycle_ci','foreign-customer','cus_foreign','orkto-sub:'||bid,7990,'DELETED');
 raise exception 'Foreign customer accepted'; exception when raise_exception then if SQLERRM<>'BILLING_PROVIDER_MISMATCH' then raise; end if; end;
 if has_table_privilege('authenticated','public.orkto_subscription_commands','UPDATE')
  or has_function_privilege('authenticated','public.orkto_observe_subscription(text,text,text,text,bigint,text)','EXECUTE') then raise exception 'Browser lifecycle permission'; end if;
end $$;
rollback;
