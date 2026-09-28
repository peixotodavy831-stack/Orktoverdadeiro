-- ORKTO Full Operational v0.1: additive workspace and operating-domain schema.
-- Local migration only; do not apply to a remote project without explicit approval.
create extension if not exists pgcrypto;

create table if not exists public.orkto_workspaces (
  id uuid primary key references auth.users(id) on delete cascade,
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'Minha empresa',
  plan_key text not null default 'starter' check (plan_key in ('starter','pro','business','scale','enterprise','founders')),
  subscription_status text not null default 'trial' check (subscription_status in ('trial','active','past_due','suspended','cancelled')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.orkto_workspace_members (
  workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','member')),
  status text not null default 'active' check (status in ('invited','active','suspended')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);
create or replace function public.orkto_is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.orkto_workspace_members m where m.workspace_id=target_workspace and m.user_id=auth.uid() and m.status='active');
$$;
create or replace function public.orkto_is_workspace_admin(target_workspace uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.orkto_workspace_members m where m.workspace_id=target_workspace and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin'));
$$;
create or replace function public.orkto_provision_workspace_for_profile()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.orkto_workspaces(id,owner_user_id,name) values(new.id,new.id,coalesce(nullif(new.company_name,''),nullif(new.display_name,''),'Minha empresa')) on conflict(id) do nothing;
 insert into public.orkto_workspace_members(workspace_id,user_id,role,status,joined_at) values(new.id,new.id,'owner','active',now()) on conflict(workspace_id,user_id) do nothing;
 return new;
end;
$$;
create trigger orkto_profile_provision_workspace after insert on public.profiles for each row execute function public.orkto_provision_workspace_for_profile();
insert into public.orkto_workspaces(id,owner_user_id,name)
 select p.id,p.id,coalesce(nullif(p.company_name,''),nullif(p.display_name,''),'Minha empresa') from public.profiles p on conflict(id) do nothing;
insert into public.orkto_workspace_members(workspace_id,user_id,role,status,joined_at)
 select p.id,p.id,'owner','active',now() from public.profiles p on conflict(workspace_id,user_id) do nothing;

create table if not exists public.orkto_deals (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 customer_ref text, conversation_ref uuid references public.orkto_conversations(id) on delete set null,
 title text not null, description text not null default '', stage text not null default 'new' check(stage in ('new','qualification','proposal','negotiation','won','lost')),
 status text not null default 'open' check(status in ('open','won','lost','archived')), value_cents bigint not null default 0 check(value_cents>=0),
 probability_percent numeric(5,2) check(probability_percent between 0 and 100), priority_override text check(priority_override in ('low','normal','high','urgent')),
 owner_user_id uuid references auth.users(id) on delete set null, expected_close_on date, lost_reason text, source text not null default 'manual',
 metadata jsonb not null default '{}'::jsonb, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.orkto_tasks (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 customer_ref text, deal_id uuid references public.orkto_deals(id) on delete set null, conversation_id uuid references public.orkto_conversations(id) on delete set null,
 title text not null, description text not null default '', status text not null default 'open' check(status in ('open','in_progress','completed','cancelled')),
 due_at timestamptz, assigned_to uuid references auth.users(id) on delete set null, source text not null default 'human' check(source in ('human','wia','automation','system')),
 idempotency_key text, completed_at timestamptz, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,idempotency_key)
);
create table if not exists public.orkto_wia_runs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null, feature text not null, agent text, task_type text,
 status text not null default 'running' check(status in ('running','succeeded','failed','cancelled')), provider text, model text,
 trace_id text not null, context_refs jsonb not null default '[]'::jsonb, summary text, error_category text,
 started_at timestamptz not null default now(), completed_at timestamptz, created_at timestamptz not null default now(), unique(workspace_id,trace_id)
);
create table if not exists public.orkto_wia_chat_messages (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 session_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('user','assistant')), message_key uuid not null, content text not null check(length(content)<=4000),
 run_id uuid references public.orkto_wia_runs(id) on delete set null, created_at timestamptz not null default now(),
 unique(workspace_id,session_id,message_key,role)
);
create table if not exists public.orkto_wia_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 run_id uuid references public.orkto_wia_runs(id) on delete set null, actor_user_id uuid references auth.users(id) on delete set null,
 event_type text not null, source text not null check(source in ('user','channel','wia','agent','tool','system')),
 entity_type text, entity_ref text, idempotency_key text, payload jsonb not null default '{}'::jsonb,
 occurred_at timestamptz not null default now(), unique(workspace_id,idempotency_key)
);
create table if not exists public.orkto_wia_actions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 run_id uuid references public.orkto_wia_runs(id) on delete set null, action_type text not null, payload jsonb not null default '{}'::jsonb,
 rationale text not null default '', risk_level text not null default 'low' check(risk_level in ('low','medium','high','critical')),
 confidence numeric(5,4) check(confidence between 0 and 1), status text not null default 'prepared' check(status in ('prepared','awaiting_approval','approved','rejected','executing','executed','failed','cancelled')),
 requires_approval boolean not null default true, idempotency_key text not null, approved_by uuid references auth.users(id) on delete set null,
 approved_at timestamptz, executed_at timestamptz, result jsonb, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,idempotency_key)
);
create table if not exists public.orkto_wia_tool_calls (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 run_id uuid references public.orkto_wia_runs(id) on delete set null, action_id uuid references public.orkto_wia_actions(id) on delete set null,
 tool_name text not null, status text not null check(status in ('succeeded','failed')), input_digest text,
 output_summary jsonb not null default '{}'::jsonb, error_category text, duration_ms integer not null default 0 check(duration_ms>=0), created_at timestamptz not null default now()
);
create table if not exists public.orkto_wia_memories (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 memory_type text not null check(memory_type in ('raw_event','fact','summary','preference','commercial_pattern','inference')),
 entity_type text not null, entity_ref text, content jsonb not null, provenance jsonb not null default '{}'::jsonb,
 confidence numeric(5,4) check(confidence between 0 and 1), status text not null default 'active' check(status in ('active','superseded','expired','retracted')),
 supersedes uuid references public.orkto_wia_memories(id) on delete set null, expires_at timestamptz,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.orkto_customer_signals (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 customer_ref text not null, conversation_id uuid references public.orkto_conversations(id) on delete set null, signal_type text not null,
 value numeric(12,4), occurred_at timestamptz not null default now(), expires_at timestamptz, provenance jsonb not null default '{}'::jsonb
);
create table if not exists public.orkto_risk_assessments (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 customer_ref text, deal_id uuid references public.orkto_deals(id) on delete set null, score numeric(5,2) not null check(score between 0 and 100),
 confidence numeric(5,4) not null check(confidence between 0 and 1), reasons jsonb not null default '[]'::jsonb, signals jsonb not null default '[]'::jsonb,
 recommended_action text not null, engine_version text not null, assessed_at timestamptz not null default now(), assessed_by text not null default 'system'
);
create table if not exists public.orkto_collection_cases (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 customer_ref text not null, deal_id uuid references public.orkto_deals(id) on delete set null, amount_cents bigint not null check(amount_cents>0), due_at timestamptz not null,
 status text not null default 'open' check(status in ('open','contacted','negotiating','promised','paid','escalated','closed')),
 tone text not null default 'standard' check(tone in ('cordial','standard','firm')), promise_at timestamptz, next_followup_at timestamptz,
 escalated_at timestamptz, idempotency_key text, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,idempotency_key)
);
create table if not exists public.orkto_collection_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 case_id uuid not null references public.orkto_collection_cases(id) on delete cascade, event_type text not null, note text not null default '',
 amount_cents bigint check(amount_cents>=0), actor_user_id uuid references auth.users(id) on delete set null,
 wia_run_id uuid references public.orkto_wia_runs(id) on delete set null, occurred_at timestamptz not null default now()
);
create table if not exists public.orkto_purchases (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 customer_ref text not null, product_ref text, product_name text not null, quantity numeric(12,3) not null default 1 check(quantity>0),
 amount_cents bigint not null check(amount_cents>=0), purchased_at timestamptz not null, source text not null default 'manual',
 idempotency_key text, created_at timestamptz not null default now(), unique(workspace_id,idempotency_key)
);
create table if not exists public.orkto_automations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 feature_key text not null, name text not null, config jsonb not null default '{}'::jsonb, status text not null default 'disabled' check(status in ('active','paused','disabled')),
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,feature_key,name)
);
create table if not exists public.orkto_automation_jobs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 automation_id uuid references public.orkto_automations(id) on delete cascade, entity_type text not null, entity_ref text not null,
 step_key text not null, due_at timestamptz not null, status text not null default 'scheduled' check(status in ('scheduled','processing','completed','cancelled','failed')),
 attempts integer not null default 0 check(attempts>=0), idempotency_key text not null, last_error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,idempotency_key)
);
create table if not exists public.orkto_automation_runs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 automation_id uuid references public.orkto_automations(id) on delete set null, job_id uuid unique references public.orkto_automation_jobs(id) on delete set null,
 status text not null check(status in ('succeeded','failed','skipped','approval_required')), result jsonb not null default '{}'::jsonb,
 error_category text, started_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.orkto_replay_records (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 conversation_id uuid references public.orkto_conversations(id) on delete set null, customer_ref text, objection_type text,
 response_strategy text, outcome text not null check(outcome in ('won','lost','pending','unknown')), conversion_result boolean,
 evidence jsonb not null default '{}'::jsonb, recommendation jsonb, version integer not null default 1, created_at timestamptz not null default now()
);
create table if not exists public.orkto_sussurros (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 conversation_id uuid not null references public.orkto_conversations(id) on delete cascade, from_user_id uuid references auth.users(id) on delete set null,
 to_user_id uuid references auth.users(id) on delete set null, source text not null check(source in ('manager','wia')),
 content text not null check(length(content)<=2000), read_at timestamptz, expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists public.orkto_live_quotes (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 quote_ref text not null, public_token_hash text not null unique, version integer not null default 1, snapshot jsonb not null,
 current_price_cents bigint not null check(current_price_cents>=0), status text not null default 'active' check(status in ('active','viewed','accepted','rejected','expired','revoked')),
 valid_until timestamptz, accepted_at timestamptz, accepted_by_name text, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,quote_ref,version)
);
create table if not exists public.orkto_live_quote_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 live_quote_id uuid not null references public.orkto_live_quotes(id) on delete cascade,
 event_type text not null check(event_type in ('created','viewed','accepted','rejected','expired','revoked')),
 idempotency_key text, occurred_at timestamptz not null default now(), unique(workspace_id,idempotency_key)
);
create table if not exists public.orkto_import_jobs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 source text not null, status text not null default 'preview' check(status in ('preview','validating','ready','importing','completed','failed','rolled_back','cancelled')),
 mapping jsonb not null default '{}'::jsonb, summary jsonb not null default '{}'::jsonb, error_summary jsonb not null default '[]'::jsonb,
 created_by uuid references auth.users(id) on delete set null, started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.orkto_import_rows (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 job_id uuid not null references public.orkto_import_jobs(id) on delete cascade, row_number integer not null check(row_number>0), source_digest text not null,
 mapped_data jsonb not null, status text not null default 'pending' check(status in ('pending','valid','imported','duplicate','error','rolled_back')),
 errors jsonb not null default '[]'::jsonb, imported_ref text, created_at timestamptz not null default now(), unique(job_id,row_number)
);
create table if not exists public.orkto_duplicate_reviews (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 left_customer_ref text not null, right_customer_ref text not null, match_status text not null check(match_status in ('MATCH','POSSIBLE_MATCH','NO_MATCH')),
 score numeric(5,2) not null check(score between 0 and 100), signals jsonb not null default '[]'::jsonb,
 decision text not null default 'pending' check(decision in ('pending','keep_separate','confirm_same','merged')),
 decided_by uuid references auth.users(id) on delete set null, decided_at timestamptz, created_at timestamptz not null default now(), check(left_customer_ref<>right_customer_ref)
);
create table if not exists public.orkto_reports (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 report_type text not null check(report_type in ('DAILY_OPERATIONAL','WEEKLY_TACTICAL','MONTHLY_STRATEGIC','ANNUAL_STRATEGIC')),
 period_start date not null, period_end date not null, metrics jsonb not null, interpretation text, version integer not null default 1 check(version>0),
 wia_run_id uuid references public.orkto_wia_runs(id) on delete set null, generated_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null, unique(workspace_id,report_type,period_start,period_end,version), check(period_end>=period_start)
);
create table if not exists public.orkto_wrapped (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 period_start date not null, period_end date not null, metrics jsonb not null, share_token_hash text unique, shared_at timestamptz,
 created_at timestamptz not null default now(), unique(workspace_id,period_start,period_end)
);
create table if not exists public.orkto_case_studies (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 baseline jsonb not null, after_metrics jsonb not null, comparison jsonb not null,
 status text not null default 'draft' check(status in ('draft','review','approved','opted_in','exported','rejected')),
 opted_in_at timestamptz, reviewed_by uuid references auth.users(id) on delete set null, review_notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.orkto_case_studies add column if not exists share_token_hash text unique;
create table if not exists public.orkto_accounting_exports (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 sale_ref text not null, payload jsonb not null, adapter text not null default 'generic',
 status text not null default 'prepared' check(status in ('prepared','configuration_required','sent','failed')),
 idempotency_key text not null, external_ref text, error_category text, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(workspace_id,idempotency_key)
);
create table if not exists public.orkto_notifications (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade, type text not null, title text not null, body text not null default '',
 entity_type text, entity_ref text, idempotency_key text, read_at timestamptz, created_at timestamptz not null default now(), unique(workspace_id,idempotency_key)
);
create table if not exists public.orkto_feature_configs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 feature_key text not null, status text not null check(status in ('ACTIVE','CONFIGURABLE','EXPERIMENTAL','DISABLED','INTERNAL','PENDING_CONFIGURATION')),
 config jsonb not null default '{}'::jsonb, version integer not null default 1, updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(), unique(workspace_id,feature_key)
);
create table if not exists public.orkto_channel_usage (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 channel text not null, period_start date not null, quantity numeric(14,4) not null default 0 check(quantity>=0),
 cost_cents bigint not null default 0 check(cost_cents>=0), revenue_cents bigint not null default 0 check(revenue_cents>=0),
 source text not null, recorded_at timestamptz not null default now(), unique(workspace_id,channel,period_start,source)
);
create table if not exists public.orkto_collective_memory_items (
 id uuid primary key default gen_random_uuid(), sector_key text not null, pattern_key text not null, aggregate jsonb not null,
 contributing_workspace_count integer not null check(contributing_workspace_count>=5), anonymization_version text not null,
 provenance jsonb not null, status text not null default 'staged' check(status in ('staged','legal_review','approved','disabled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(sector_key,pattern_key,anonymization_version)
);
-- Contributions contain workspace-local aggregates only; cross-workspace aggregation stays legally gated.
create table if not exists public.orkto_collective_memory_contributions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 sector_key text not null, pattern_key text not null, aggregate jsonb not null,
 consent_status text not null default 'disabled' check(consent_status in ('disabled','staged','approved','retracted')),
 contribution_version integer not null default 1 check(contribution_version>0), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(workspace_id,sector_key,pattern_key,contribution_version)
);
alter table public.orkto_conversations add column if not exists priority_override text check(priority_override in ('low','normal','high','urgent'));
create table if not exists public.orkto_plan_catalog (
 plan_key text primary key check(plan_key in ('starter','pro','business','scale','enterprise','founders')),
 display_name text not null, price_cents bigint check(price_cents>=0), currency text not null default 'BRL' check(currency='BRL'),
 price_is_public boolean not null default false, status text not null default 'draft' check(status in ('draft','approved')),
 entitlements jsonb not null default '{}'::jsonb,
 version integer not null default 1, effective_from timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.orkto_plan_catalog(plan_key,display_name,price_cents,price_is_public,status,entitlements) values
 ('starter','Starter',null,false,'draft','{}'::jsonb),('pro','Pro',null,false,'draft','{}'::jsonb),
 ('business','Business',null,false,'draft','{}'::jsonb),('scale','Scale',null,false,'draft','{}'::jsonb),
 ('enterprise','Enterprise',null,false,'draft','{}'::jsonb),('founders','Founders',null,false,'draft','{}'::jsonb)
on conflict(plan_key) do nothing;
create table if not exists public.orkto_plan_price_versions (
 id uuid primary key default gen_random_uuid(), plan_key text not null references public.orkto_plan_catalog(plan_key),
 version integer not null check(version>0), price_cents bigint check(price_cents>=0), currency text not null default 'BRL' check(currency='BRL'),
 price_is_public boolean not null default false, status text not null default 'draft' check(status in ('draft','approved','retired')),
 entitlements jsonb not null default '{}'::jsonb, effective_from timestamptz not null, effective_until timestamptz,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 unique(plan_key,version), check(effective_until is null or effective_until>effective_from)
);
create table if not exists public.orkto_workspace_subscriptions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 plan_key text not null references public.orkto_plan_catalog(plan_key), status text not null check(status in ('trial','active','past_due','suspended','cancelled')),
 trial_ends_at timestamptz, current_period_start timestamptz, current_period_end timestamptz,
 external_customer_ref text, external_subscription_ref text, cancel_at_period_end boolean not null default false,
 idempotency_key text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,idempotency_key)
);
create table if not exists public.orkto_plan_usage (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 period_start date not null, feature_key text not null, quantity numeric(14,4) not null default 0 check(quantity>=0),
 updated_at timestamptz not null default now(), unique(workspace_id,period_start,feature_key)
);
create table if not exists public.orkto_workspace_invites (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
 email text not null, role text not null check(role in ('admin','manager','member')), token_hash text not null unique,
 status text not null default 'invited' check(status in ('invited','accepted','revoked','expired')),
 invited_by uuid not null references auth.users(id) on delete cascade, expires_at timestamptz not null,
 accepted_by uuid references auth.users(id) on delete set null, accepted_at timestamptz, created_at timestamptz not null default now()
);

