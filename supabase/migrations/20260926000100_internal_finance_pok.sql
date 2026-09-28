-- Internal ORKTO finance workspace. Additive only; never exposed to customer roles.
create table if not exists public.orkto_finance_assumptions (
  id uuid primary key default gen_random_uuid(),
  version bigint generated always as identity unique,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  assumptions jsonb not null,
  change_note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists orkto_finance_assumptions_one_approved_idx
  on public.orkto_finance_assumptions ((status)) where status = 'approved';

create table if not exists public.orkto_finance_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null check (transaction_type in ('revenue', 'expense')),
  category text not null check (category in (
    'subscription', 'infrastructure', 'ai', 'channel', 'payment_processor', 'people', 'tax', 'other'
  )),
  basis text not null default 'actual' check (basis in ('actual', 'normalized')),
  cash_status text not null default 'paid' check (cash_status in ('paid', 'forecast')),
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null,
  workspace_id uuid references auth.users(id) on delete set null,
  provider text,
  model text,
  feature text,
  reference text,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists orkto_finance_transactions_date_idx
  on public.orkto_finance_transactions (occurred_on desc, transaction_type, category);
create index if not exists orkto_finance_transactions_workspace_idx
  on public.orkto_finance_transactions (workspace_id, occurred_on desc) where workspace_id is not null;

alter table public.orkto_finance_assumptions enable row level security;
alter table public.orkto_finance_transactions enable row level security;

-- Access is only through authenticated server routes after checking profiles.is_founder.
revoke all on table public.orkto_finance_assumptions from public, anon, authenticated;
revoke all on table public.orkto_finance_transactions from public, anon, authenticated;
grant all on table public.orkto_finance_assumptions to service_role;
grant all on table public.orkto_finance_transactions to service_role;
grant usage, select on sequence public.orkto_finance_assumptions_version_seq to service_role;

-- Draft reference values only. Prices/plan mix come from the implementation brief and
-- cost assumptions intentionally remain zero until measured values are entered.
insert into public.orkto_finance_assumptions (status, assumptions, change_note)
select 'draft',
  '{
    "currency":"BRL",
    "cogsTargetPercent":15,
    "cogsHardCapPercent":20,
    "monthlyFixedPlatformCostCents":0,
    "infrastructurePerWorkspaceCents":0,
    "aiPerWorkspaceCents":0,
    "paymentProcessingPercent":0,
    "channelPerWorkspaceCents":0,
    "openingCashCents":0,
    "planPricesCents":{"starter":7990,"pro":14990,"business":29990,"scale":59990,"enterprise":149990},
    "planMixPercent":{"starter":60,"pro":25,"business":10,"scale":4,"enterprise":1},
    "scenarios":{"pok":{"revenueFactor":0.7,"costFactor":1.2},"base":{"revenueFactor":1,"costFactor":1},"favorable":{"revenueFactor":1.3,"costFactor":0.9}}
  }'::jsonb,
  'Seed inicial demonstrativo; preços/mix e fatores são hipóteses, não decisões comerciais.'
where not exists (select 1 from public.orkto_finance_assumptions);
