-- Disposable PostgreSQL 17 ONLY. Proves the checkpoint excludes existing
-- unclassified accounts and global rows, then exercises transactional cleanup.
begin;
create temporary table recovery_test_before as select count(*) n from auth.users;
insert into auth.users(id,email,raw_user_meta_data)
select gen_random_uuid(),'orkto-readiness-a-recovery'||n||'@example.invalid',
  '{"synthetic":true,"orkto_fixture":"ci-only"}'::jsonb from generate_series(1,18) n;
create temporary table recovery_test_run as select orkto_pilot_private.capture_recovery_checkpoint() result;
do $$ declare v_run uuid; v_ids uuid[]; v_bad boolean; begin
  select (result->>'checkpoint_id')::uuid into v_run from recovery_test_run;
  select synthetic_ids into v_ids from orkto_pilot_private.recovery_checkpoints where id=v_run and verified;
  if coalesce(cardinality(v_ids),0)<>18 then raise exception 'Recovery inventory not verified'; end if;
  if not exists(select 1 from orkto_pilot_private.recovery_rows
    where checkpoint_id=v_run and table_schema='auth' and table_name='users' and row_count=18) then
    raise exception 'Scoped Auth checkpoint mismatch';
  end if;
  select exists(select 1 from orkto_pilot_private.recovery_rows r,
    lateral jsonb_array_elements(r.payload) x
    where r.checkpoint_id=v_run and not coalesce((x->>r.scope_column::text)=any(select unnest(v_ids)::text),false)) into v_bad;
  if v_bad then raise exception 'Checkpoint captured a non-synthetic row'; end if;
  if exists(select 1 from orkto_pilot_private.recovery_rows
    where checkpoint_id=v_run and table_name in ('orkto_plan_catalog','orkto_plan_price_versions','configuration')) then
    raise exception 'Unrelated global data captured';
  end if;
  perform orkto_pilot_private.cleanup_verified_synthetic(v_run);
  if (select count(*) from auth.users)<>(select n from recovery_test_before) then
    raise exception 'Cleanup affected unclassified accounts';
  end if;
end $$;
rollback;
