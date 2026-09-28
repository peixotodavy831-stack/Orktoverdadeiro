-- Move legacy commercial records from per-user access to a workspace tenant.
-- user_id remains for compatibility and is constrained to the workspace owner.

create or replace function public.orkto_legacy_owner_matches(target_workspace uuid, legacy_user uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.orkto_workspaces w
    where w.id=target_workspace and w.owner_user_id=legacy_user
      and public.orkto_is_workspace_member(target_workspace)
  );
$$;
revoke all on function public.orkto_legacy_owner_matches(uuid,uuid) from public,anon;
grant execute on function public.orkto_legacy_owner_matches(uuid,uuid) to authenticated,service_role;

-- A few historical channel rows may reference auth.users without a profile.
-- Provision an owner workspace for every legacy owner before adding NOT NULL.
with legacy_owners as (
  select id as user_id from public.profiles
  union select user_id from public.clients
  union select user_id from public.services
  union select user_id from public.quotes
  union select user_id from public.proposals
  union select user_id from public.orkto_conversations
  union select user_id from public.orkto_audit_log
  union select user_id from public.orkto_model_usage
  union select user_id from public.payment_records
  union select user_id from public.quote_extensions
)
insert into public.orkto_workspaces(id,owner_user_id,name)
select o.user_id,o.user_id,coalesce(nullif(p.company_name,''),nullif(p.display_name,''),'Minha empresa')
from legacy_owners o left join public.profiles p on p.id=o.user_id
on conflict(id) do nothing;

insert into public.orkto_workspace_members(workspace_id,user_id,role,status,joined_at)
select w.id,w.owner_user_id,'owner','active',now()
from public.orkto_workspaces w
on conflict(workspace_id,user_id) do nothing;

alter table public.clients add column if not exists workspace_id uuid references public.orkto_workspaces(id) on delete cascade;
alter table public.services add column if not exists workspace_id uuid references public.orkto_workspaces(id) on delete cascade;
alter table public.quotes add column if not exists workspace_id uuid references public.orkto_workspaces(id) on delete cascade;
alter table public.proposals add column if not exists workspace_id uuid references public.orkto_workspaces(id) on delete cascade;
alter table public.orkto_conversations add column if not exists workspace_id uuid references public.orkto_workspaces(id) on delete cascade;
alter table public.orkto_messages add column if not exists workspace_id uuid references public.orkto_workspaces(id) on delete cascade;
alter table public.orkto_approval_tasks add column if not exists workspace_id uuid references public.orkto_workspaces(id) on delete cascade;
alter table public.orkto_audit_log add column if not exists workspace_id uuid references public.orkto_workspaces(id) on delete cascade;
alter table public.orkto_model_usage add column if not exists workspace_id uuid references public.orkto_workspaces(id) on delete cascade;
alter table public.payment_records add column if not exists workspace_id uuid references public.orkto_workspaces(id) on delete cascade;
alter table public.quote_extensions add column if not exists workspace_id uuid references public.orkto_workspaces(id) on delete cascade;
alter table public.clients add column if not exists archived_at timestamptz;
alter table public.services add column if not exists archived_at timestamptz;

-- Metadata-only backfill must preserve expired documents. Existing retention
-- triggers reject any UPDATE on an expired quote and can resend draft links.
-- Disable only those business triggers inside the migration transaction; DDL
-- locks prevent concurrent writes and a failure rolls this change back.
alter table public.quotes disable trigger guard_quote_retention;
alter table public.proposals disable trigger aaa_bind_proposal_retention;
do $$ declare t record; begin
 for t in select tgname from pg_trigger where tgrelid='public.proposals'::regclass
   and tgname in ('check_proposal_expiry_before_write','trg_check_proposal_expiry') loop
   execute format('alter table public.proposals disable trigger %I',t.tgname);
 end loop;
