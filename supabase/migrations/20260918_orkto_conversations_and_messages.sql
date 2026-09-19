-- ORKTO Onda 0/1: schema canonico da Inbox assistida.
create extension if not exists pgcrypto;

create table if not exists public.orkto_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_name text not null,
  contact_phone text not null,
  status text not null default 'open' check (status in ('open', 'active', 'paused', 'closed', 'archived')),
  source_channel text not null default 'whatsapp' check (source_channel in ('whatsapp', 'manual', 'instagram', 'web')),
  mood_state text not null default 'neutral' check (mood_state in ('green', 'yellow', 'red', 'blue', 'neutral')),
  priority_score numeric(6,2) not null default 0,
  priority_reason text,
  risk_score numeric(6,2),
  external_thread_id text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_channel, contact_phone)
);

create table if not exists public.orkto_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.orkto_conversations(id) on delete cascade,
  sender_role text not null check (sender_role in ('contact', 'operator', 'bot', 'system')),
  content text not null,
  message_type text not null default 'text' check (message_type in ('text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'system')),
  direction text not null check (direction in ('incoming', 'outgoing', 'internal')),
  external_event_id text,
  sent_at timestamptz not null default now(),
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists orkto_messages_external_event_uidx
  on public.orkto_messages (external_event_id) where external_event_id is not null;

create table if not exists public.orkto_approval_tasks (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.orkto_conversations(id) on delete cascade,
  task_type text not null default 'response_suggestion',
  bot_name text not null,
  proposed_content text not null,
  proposed_action jsonb,
  reason text not null,
  policy_applied text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'edited', 'scheduled', 'cancelled')),
  trace_id text,
  expires_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orkto_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.orkto_conversations(id) on delete set null,
  approval_task_id uuid references public.orkto_approval_tasks(id) on delete set null,
  event_type text not null,
  actor_type text not null check (actor_type in ('human', 'bot', 'system')),
  actor_id text,
  trace_id text,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orkto_conversations_user_updated_idx on public.orkto_conversations (user_id, updated_at desc);
create index if not exists orkto_conversations_user_priority_idx on public.orkto_conversations (user_id, priority_score desc);
create index if not exists orkto_messages_conversation_sent_idx on public.orkto_messages (conversation_id, sent_at);
create index if not exists orkto_approval_tasks_conversation_status_idx on public.orkto_approval_tasks (conversation_id, status, created_at);
create index if not exists orkto_audit_log_user_created_idx on public.orkto_audit_log (user_id, created_at desc);

alter table public.orkto_conversations enable row level security;
alter table public.orkto_messages enable row level security;
alter table public.orkto_approval_tasks enable row level security;
alter table public.orkto_audit_log enable row level security;

create policy "orkto_conversations_select_own" on public.orkto_conversations for select to authenticated using ((select auth.uid()) = user_id);
create policy "orkto_conversations_insert_own" on public.orkto_conversations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "orkto_conversations_update_own" on public.orkto_conversations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "orkto_conversations_delete_own" on public.orkto_conversations for delete to authenticated using ((select auth.uid()) = user_id);

create policy "orkto_messages_select_own" on public.orkto_messages for select to authenticated using (
  exists (select 1 from public.orkto_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
);
create policy "orkto_messages_insert_own" on public.orkto_messages for insert to authenticated with check (
  exists (select 1 from public.orkto_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
);
create policy "orkto_messages_update_own" on public.orkto_messages for update to authenticated using (
  exists (select 1 from public.orkto_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.orkto_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
);

create policy "orkto_approval_tasks_select_own" on public.orkto_approval_tasks for select to authenticated using (
  exists (select 1 from public.orkto_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
);
create policy "orkto_approval_tasks_insert_own" on public.orkto_approval_tasks for insert to authenticated with check (
  exists (select 1 from public.orkto_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
);
create policy "orkto_approval_tasks_update_own" on public.orkto_approval_tasks for update to authenticated using (
  exists (select 1 from public.orkto_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.orkto_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
);

create policy "orkto_audit_log_select_own" on public.orkto_audit_log for select to authenticated using ((select auth.uid()) = user_id);
create policy "orkto_audit_log_insert_own" on public.orkto_audit_log for insert to authenticated with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.orkto_conversations to authenticated;
grant select, insert, update on public.orkto_messages to authenticated;
grant select, insert, update on public.orkto_approval_tasks to authenticated;
grant select, insert on public.orkto_audit_log to authenticated;
