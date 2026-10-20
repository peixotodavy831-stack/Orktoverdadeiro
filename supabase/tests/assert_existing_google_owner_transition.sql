-- Disposable PostgreSQL17 only. Synthetic identity; NOT real Google evidence.
begin;
-- The disposable replay applies SQL directly, without a managed Supabase ledger.
-- Supply only its metadata fixture; this is never a remote ledger repair.
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations(version text primary key,name text);
do $$ begin
  if exists(select 1 from supabase_migrations.schema_migrations) then
    raise exception 'Owner transition test requires an empty disposable ledger fixture';
  end if;
end $$;
insert into supabase_migrations.schema_migrations(version,name)
select i::text,case when i=44 then 'google_pilot_gate_fails_closed' else 'synthetic_migration_'||i end
from generate_series(1,44) i;
insert into auth.users(id,email,encrypted_password,raw_app_meta_data) values
  ('93000000-0000-4000-8000-000000000001','legacy-owner@example.invalid','synthetic-legacy-hash','{"provider":"email"}'),
  ('93000000-0000-4000-8000-000000000002','other-owner@example.invalid','synthetic-other-hash','{"provider":"email"}');
insert into public.clients(user_id,workspace_id,name,phone) values
  ('93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Existing owner data','+550000000091'),
  ('93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002','Other owner data','+550000000092');
update orkto_pilot_private.configuration set enabled=true;
select set_config('orkto.owner_transition_target_ref','ghrjongiodziasupakrk',true);
select set_config('orkto.owner_transition_email_sha256',encode(sha256(convert_to('legacy-owner@example.invalid','UTF8')),'hex'),true);
select set_config('orkto.owner_transition_approval','OWNER_APPROVED_GOOGLE_ONLY_30_DAYS',true);
\ir ../../scripts/readiness/transition-existing-google-owner.sql
do $$ begin
  if not exists(select 1 from auth.users where id='93000000-0000-4000-8000-000000000001' and encrypted_password='')
    or not exists(select 1 from auth.users where id='93000000-0000-4000-8000-000000000002' and encrypted_password='synthetic-other-hash')
    or (select count(*) from public.orkto_workspaces where owner_user_id in
      ('93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002'))<>2
    or not exists(select 1 from public.orkto_workspace_members where user_id='93000000-0000-4000-8000-000000000001'
      and workspace_id=user_id and role='owner' and status='active')
    or not exists(select 1 from orkto_pilot_private.audit where action='LEGACY_PASSWORD_DISABLED') then
    raise exception 'Existing owner or foreign account was not preserved';
  end if;
  if public.orkto_google_pilot_session_allowed() then raise exception 'Transition granted a session without Google'; end if;
end $$;
insert into auth.identities(user_id,provider,provider_id)
values('93000000-0000-4000-8000-000000000001','google','synthetic-legacy-owner-google');
insert into auth.sessions(id,user_id)
values('94000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001');
-- Repetition must not create a new workspace, renew expiry, or rewrite identity.
\ir ../../scripts/readiness/transition-existing-google-owner.sql
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"94000000-0000-4000-8000-000000000001","amr":[{"method":"oauth"}]}',true);
set local role authenticated;
do $$ begin
  if not public.orkto_google_pilot_session_allowed()
    or (select count(*) from public.clients where name='Existing owner data')<>1
    or exists(select 1 from public.clients where name='Other owner data') then
    raise exception 'Google transition session or tenant isolation failed';
  end if;
  begin update public.clients set name='Direct write' where user_id=auth.uid();
    raise exception 'Direct write accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update orkto_pilot_private.admissions set active=false where user_id='93000000-0000-4000-8000-000000000001';
do $$ begin
  if public.orkto_google_pilot_session_allowed() then raise exception 'Revocation failed after owner transition'; end if;
  if (select count(*) from public.clients where name in('Existing owner data','Other owner data'))<>2 then
    raise exception 'Original data changed';
  end if;
end $$;
rollback;
