-- Transactional regression checks. Changes are rolled back by this file.
begin;
do $$ declare counter integer; begin
  -- A versioned Scale subscription must not inherit the old profile free cap=5.
  update public.orkto_workspace_subscriptions set plan_key='scale',status='active'
    where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  for counter in 1..6 loop
    insert into public.quotes(workspace_id,user_id,quote_number,client_name,client_phone)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SCALE-'||counter,'Synthetic','+5500');
  end loop;
  if (select count(*) from public.quotes where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and quote_number like 'SCALE-%')<>6 then
    raise exception 'Scale entitlement did not allow more than the legacy five proposals';
  end if;
  delete from public.quotes where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and quote_number like 'SCALE-%';
  update public.orkto_workspace_subscriptions set plan_key='starter'
    where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  -- The fixture already contains one active legacy proposal. Starter allows
  -- five active proposals total, so four new proposals fit and the next fails.
  for counter in 1..4 loop
    insert into public.quotes(workspace_id,user_id,quote_number,client_name,client_phone)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','STARTER-'||counter,'Synthetic','+5500');
  end loop;
  if (select count(*) from public.quotes where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and archived_at is null and status not in ('rejected','expired')
      and (retention_expires_at is null or retention_expires_at>now()))<>5 then
    raise exception 'Starter entitlement did not allow exactly five active proposals including the legacy fixture';
  end if;
  begin
    insert into public.quotes(workspace_id,user_id,quote_number,client_name,client_phone)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','STARTER-OVER-CAP','Synthetic','+5500');
    raise exception 'versioned proposal cap bypassed';
  exception when check_violation then null; end;
  if (select count(*) from public.quotes where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and archived_at is null and status not in ('rejected','expired')
      and (retention_expires_at is null or retention_expires_at>now()))<>5 then
    raise exception 'Starter proposal cap changed after rejecting the sixth proposal';
  end if;
  update public.orkto_workspace_subscriptions set plan_key='scale',status='trial',trial_ends_at=now()-interval '1 day'
    where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  begin
    insert into public.quotes(workspace_id,user_id,quote_number,client_name,client_phone)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','EXPIRED-TRIAL','Synthetic','+5500');
    raise exception 'expired trial bypassed';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from pg_trigger where not tgisinternal and tgenabled='D'
    and tgrelid in ('public.quotes'::regclass,'public.proposals'::regclass)) then
    raise exception 'backfill left a business trigger disabled';
  end if;
end $$;
rollback;
