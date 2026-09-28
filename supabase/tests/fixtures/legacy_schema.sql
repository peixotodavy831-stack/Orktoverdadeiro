-- Disposable pre-migration schema fixture. Never run against a linked/remote DB.
create schema if not exists auth;
create schema if not exists storage;
do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin bypassrls;
exception when duplicate_object then null; end $$;
grant usage on schema public,auth,storage to anon,authenticated,service_role;

create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;

create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean not null default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text not null, owner_id text
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(object_name text) returns text[] language sql immutable as $$
  select string_to_array(object_name,'/')
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text, email text, photo_url text, created_at timestamptz not null default now(),
  onboarding_completed boolean not null default false, company_name text, tax_id text, company_logo text,
  whatsapp_number text, whatsapp_template text, payment_info text, quote_color text not null default '#FF9F1C',
  address text, profession text, brand_name text,
  brand_tone text not null default 'comercial' check(brand_tone in ('formal','técnico','comercial','criativo')),
  active_plan text not null default 'free' check(active_plan in ('free','pro','business')),
  plan_period text not null default 'monthly' check(plan_period in ('monthly','annual')),
  trial_expiration_date text, checklist_dismissed boolean not null default false,
  is_founder boolean not null default false, founder_price integer not null default 0,
  asaas_api_key text, asaas_customer_id text
);
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  quote_number text not null, client_name text not null, client_phone text not null, client_email text,
  client_company text, client_vehicle_or_service text, notes text, items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0 check(subtotal>=0), discount_total numeric not null default 0 check(discount_total>=0),
  taxes numeric not null default 0 check(taxes>=0), total numeric not null default 0 check(total>=0),
  valid_value_days integer not null default 15 check(valid_value_days between 1 and 365), payment_instructions text,
  status text not null default 'draft' check(status in ('draft','sent','viewed','pending','approved','rejected','expired')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), sent_at timestamptz,
  viewed_at timestamptz, approved_at timestamptz, rejected_at timestamptz
);
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null, phone text not null, company text, vehicle_or_service text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  quote_count integer not null default 0 check(quote_count>=0), total_revenue numeric not null default 0 check(total_revenue>=0),
  last_contact_date timestamptz
);
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null, description text, unit_price numeric not null default 0 check(unit_price>=0),
  category text not null default 'Outros Serviços', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into auth.users(id,email) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner-a@example.test'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner-b@example.test') on conflict(id) do nothing;
insert into public.profiles(id,display_name,email,company_name,asaas_api_key,asaas_customer_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Owner A','owner-a@example.test','Empresa A',null,null),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Owner B','owner-b@example.test','Empresa B',null,null) on conflict(id) do nothing;
insert into public.clients(user_id,name,phone) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Cliente A','+5511999990001'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Cliente B','+5511999990002');
insert into public.services(user_id,name,unit_price) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Serviço A',100),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Serviço B',200);
insert into public.quotes(user_id,quote_number,client_name,client_phone,items,total) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A-LEGACY','Cliente A','+5511999990001','[]'::jsonb,100),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','B-LEGACY','Cliente B','+5511999990002','[]'::jsonb,200);
