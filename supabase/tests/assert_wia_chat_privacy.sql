-- Disposable fixtures only; rollback includes accounts, memberships and messages.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('97000000-0000-4000-8000-000000000001','chat-a@example.invalid','{}'),
('97000000-0000-4000-8000-000000000002','chat-b@example.invalid','{}');
insert into public.orkto_workspace_members(workspace_id,user_id,role,status)
values ('97000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000002','member','active');
insert into public.orkto_wia_chat_messages(workspace_id,user_id,session_id,message_key,role,content) values
('97000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),'user','private A'),
('97000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000002',gen_random_uuid(),gen_random_uuid(),'user','private B same company'),
('97000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000002',gen_random_uuid(),gen_random_uuid(),'user','private B other company');
set local role authenticated;
select set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"97000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.orkto_wia_chat_messages) <> 1
 or (select content from public.orkto_wia_chat_messages) <> 'private A' then
   raise exception 'WIA chat exposed another actor or tenant';
 end if;
 if has_table_privilege('authenticated','public.orkto_wia_chat_messages','INSERT')
 or has_table_privilege('authenticated','public.orkto_wia_chat_messages','UPDATE')
 or has_table_privilege('authenticated','public.orkto_wia_chat_messages','DELETE') then
   raise exception 'Browser gained chat mutation privileges';
 end if;
end $$;
reset role;
rollback;