end $$;
update public.clients set workspace_id=user_id where workspace_id is null;
update public.services set workspace_id=user_id where workspace_id is null;
update public.quotes set workspace_id=user_id where workspace_id is null;
update public.proposals set workspace_id=user_id where workspace_id is null;
update public.orkto_conversations set workspace_id=user_id where workspace_id is null;
update public.orkto_messages m set workspace_id=c.workspace_id from public.orkto_conversations c where c.id=m.conversation_id and m.workspace_id is null;
update public.orkto_approval_tasks t set workspace_id=c.workspace_id from public.orkto_conversations c where c.id=t.conversation_id and t.workspace_id is null;
update public.orkto_audit_log set workspace_id=user_id where workspace_id is null;
update public.orkto_model_usage set workspace_id=user_id where workspace_id is null;
update public.payment_records set workspace_id=user_id where workspace_id is null;
update public.quote_extensions set workspace_id=user_id where workspace_id is null;
alter table public.quotes enable trigger guard_quote_retention;
alter table public.proposals enable trigger aaa_bind_proposal_retention;
do $$ declare t record; begin
 for t in select tgname from pg_trigger where tgrelid='public.proposals'::regclass
   and tgname in ('check_proposal_expiry_before_write','trg_check_proposal_expiry') loop
   execute format('alter table public.proposals enable trigger %I',t.tgname);
 end loop;
end $$;

alter table public.clients alter column workspace_id set not null;
alter table public.services alter column workspace_id set not null;
alter table public.quotes alter column workspace_id set not null;
alter table public.proposals alter column workspace_id set not null;
alter table public.orkto_conversations alter column workspace_id set not null;
alter table public.orkto_messages alter column workspace_id set not null;
alter table public.orkto_approval_tasks alter column workspace_id set not null;
alter table public.orkto_audit_log alter column workspace_id set not null;
alter table public.orkto_model_usage alter column workspace_id set not null;
alter table public.payment_records alter column workspace_id set not null;
alter table public.quote_extensions alter column workspace_id set not null;

create index if not exists clients_workspace_created_idx on public.clients(workspace_id,created_at desc) where archived_at is null;
create index if not exists services_workspace_created_idx on public.services(workspace_id,created_at desc) where archived_at is null;
create index if not exists quotes_workspace_created_idx on public.quotes(workspace_id,created_at desc);
create index if not exists proposals_workspace_created_idx on public.proposals(workspace_id,created_at desc);
create index if not exists conversations_workspace_updated_idx on public.orkto_conversations(workspace_id,updated_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname='clients_id_workspace_key') then
    alter table public.clients add constraint clients_id_workspace_key unique(id,workspace_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='services_id_workspace_key') then
    alter table public.services add constraint services_id_workspace_key unique(id,workspace_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='quotes_id_workspace_key') then
    alter table public.quotes add constraint quotes_id_workspace_key unique(id,workspace_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='proposals_id_workspace_key') then
    alter table public.proposals add constraint proposals_id_workspace_key unique(id,workspace_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='orkto_conversations_id_workspace_key') then
    alter table public.orkto_conversations add constraint orkto_conversations_id_workspace_key unique(id,workspace_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='proposals_quote_workspace_fkey') then
    alter table public.proposals add constraint proposals_quote_workspace_fkey
      foreign key(quote_id,workspace_id) references public.quotes(id,workspace_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='orkto_messages_conversation_workspace_fkey') then
    alter table public.orkto_messages add constraint orkto_messages_conversation_workspace_fkey
      foreign key(conversation_id,workspace_id) references public.orkto_conversations(id,workspace_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='orkto_approval_conversation_workspace_fkey') then
    alter table public.orkto_approval_tasks add constraint orkto_approval_conversation_workspace_fkey
      foreign key(conversation_id,workspace_id) references public.orkto_conversations(id,workspace_id) on delete cascade;
  end if;
end;
$$;

