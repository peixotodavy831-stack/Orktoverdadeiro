-- Reconciled to the already-applied remote version 20260905220031.
-- The runtime Supabase project supplies auth.users; this migration creates the
-- legacy ORKTO tables needed by the subsequent versioned migrations.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  photo_url text,
  created_at timestamptz not null default now(),
  onboarding_completed boolean not null default false,
  company_name text,
  tax_id text,
  company_logo text,
  whatsapp_number text,
  whatsapp_template text,
  payment_info text,
  quote_color text not null default '#FF9F1C',
  address text,
  profession text,
  brand_name text,
  brand_tone text not null default 'comercial' check (brand_tone in ('formal','técnico','comercial','criativo')),
  active_plan text not null default 'free' check (active_plan in ('free','pro','business')),
  plan_period text not null default 'monthly' check (plan_period in ('monthly','annual')),
  trial_expiration_date text,
  checklist_dismissed boolean not null default false,
  is_founder boolean not null default false,
  founder_price integer not null default 0,
  asaas_api_key text,
  asaas_customer_id text
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quote_number text not null,
  client_name text not null,
  client_phone text not null,
  client_email text,
  client_company text,
  client_vehicle_or_service text,
  notes text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0 check (subtotal >= 0),
  discount_total numeric not null default 0 check (discount_total >= 0),
  taxes numeric not null default 0 check (taxes >= 0),
  total numeric not null default 0 check (total >= 0),
  valid_value_days integer not null default 15 check (valid_value_days between 1 and 365),
  payment_instructions text,
  status text not null default 'draft' check (status in ('draft','sent','viewed','pending','approved','rejected','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text not null,
  company text,
  vehicle_or_service text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  quote_count integer not null default 0 check (quote_count >= 0),
  total_revenue numeric not null default 0 check (total_revenue >= 0),
  last_contact_date timestamptz
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  unit_price numeric not null default 0 check (unit_price >= 0),
  category text not null default 'Outros Serviços',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  slug varchar(8) not null unique,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  is_active boolean default true,
  viewed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_quotes_user_created on public.quotes(user_id,created_at desc);
create index if not exists idx_clients_user_created on public.clients(user_id,created_at desc);
create index if not exists idx_services_user_created on public.services(user_id,created_at desc);
create index if not exists idx_proposals_slug on public.proposals(slug);
create index if not exists idx_proposals_quote_id on public.proposals(quote_id);
create index if not exists idx_proposals_user_id on public.proposals(user_id);

alter table public.profiles enable row level security;
alter table public.quotes enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.proposals enable row level security;

drop policy if exists owner_select_profiles on public.profiles;
create policy owner_select_profiles on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists owner_insert_profiles on public.profiles;
create policy owner_insert_profiles on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists owner_update_profiles on public.profiles;
create policy owner_update_profiles on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists owner_delete_profiles on public.profiles;
create policy owner_delete_profiles on public.profiles for delete to authenticated using ((select auth.uid()) = id);

drop policy if exists owner_select_quotes on public.quotes;
create policy owner_select_quotes on public.quotes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists owner_insert_quotes on public.quotes;
create policy owner_insert_quotes on public.quotes for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists owner_update_quotes on public.quotes;
create policy owner_update_quotes on public.quotes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists owner_delete_quotes on public.quotes;
create policy owner_delete_quotes on public.quotes for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists owner_select_clients on public.clients;
create policy owner_select_clients on public.clients for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists owner_insert_clients on public.clients;
create policy owner_insert_clients on public.clients for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists owner_update_clients on public.clients;
create policy owner_update_clients on public.clients for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists owner_delete_clients on public.clients;
create policy owner_delete_clients on public.clients for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists owner_select_services on public.services;
create policy owner_select_services on public.services for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists owner_insert_services on public.services;
create policy owner_insert_services on public.services for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists owner_update_services on public.services;
create policy owner_update_services on public.services for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists owner_delete_services on public.services;
create policy owner_delete_services on public.services for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists owner_select_proposals on public.proposals;
create policy owner_select_proposals on public.proposals for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists owner_insert_proposals on public.proposals;
create policy owner_insert_proposals on public.proposals for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists owner_update_proposals on public.proposals;
create policy owner_update_proposals on public.proposals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists owner_delete_proposals on public.proposals;
create policy owner_delete_proposals on public.proposals for delete to authenticated using ((select auth.uid()) = user_id);

grant select,insert,update,delete on public.profiles,public.quotes,public.clients,public.services,public.proposals to authenticated;
grant all on public.profiles,public.quotes,public.clients,public.services,public.proposals to service_role;

create or replace function public.deactivate_expired_proposals()
returns void language plpgsql set search_path=public as $$
begin
  update public.proposals set is_active=false where expires_at<now() and is_active=true;
end;
$$;

create or replace function public.check_proposal_expiry()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.expires_at<now() then new.is_active=false; end if;
  return new;
end;
$$;

drop trigger if exists trg_check_proposal_expiry on public.proposals;
create trigger trg_check_proposal_expiry before insert or update on public.proposals
for each row execute function public.check_proposal_expiry();
