-- Disposable fixture ONLY; transaction rolls back synthetic identities and mutations.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
  ('95000000-0000-4000-8000-000000000001','profile-a@example.invalid','{"full_name":"Profile A"}'),
  ('95000000-0000-4000-8000-000000000002','profile-b@example.invalid','{"full_name":"Profile B"}');
do $$
declare a uuid := '95000000-0000-4000-8000-000000000001';
  b uuid := '95000000-0000-4000-8000-000000000002'; r jsonb; original_b text; n int;
begin
  if has_function_privilege('anon','public.orkto_update_self_profile_command(uuid,uuid,text,uuid,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.orkto_update_self_profile_command(uuid,uuid,text,uuid,text,text)','EXECUTE')
     or not has_function_privilege('service_role','public.orkto_update_self_profile_command(uuid,uuid,text,uuid,text,text)','EXECUTE') then
    raise exception 'Personal profile RPC ACL mismatch';
  end if;
  select display_name into original_b from public.profiles where id=b;
  r:=public.orkto_update_self_profile_command(a,a,'profile-test-0001',gen_random_uuid(),repeat('a',64),'Updated A');
  if r->>'result'<>'UPDATED' or r->'profile'->>'display_name'<>'Updated A' then raise exception 'Own profile update failed'; end if;
  if (select display_name from public.profiles where id=b) is distinct from original_b then raise exception 'Foreign profile changed'; end if;
  r:=public.orkto_update_self_profile_command(a,a,'profile-test-0001',gen_random_uuid(),repeat('a',64),'Updated A');
  if r->>'result'<>'REPLAY' then raise exception 'Profile retry was not idempotent'; end if;
  select count(*) into n from public.orkto_wia_events where workspace_id=a and event_type='profile.personal_updated';
  if n<>1 then raise exception 'Profile audit is not exactly once'; end if;
  begin
    perform public.orkto_update_self_profile_command(a,b,'profile-test-0002',gen_random_uuid(),repeat('b',64),'Spoof');
    raise exception 'Foreign workspace accepted';
  exception when sqlstate 'P0001' then if sqlerrm<>'ORKTO_WORKSPACE_ACCESS_DENIED' then raise; end if; end;
  begin
    perform public.orkto_update_self_profile_command(a,a,'profile-test-0001',gen_random_uuid(),repeat('b',64),'Conflict');
    raise exception 'Reused key payload accepted';
  exception when sqlstate 'P0001' then if sqlerrm<>'ORKTO_IDEMPOTENCY_CONFLICT' then raise; end if; end;
  update public.orkto_workspace_members set status='suspended' where user_id=a and workspace_id=a;
  begin
    perform public.orkto_update_self_profile_command(a,a,'profile-test-0003',gen_random_uuid(),repeat('c',64),'Disabled');
    raise exception 'Disabled member accepted';
  exception when sqlstate 'P0001' then if sqlerrm<>'ORKTO_WORKSPACE_ACCESS_DENIED' then raise; end if; end;
  update public.orkto_workspace_members set status='active',role='member' where user_id=a and workspace_id=a;
  r:=public.orkto_update_self_profile_command(a,a,'profile-test-0004',gen_random_uuid(),repeat('d',64),'Member own name');
  if r->>'result'<>'UPDATED' then raise exception 'Member cannot edit personal name'; end if;
  if has_table_privilege('authenticated','public.profiles','UPDATE') then raise exception 'Direct profile write enabled'; end if;
end $$;
rollback;
