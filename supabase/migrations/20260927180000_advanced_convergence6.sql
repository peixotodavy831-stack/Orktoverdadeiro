-- Convergence 6: local-only additive support for automatic replay, memory
-- candidates and reusable commercial imports. No remote application implied.

alter table public.orkto_replay_records
  add column if not exists capture_key text;
create unique index if not exists orkto_replay_capture_key_uidx
  on public.orkto_replay_records(workspace_id, capture_key);

alter table public.orkto_wia_memories
  add column if not exists idempotency_key text;
create unique index if not exists orkto_wia_memories_idempotency_uidx
  on public.orkto_wia_memories(workspace_id, idempotency_key);

alter table public.orkto_import_jobs
  add column if not exists entity_type text not null default 'customers';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orkto_import_jobs_entity_type_check') then
    alter table public.orkto_import_jobs add constraint orkto_import_jobs_entity_type_check
      check (entity_type in ('customers','contacts','proposals','commercial_records'));
  end if;
end $$;

alter table public.quotes
  add column if not exists orkto_import_job_id uuid references public.orkto_import_jobs(id) on delete set null,
  add column if not exists orkto_import_row_id uuid references public.orkto_import_rows(id) on delete set null;
create unique index if not exists orkto_quotes_import_row_uidx
  on public.quotes(orkto_import_row_id);

alter table public.orkto_deals
  add column if not exists orkto_import_job_id uuid references public.orkto_import_jobs(id) on delete set null,
  add column if not exists orkto_import_row_id uuid references public.orkto_import_rows(id) on delete set null;
create unique index if not exists orkto_deals_import_row_uidx
  on public.orkto_deals(orkto_import_row_id);

create table if not exists public.orkto_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
  customer_id uuid,
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  phone text,
  email text,
  company text,
  role text,
  source text not null default 'manual',
  orkto_import_job_id uuid references public.orkto_import_jobs(id) on delete set null,
  orkto_import_row_id uuid references public.orkto_import_rows(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orkto_contacts_customer_workspace_fkey foreign key (customer_id, workspace_id)
    references public.clients(id, workspace_id) on delete restrict
);
create unique index if not exists orkto_contacts_import_row_uidx
  on public.orkto_contacts(orkto_import_row_id);
create index if not exists orkto_contacts_workspace_customer_idx
  on public.orkto_contacts(workspace_id, customer_id, created_at desc);
create index if not exists orkto_contacts_workspace_phone_idx
  on public.orkto_contacts(workspace_id, phone) where phone is not null;

alter table public.orkto_contacts enable row level security;
create policy orkto_contacts_workspace_access on public.orkto_contacts for all to authenticated
  using (public.orkto_is_workspace_member(workspace_id))
  with check (public.orkto_is_workspace_member(workspace_id));
grant select on public.orkto_contacts to authenticated;
grant all on public.orkto_contacts to service_role;

-- Production readiness: Supabase default ACLs grant ALL to browser roles on
-- newly created objects. GRANT SELECT alone does not remove those privileges.
-- Keep existing read policies, but all operational writes go through the API
-- (roles, trial/limits, approval, audit and idempotency live there).
do $$ declare t record; f record; begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and
   (c.relname like 'orkto\_%' escape '\' or c.relname in ('clients','services','quotes','proposals')) loop
   execute format('revoke all on public.%I from anon',t.relname);
   execute format('revoke insert,update,delete,truncate,references,trigger on public.%I from authenticated',t.relname);
   execute format('grant all on public.%I to service_role',t.relname);
 end loop;
 for f in select p.oid::regprocedure as signature,p.proname from pg_proc p
   join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'orkto\_%' escape '\' loop
   execute format('revoke all on function %s from public,anon,authenticated',f.signature);
   execute format('grant execute on function %s to service_role',f.signature);
   if f.proname in ('orkto_is_workspace_member','orkto_is_workspace_admin','orkto_legacy_owner_matches') then
     execute format('grant execute on function %s to authenticated',f.signature);
   end if;
 end loop;
end $$;