create or replace function public.orkto_validate_deal_workspace_relations()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.customer_ref is not null and not exists (
    select 1 from public.clients c where c.workspace_id=new.workspace_id
      and (c.id::text=new.customer_ref or c.phone=new.customer_ref) and c.archived_at is null
  ) then raise exception 'Cliente não pertence ao workspace do negócio' using errcode='23503'; end if;
  if new.conversation_ref is not null and not exists (
    select 1 from public.orkto_conversations c where c.id=new.conversation_ref and c.workspace_id=new.workspace_id
  ) then raise exception 'Conversa não pertence ao workspace do negócio' using errcode='23503'; end if;
  return new;
end;
$$;
drop trigger if exists orkto_deal_workspace_relations on public.orkto_deals;
create trigger orkto_deal_workspace_relations before insert or update of workspace_id,customer_ref,conversation_ref
on public.orkto_deals for each row execute function public.orkto_validate_deal_workspace_relations();

-- Remove owner-only policies and replace them with member read/operation access;
-- destructive delete remains restricted to workspace owner/admin.
drop policy if exists owner_select_clients on public.clients;
drop policy if exists owner_insert_clients on public.clients;
drop policy if exists owner_update_clients on public.clients;
drop policy if exists owner_delete_clients on public.clients;
create policy clients_workspace_select on public.clients for select to authenticated using(public.orkto_is_workspace_member(workspace_id));
create policy clients_workspace_insert on public.clients for insert to authenticated with check(public.orkto_legacy_owner_matches(workspace_id,user_id));
create policy clients_workspace_update on public.clients for update to authenticated using(public.orkto_is_workspace_member(workspace_id)) with check(public.orkto_legacy_owner_matches(workspace_id,user_id));
create policy clients_workspace_delete on public.clients for delete to authenticated using(public.orkto_is_workspace_admin(workspace_id));

drop policy if exists owner_select_services on public.services;
drop policy if exists owner_insert_services on public.services;
drop policy if exists owner_update_services on public.services;
drop policy if exists owner_delete_services on public.services;
create policy services_workspace_select on public.services for select to authenticated using(public.orkto_is_workspace_member(workspace_id));
create policy services_workspace_insert on public.services for insert to authenticated with check(public.orkto_legacy_owner_matches(workspace_id,user_id));
create policy services_workspace_update on public.services for update to authenticated using(public.orkto_is_workspace_member(workspace_id)) with check(public.orkto_legacy_owner_matches(workspace_id,user_id));
create policy services_workspace_delete on public.services for delete to authenticated using(public.orkto_is_workspace_admin(workspace_id));

drop policy if exists owner_select_quotes on public.quotes;
drop policy if exists owner_insert_quotes on public.quotes;
drop policy if exists owner_update_quotes on public.quotes;
drop policy if exists owner_delete_quotes on public.quotes;
create policy quotes_workspace_select on public.quotes for select to authenticated using(public.orkto_is_workspace_member(workspace_id));
create policy quotes_workspace_insert on public.quotes for insert to authenticated with check(public.orkto_legacy_owner_matches(workspace_id,user_id));
create policy quotes_workspace_update on public.quotes for update to authenticated using(public.orkto_is_workspace_member(workspace_id)) with check(public.orkto_legacy_owner_matches(workspace_id,user_id));
create policy quotes_workspace_delete on public.quotes for delete to authenticated using(public.orkto_is_workspace_admin(workspace_id));

drop policy if exists owner_select_proposals on public.proposals;
drop policy if exists owner_insert_proposals on public.proposals;
drop policy if exists owner_update_proposals on public.proposals;
drop policy if exists owner_delete_proposals on public.proposals;
create policy proposals_workspace_select on public.proposals for select to authenticated using(public.orkto_is_workspace_member(workspace_id));
create policy proposals_workspace_insert on public.proposals for insert to authenticated with check(public.orkto_legacy_owner_matches(workspace_id,user_id));
create policy proposals_workspace_update on public.proposals for update to authenticated using(public.orkto_is_workspace_member(workspace_id)) with check(public.orkto_legacy_owner_matches(workspace_id,user_id));
create policy proposals_workspace_delete on public.proposals for delete to authenticated using(public.orkto_is_workspace_admin(workspace_id));

