create table if not exists public.orkto_model_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trace_id text not null,
  provider text not null,
  model text not null,
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  mode text not null check (mode in ('live', 'simulated')),
  created_at timestamptz not null default now(),
  unique (user_id, trace_id)
);

create index if not exists orkto_model_usage_user_created_idx
  on public.orkto_model_usage (user_id, created_at desc);

alter table public.orkto_model_usage enable row level security;

create policy "orkto_model_usage_select_own" on public.orkto_model_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.orkto_model_usage to authenticated;
