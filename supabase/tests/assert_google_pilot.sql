-- Disposable PostgreSQL 17 ONLY: synthetic Auth records simulate verified
-- provider state; these are NOT evidence of an actual Google OAuth login.
begin;
update orkto_pilot_private.configuration set enabled=true;
insert into orkto_pilot_private.admissions(email_sha256,create_workspace,member_role,expires_at,approved_by)
select encode(sha256(convert_to(email,'UTF8')),'hex'),true,'owner',now()+interval '1 day','CI_SYNTHETIC'
from (values('pilot-a@example.invalid'),('pilot-b@example.invalid')) x(email);
insert into auth.users(id,email,raw_app_meta_data) values
('91000000-0000-4000-8000-000000000001','pilot-a@example.invalid','{"provider":"google"}'),
('91000000-0000-4000-8000-000000000002','pilot-b@example.invalid','{"provider":"google"}');
insert into auth.identities(user_id,provider,provider_id) values
('91000000-0000-4000-8000-000000000001','google','synthetic-google-a'),
('91000000-0000-4000-8000-000000000002','google','synthetic-google-b');
insert into auth.sessions(id,user_id) values
('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001'),
('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002');
insert into public.clients(user_id,workspace_id,name,phone) values
('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','Pilot A synthetic','+550000000001'),
('91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','Pilot B synthetic','+550000000002');

do $$ begin
  begin
    insert into auth.users(id,email,raw_app_meta_data) values(gen_random_uuid(),'unapproved@example.invalid','{"provider":"google"}');
    raise exception 'Unapproved signup accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
    values(gen_random_uuid(),'pilot-a@example.invalid','{"provider":"email"}','{"role":"owner","provider":"google"}');
    raise exception 'Provider spoof accepted';
  exception when insufficient_privilege then null; end;
  begin
    update auth.users set encrypted_password='synthetic-invalid-hash' where id='91000000-0000-4000-8000-000000000001';
    raise exception 'Password addition accepted';
  exception when insufficient_privilege then null; end;
  begin
    update auth.users set email='foreign@example.invalid' where id='91000000-0000-4000-8000-000000000001';
    raise exception 'Email takeover accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into auth.identities(user_id,provider,provider_id) values('91000000-0000-4000-8000-000000000001','email','synthetic-email');
    raise exception 'Alternative identity accepted';
  exception when insufficient_privilege then null; end;
  begin
    update auth.identities set provider_id='foreign-subject' where user_id='91000000-0000-4000-8000-000000000001';
    raise exception 'Identity swap accepted';
  exception when insufficient_privilege then null; end;
  if (orkto_pilot_private.access_token_hook('{"user_id":"91000000-0000-4000-8000-000000000001","authentication_method":"password","claims":{"amr":[{"method":"oauth"}]}}') ? 'error') is not true then
    raise exception 'Password token hook did not deny';
  end if;
  if (orkto_pilot_private.before_user_created('{"user":{"email":"unapproved@example.invalid","app_metadata":{"provider":"google"}}}') ? 'error') is not true then
    raise exception 'Hook did not deny unapproved';
  end if;
end $$;

-- The member's role/workspace comes solely from the operator-managed entry.
insert into orkto_pilot_private.admissions(email_sha256,workspace_id,create_workspace,member_role,expires_at,approved_by)
values(encode(sha256(convert_to('pilot-member@example.invalid','UTF8')),'hex'),
  '91000000-0000-4000-8000-000000000001',false,'member',now()+interval '1 day','CI_SYNTHETIC');
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
('91000000-0000-4000-8000-000000000003','pilot-member@example.invalid','{"provider":"google"}','{"role":"owner","workspace_id":"91000000-0000-4000-8000-000000000002"}');
do $$ begin
  if not exists(select 1 from public.orkto_workspace_members where user_id='91000000-0000-4000-8000-000000000003'
    and workspace_id='91000000-0000-4000-8000-000000000001' and role='member')
    or exists(select 1 from public.orkto_workspaces where owner_user_id='91000000-0000-4000-8000-000000000003') then
    raise exception 'Membership privilege spoof';
  end if;
end $$;

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"92000000-0000-4000-8000-000000000001","amr":[{"method":"oauth"}]}',true);
set local role authenticated;
do $$ begin
  if not public.orkto_pilot_session_allowed() then raise exception 'Allowed OAuth session denied'; end if;
  if (select count(*) from public.clients where name='Pilot A synthetic')<>1
    or (select count(*) from public.clients where name='Pilot B synthetic')<>0
    or public.orkto_is_workspace_member('91000000-0000-4000-8000-000000000002') then
    raise exception 'Cross-tenant isolation failed';
  end if;
  begin insert into public.clients(user_id,workspace_id,name,phone) values(auth.uid(),auth.uid(),'Forbidden direct','+550000000003');
    raise exception 'Direct INSERT accepted'; exception when insufficient_privilege then null; end;
  begin update public.clients set name='Forbidden direct' where user_id=auth.uid();
    raise exception 'Direct UPDATE accepted'; exception when insufficient_privilege then null; end;
  begin delete from public.clients where user_id=auth.uid();
    raise exception 'Direct DELETE accepted'; exception when insufficient_privilege then null; end;
  begin perform * from orkto_pilot_private.admissions;
    raise exception 'Allowlist exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Expiration, wrong AMR and missing session do not borrow an authorized identity.
select set_config('request.jwt.claims','{"session_id":"92000000-0000-4000-8000-000000000001","amr":[{"method":"password"}]}',true);
do $$ begin if public.orkto_pilot_session_allowed() then raise exception 'Password AMR accepted'; end if; end $$;
select set_config('request.jwt.claims','{"session_id":"not-a-uuid","amr":[{"method":"oauth"}]}',true);
do $$ begin if public.orkto_pilot_session_allowed() then raise exception 'Invalid session accepted'; end if; end $$;
select set_config('request.jwt.claims','{"session_id":"92000000-0000-4000-8000-000000000001","amr":[{"method":"oauth"}]}',true);
update orkto_pilot_private.admissions set active=false where user_id='91000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  if public.orkto_pilot_session_allowed() or public.orkto_is_workspace_member('91000000-0000-4000-8000-000000000001')
    or exists(select 1 from public.clients) then raise exception 'Revoked JWT retained access'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from auth.sessions where user_id='91000000-0000-4000-8000-000000000001')
    or not exists(select 1 from orkto_pilot_private.audit where action='ADMISSION_CHANGED') then
    raise exception 'Revocation session/audit failed';
  end if;
  if exists(select 1 from auth.users where email='unapproved@example.invalid') then raise exception 'Denied user persisted'; end if;
end $$;
rollback;