create index if not exists orkto_deals_workspace_stage_idx on public.orkto_deals(workspace_id,status,stage,updated_at desc);
create index if not exists orkto_tasks_workspace_due_idx on public.orkto_tasks(workspace_id,status,due_at);
create index if not exists orkto_wia_runs_workspace_created_idx on public.orkto_wia_runs(workspace_id,created_at desc);
create index if not exists orkto_wia_chat_session_created_idx on public.orkto_wia_chat_messages(workspace_id,session_id,created_at desc);
create index if not exists orkto_wia_events_workspace_time_idx on public.orkto_wia_events(workspace_id,occurred_at desc);
create index if not exists orkto_wia_actions_workspace_status_idx on public.orkto_wia_actions(workspace_id,status,created_at desc);
create index if not exists orkto_wia_memories_lookup_idx on public.orkto_wia_memories(workspace_id,entity_type,entity_ref,memory_type,created_at desc);
create index if not exists orkto_signals_workspace_customer_idx on public.orkto_customer_signals(workspace_id,customer_ref,occurred_at desc);
create index if not exists orkto_risk_workspace_latest_idx on public.orkto_risk_assessments(workspace_id,customer_ref,assessed_at desc);
create index if not exists orkto_collection_workspace_status_idx on public.orkto_collection_cases(workspace_id,status,due_at);
create index if not exists orkto_automation_jobs_due_idx on public.orkto_automation_jobs(status,due_at) where status='scheduled';
create index if not exists orkto_replay_workspace_outcome_idx on public.orkto_replay_records(workspace_id,outcome,objection_type);
create index if not exists orkto_sussurros_inbox_idx on public.orkto_sussurros(workspace_id,to_user_id,read_at,expires_at);
create index if not exists orkto_notifications_inbox_idx on public.orkto_notifications(workspace_id,user_id,read_at,created_at desc);
create index if not exists orkto_import_rows_job_idx on public.orkto_import_rows(workspace_id,job_id,status);
alter table public.clients add column if not exists orkto_import_job_id uuid;
alter table public.clients add column if not exists orkto_import_row_id uuid;
create unique index if not exists orkto_clients_import_row_uidx on public.clients(orkto_import_row_id);