drop policy if exists orkto_conversations_select_own on public.orkto_conversations;
drop policy if exists orkto_conversations_insert_own on public.orkto_conversations;
drop policy if exists orkto_conversations_update_own on public.orkto_conversations;
drop policy if exists orkto_conversations_delete_own on public.orkto_conversations;
create policy conversations_workspace_select on public.orkto_conversations for select to authenticated using(public.orkto_is_workspace_member(workspace_id));
create policy conversations_workspace_insert on public.orkto_conversations for insert to authenticated with check(public.orkto_legacy_owner_matches(workspace_id,user_id));
create policy conversations_workspace_update on public.orkto_conversations for update to authenticated using(public.orkto_is_workspace_member(workspace_id)) with check(public.orkto_legacy_owner_matches(workspace_id,user_id));
create policy conversations_workspace_delete on public.orkto_conversations for delete to authenticated using(public.orkto_is_workspace_admin(workspace_id));

drop policy if exists orkto_messages_select_own on public.orkto_messages;
drop policy if exists orkto_messages_insert_own on public.orkto_messages;
drop policy if exists orkto_messages_update_own on public.orkto_messages;
create policy messages_workspace_select on public.orkto_messages for select to authenticated using(public.orkto_is_workspace_member(workspace_id));
create policy messages_workspace_insert on public.orkto_messages for insert to authenticated with check(public.orkto_is_workspace_member(workspace_id));
create policy messages_workspace_update on public.orkto_messages for update to authenticated using(public.orkto_is_workspace_member(workspace_id)) with check(public.orkto_is_workspace_member(workspace_id));

drop policy if exists orkto_approval_tasks_select_own on public.orkto_approval_tasks;
drop policy if exists orkto_approval_tasks_insert_own on public.orkto_approval_tasks;
drop policy if exists orkto_approval_tasks_update_own on public.orkto_approval_tasks;
create policy approval_tasks_workspace_select on public.orkto_approval_tasks for select to authenticated using(public.orkto_is_workspace_member(workspace_id));
create policy approval_tasks_workspace_insert on public.orkto_approval_tasks for insert to authenticated with check(public.orkto_is_workspace_member(workspace_id));
create policy approval_tasks_workspace_update on public.orkto_approval_tasks for update to authenticated using(public.orkto_is_workspace_member(workspace_id)) with check(public.orkto_is_workspace_member(workspace_id));

drop policy if exists orkto_audit_log_select_own on public.orkto_audit_log;
drop policy if exists orkto_audit_log_insert_own on public.orkto_audit_log;
create policy audit_log_workspace_select on public.orkto_audit_log for select to authenticated using(public.orkto_is_workspace_member(workspace_id));
revoke insert,update,delete on public.orkto_audit_log from authenticated;
grant select on public.orkto_audit_log to authenticated;

drop policy if exists quote_extensions_owner_select on public.quote_extensions;
create policy quote_extensions_workspace_select on public.quote_extensions for select to authenticated using(public.orkto_is_workspace_member(workspace_id));
grant select on public.quote_extensions to authenticated;

drop policy if exists orkto_model_usage_select_own on public.orkto_model_usage;
drop policy if exists orkto_model_usage_owner_select on public.orkto_model_usage;
create policy orkto_model_usage_workspace_select on public.orkto_model_usage for select to authenticated using(public.orkto_is_workspace_member(workspace_id));

drop policy if exists payment_records_owner on public.payment_records;
create policy payment_records_workspace_select on public.payment_records for select to authenticated using(public.orkto_is_workspace_member(workspace_id));

grant all on public.clients,public.services,public.quotes,public.proposals,public.orkto_conversations,public.orkto_messages,public.orkto_approval_tasks,public.orkto_audit_log,public.orkto_model_usage,public.payment_records,public.quote_extensions to service_role;