alter table public.orkto_workspaces enable row level security;
alter table public.orkto_workspace_members enable row level security;
create policy orkto_workspaces_member_access on public.orkto_workspaces for select to authenticated using(public.orkto_is_workspace_member(id));
create policy orkto_members_member_read on public.orkto_workspace_members for select to authenticated using(public.orkto_is_workspace_member(workspace_id));
grant select on public.orkto_workspaces,public.orkto_workspace_members to authenticated;
grant all on public.orkto_workspaces,public.orkto_workspace_members to service_role;

do $$
declare tbl text;
begin
 foreach tbl in array array['orkto_deals','orkto_tasks','orkto_wia_runs','orkto_wia_chat_messages','orkto_wia_events','orkto_wia_actions','orkto_wia_tool_calls','orkto_wia_memories','orkto_customer_signals','orkto_risk_assessments','orkto_collection_cases','orkto_collection_events','orkto_purchases','orkto_automations','orkto_automation_jobs','orkto_automation_runs','orkto_replay_records','orkto_sussurros','orkto_live_quotes','orkto_live_quote_events','orkto_import_jobs','orkto_import_rows','orkto_duplicate_reviews','orkto_reports','orkto_wrapped','orkto_case_studies','orkto_accounting_exports','orkto_notifications','orkto_feature_configs','orkto_channel_usage','orkto_workspace_subscriptions','orkto_plan_usage','orkto_collective_memory_contributions'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('create policy %I on public.%I for all to authenticated using(public.orkto_is_workspace_member(workspace_id)) with check(public.orkto_is_workspace_member(workspace_id))',tbl||'_workspace_access',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  execute format('grant all on public.%I to service_role',tbl);
 end loop;
end $$;
alter table public.orkto_workspace_invites enable row level security;
create policy orkto_workspace_invites_admin_access on public.orkto_workspace_invites for all to authenticated using(public.orkto_is_workspace_admin(workspace_id)) with check(public.orkto_is_workspace_admin(workspace_id));
grant select on public.orkto_workspace_invites to authenticated;
grant all on public.orkto_workspace_invites to service_role;
alter table public.orkto_plan_catalog enable row level security;
revoke all on public.orkto_plan_catalog from public,anon,authenticated;
grant select,insert,update,delete on public.orkto_plan_catalog to service_role;
alter table public.orkto_plan_price_versions enable row level security;
revoke all on public.orkto_plan_price_versions from public,anon,authenticated;
grant select,insert,update,delete on public.orkto_plan_price_versions to service_role;
alter table public.orkto_collective_memory_items enable row level security;
revoke all on public.orkto_collective_memory_items from public,anon,authenticated;
grant all on public.orkto_collective_memory_items to service_role;
grant execute on function public.orkto_is_workspace_member(uuid) to authenticated,service_role;
grant execute on function public.orkto_is_workspace_admin(uuid) to authenticated,service_role;
grant execute on function public.orkto_provision_workspace_for_profile() to service_role;
