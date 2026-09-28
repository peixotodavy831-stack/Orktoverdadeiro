-- ORKTO convergence: durable payment idempotency, webhook replay protection,
-- and truthful channel delivery states. Additive only; no provider is enabled.

alter table public.asaas_webhook_events
  add column if not exists request_fingerprint text,
  add column if not exists status text not null default 'processed',
  add column if not exists attempt_count integer not null default 1,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processed_at timestamptz,
  add column if not exists last_error_category text,
  add column if not exists updated_at timestamptz not null default now();
do $$ begin
  if not exists (select 1 from pg_constraint where conname='asaas_webhook_events_status_check') then
    alter table public.asaas_webhook_events add constraint asaas_webhook_events_status_check
      check(status in ('processing','processed','failed'));
  end if;
  if not exists (select 1 from pg_constraint where conname='asaas_webhook_events_attempt_count_check') then
    alter table public.asaas_webhook_events add constraint asaas_webhook_events_attempt_count_check check(attempt_count>0);
  end if;
  if not exists (select 1 from pg_constraint where conname='asaas_webhook_events_fingerprint_check') then
    alter table public.asaas_webhook_events add constraint asaas_webhook_events_fingerprint_check
      check(request_fingerprint is null or request_fingerprint ~ '^[a-f0-9]{64}$');
  end if;
end $$;
update public.asaas_webhook_events set processed_at=coalesce(processed_at,received_at),updated_at=coalesce(updated_at,received_at)
where status='processed';

create table if not exists public.orkto_payment_intents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
  quote_id uuid,
  provider text not null check(length(provider) between 1 and 80),
  idempotency_key text not null check(length(idempotency_key) between 8 and 200),
  request_fingerprint text not null check(request_fingerprint ~ '^[a-f0-9]{64}$'),
  amount_cents bigint not null check(amount_cents>0),
  currency text not null default 'BRL' check(currency ~ '^[A-Z]{3}$'),
  status text not null default 'prepared' check(status in ('prepared','submitting','request_accepted','reconciliation_required','succeeded','failed','cancelled')),
  provider_reference text,
  provider_status text,
  attempt_count integer not null default 0 check(attempt_count>=0),
  active_claim_token uuid,
  lease_expires_at timestamptz,
  last_provider_event_at timestamptz,
  last_provider_event_id text,
  last_error_category text,
  terminal_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orkto_payment_intents_quote_workspace_fkey foreign key(quote_id,workspace_id)
    references public.quotes(id,workspace_id) on delete restrict,
  unique(workspace_id,provider,idempotency_key)
);
create unique index if not exists orkto_payment_provider_reference_uidx
  on public.orkto_payment_intents(provider,provider_reference) where provider_reference is not null;
create index if not exists orkto_payment_intents_workspace_status_idx
  on public.orkto_payment_intents(workspace_id,status,created_at desc);

create table if not exists public.orkto_payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check(length(provider) between 1 and 80),
  provider_event_id text not null check(length(provider_event_id) between 1 and 240),
  request_fingerprint text check(request_fingerprint is null or request_fingerprint ~ '^[a-f0-9]{64}$'),
  event_type text not null check(length(event_type) between 1 and 120),
  occurred_at timestamptz,
  status text not null default 'processing' check(status in ('processing','processed','failed','ignored_stale')),
  attempt_count integer not null default 1 check(attempt_count>0),
  processing_claim_token uuid not null default gen_random_uuid(),
  processing_started_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);
create index if not exists orkto_payment_webhook_status_idx on public.orkto_payment_webhook_events(status,updated_at);

-- Preserve legacy Asaas deduplication keys as already processed events.
insert into public.orkto_payment_webhook_events(provider,provider_event_id,event_type,status,attempt_count,processed_at,created_at,updated_at)
select 'asaas',event_id,event_type,'processed',greatest(1,attempt_count),coalesce(processed_at,received_at),received_at,coalesce(updated_at,received_at)
from public.asaas_webhook_events
on conflict(provider,provider_event_id) do nothing;

create table if not exists public.orkto_channel_send_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
  conversation_id uuid not null,
  channel text not null check(length(channel) between 1 and 80),
  provider text not null check(length(provider) between 1 and 80),
  idempotency_key text not null check(length(idempotency_key) between 8 and 200),
  request_fingerprint text not null check(request_fingerprint ~ '^[a-f0-9]{64}$'),
  status text not null default 'PREPARED' check(status in ('PREPARED','QUEUED','REQUEST_ACCEPTED','PROVIDER_ACKNOWLEDGED','DELIVERED','FAILED','UNKNOWN')),
  provider_message_id text,
  failure_category text,
  attempt_count integer not null default 0 check(attempt_count>=0),
  accepted_at timestamptz,
  acknowledged_at timestamptz,
  delivered_at timestamptz,
  last_status_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orkto_channel_send_conversation_workspace_fkey foreign key(conversation_id,workspace_id)
    references public.orkto_conversations(id,workspace_id) on delete cascade,
  unique(workspace_id,channel,idempotency_key),
  unique(id,workspace_id)
);
create index if not exists orkto_channel_send_status_idx
  on public.orkto_channel_send_requests(workspace_id,status,created_at desc);
create unique index if not exists orkto_channel_send_provider_message_uidx
  on public.orkto_channel_send_requests(workspace_id,provider,provider_message_id)
  where provider_message_id is not null;

create table if not exists public.orkto_channel_delivery_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  send_request_id uuid not null,
  provider text not null,
  provider_event_id text not null,
  payload_fingerprint text not null check(payload_fingerprint ~ '^[a-f0-9]{64}$'),
  provider_message_id text not null,
  status text not null check(status in ('PROVIDER_ACKNOWLEDGED','DELIVERED','FAILED','UNKNOWN')),
  failure_category text,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  constraint orkto_channel_delivery_send_workspace_fkey foreign key(send_request_id,workspace_id)
    references public.orkto_channel_send_requests(id,workspace_id) on delete cascade,
  unique(provider,provider_event_id)
);
create index if not exists orkto_channel_delivery_request_time_idx
  on public.orkto_channel_delivery_events(workspace_id,send_request_id,occurred_at desc);

do $$ declare tbl text; begin
  foreach tbl in array array['orkto_payment_intents','orkto_payment_webhook_events','orkto_channel_send_requests','orkto_channel_delivery_events'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all privileges on table public.%I from PUBLIC,anon,authenticated',tbl);
    execute format('grant all privileges on table public.%I to service_role',tbl);
  end loop;
end $$;

create or replace function public.orkto_claim_payment_intent(
  p_workspace_id uuid,p_quote_id uuid,p_provider text,p_idempotency_key text,p_request_fingerprint text,
  p_amount_cents bigint,p_currency text default 'BRL'
) returns table(decision text,intent_id uuid,intent_status text,claim_token uuid,attempt_count integer,provider_reference text)
language plpgsql security definer set search_path=public as $$
declare v public.orkto_payment_intents%rowtype; inserted_count integer;
begin
  if p_workspace_id is null or p_provider is null or nullif(trim(p_provider),'') is null or length(p_provider)>80
    or p_idempotency_key is null or length(trim(p_idempotency_key))<8 or length(p_idempotency_key)>200
    or p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$'
    or p_amount_cents is null or p_amount_cents<=0 or p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid payment intent request' using errcode='22023';
  end if;
  insert into public.orkto_payment_intents(workspace_id,quote_id,provider,idempotency_key,request_fingerprint,amount_cents,currency)
  values(p_workspace_id,p_quote_id,p_provider,trim(p_idempotency_key),p_request_fingerprint,p_amount_cents,p_currency)
  on conflict(workspace_id,provider,idempotency_key) do nothing;
  get diagnostics inserted_count = row_count;
  select pi.* into v from public.orkto_payment_intents pi
    where pi.workspace_id=p_workspace_id and pi.provider=p_provider and pi.idempotency_key=trim(p_idempotency_key) for update;
  if v.id is null then raise exception 'payment intent reservation failed' using errcode='40001'; end if;
  if v.request_fingerprint<>p_request_fingerprint or v.amount_cents<>p_amount_cents or v.currency<>p_currency or v.quote_id is distinct from p_quote_id then
    return query select 'IDEMPOTENCY_CONFLICT'::text,v.id,v.status,v.active_claim_token,v.attempt_count,v.provider_reference; return;
  end if;
  if v.status='succeeded' then return query select 'REPLAY_SUCCEEDED'::text,v.id,v.status,v.active_claim_token,v.attempt_count,v.provider_reference; return; end if;
  if v.status in ('failed','cancelled') then return query select 'TERMINAL'::text,v.id,v.status,v.active_claim_token,v.attempt_count,v.provider_reference; return; end if;
  if v.status='request_accepted' then return query select 'REQUEST_ACCEPTED'::text,v.id,v.status,v.active_claim_token,v.attempt_count,v.provider_reference; return; end if;
  if v.status='reconciliation_required' then return query select 'RECONCILIATION_REQUIRED'::text,v.id,v.status,v.active_claim_token,v.attempt_count,v.provider_reference; return; end if;
  if v.status='submitting' and coalesce(v.lease_expires_at,now())>now() then
    return query select 'IN_PROGRESS'::text,v.id,v.status,v.active_claim_token,v.attempt_count,v.provider_reference; return;
  elsif v.status='submitting' then
    update public.orkto_payment_intents pi set status='reconciliation_required',active_claim_token=null,lease_expires_at=null,updated_at=now()
      where pi.id=v.id returning pi.* into v;
    return query select 'RECONCILIATION_REQUIRED'::text,v.id,v.status,v.active_claim_token,v.attempt_count,v.provider_reference; return;
  end if;
  update public.orkto_payment_intents pi set status='submitting',attempt_count=pi.attempt_count+1,
    active_claim_token=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes',updated_at=now()
    where pi.id=v.id returning pi.* into v;
  return query select 'RESERVED'::text,v.id,v.status,v.active_claim_token,v.attempt_count,v.provider_reference;
end $$;

create or replace function public.orkto_finish_payment_intent(
  p_intent_id uuid,p_claim_token uuid,p_target_status text,p_provider_reference text default null,
  p_provider_status text default null,p_error_category text default null
) returns boolean language plpgsql security definer set search_path=public as $$
declare v public.orkto_payment_intents%rowtype;
begin
  if p_target_status is null or p_target_status not in ('request_accepted','reconciliation_required','succeeded','failed') then
    raise exception 'invalid payment intent transition' using errcode='22023';
  end if;
  if p_target_status in ('request_accepted','succeeded') and nullif(trim(p_provider_reference),'') is null then
    raise exception 'provider reference required for accepted or successful payment' using errcode='22023';
  end if;
  select pi.* into v from public.orkto_payment_intents pi where pi.id=p_intent_id for update;
  if v.id is null then return false; end if;
  if v.status in ('succeeded','failed','cancelled') then return v.status=p_target_status; end if;
  if v.status<>'submitting' or v.active_claim_token is distinct from p_claim_token then return false; end if;
  update public.orkto_payment_intents pi set status=p_target_status,
    provider_reference=coalesce(nullif(trim(p_provider_reference),''),pi.provider_reference),
    provider_status=coalesce(nullif(trim(p_provider_status),''),pi.provider_status),
    last_error_category=case when p_target_status in ('failed','reconciliation_required') then nullif(left(p_error_category,80),'') else null end,
    active_claim_token=null,lease_expires_at=null,
    terminal_at=case when p_target_status in ('succeeded','failed') then now() else null end,updated_at=now()
  where pi.id=p_intent_id;
  return true;
end $$;

create or replace function public.orkto_claim_payment_webhook_event(
  p_provider text,p_provider_event_id text,p_event_type text,p_request_fingerprint text,p_occurred_at timestamptz default null
) returns table(decision text,event_record_id uuid,attempt_count integer,claim_token uuid)
language plpgsql security definer set search_path=public as $$
declare v public.orkto_payment_webhook_events%rowtype; inserted_count integer;
begin
  if p_provider is null or nullif(trim(p_provider),'') is null or length(p_provider)>80 or p_provider_event_id is null or nullif(trim(p_provider_event_id),'') is null
    or length(p_provider_event_id)>240 or nullif(trim(p_event_type),'') is null or length(p_event_type)>120
    or p_event_type is null or p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'invalid payment webhook event' using errcode='22023'; end if;
  insert into public.orkto_payment_webhook_events(provider,provider_event_id,event_type,request_fingerprint,occurred_at,status,attempt_count,processing_claim_token)
  values(trim(p_provider),trim(p_provider_event_id),trim(p_event_type),p_request_fingerprint,p_occurred_at,'processing',1,gen_random_uuid())
  on conflict(provider,provider_event_id) do nothing;
  get diagnostics inserted_count = row_count;
  select e.* into v from public.orkto_payment_webhook_events e
    where e.provider=trim(p_provider) and e.provider_event_id=trim(p_provider_event_id) for update;
  if v.request_fingerprint is distinct from p_request_fingerprint or v.event_type<>trim(p_event_type) then
    return query select 'PAYLOAD_CONFLICT'::text,v.id,v.attempt_count,null::uuid; return;
  end if;
  if v.status in ('processed','ignored_stale') then return query select 'DUPLICATE'::text,v.id,v.attempt_count,null::uuid; return; end if;
  if v.status='processing' and v.processing_started_at>now()-interval '5 minutes' and inserted_count=0 then
    return query select 'IN_PROGRESS'::text,v.id,v.attempt_count,null::uuid; return;
  end if;
  if v.attempt_count>=8 then return query select 'RETRY_LIMIT'::text,v.id,v.attempt_count,null::uuid; return; end if;
  if inserted_count=0 then
    update public.orkto_payment_webhook_events e set status='processing',attempt_count=e.attempt_count+1,
      processing_claim_token=gen_random_uuid(),processing_started_at=now(),updated_at=now(),last_error_category=null where e.id=v.id returning e.* into v;
  end if;
  return query select case when inserted_count=1 then 'CLAIMED' else 'RETRY' end::text,v.id,v.attempt_count,v.processing_claim_token;
end $$;

create or replace function public.orkto_finish_payment_webhook_event(
  p_provider text,p_provider_event_id text,p_request_fingerprint text,p_claim_token uuid,p_target_status text,p_error_category text default null
) returns boolean language plpgsql security definer set search_path=public as $$
begin
  if p_provider is null or p_provider_event_id is null or p_request_fingerprint is null or p_claim_token is null
    or p_target_status is null or p_target_status not in ('processed','failed','ignored_stale') then
    raise exception 'invalid webhook completion' using errcode='22023';
  end if;
  update public.orkto_payment_webhook_events e set status=p_target_status,
    processed_at=case when p_target_status in ('processed','ignored_stale') then now() else null end,
    last_error_category=case when p_target_status='failed' then nullif(left(p_error_category,80),'') else null end,updated_at=now()
  where e.provider=trim(p_provider) and e.provider_event_id=trim(p_provider_event_id)
    and e.request_fingerprint=p_request_fingerprint and e.processing_claim_token=p_claim_token and e.status='processing';
  return found;
end $$;

create or replace function public.orkto_reserve_channel_send(
  p_workspace_id uuid,p_conversation_id uuid,p_channel text,p_provider text,p_idempotency_key text,p_request_fingerprint text
) returns table(decision text,send_request_id uuid,send_status text,provider_message_id text)
language plpgsql security definer set search_path=public as $$
declare v public.orkto_channel_send_requests%rowtype; inserted_count integer;
begin
  if p_workspace_id is null or p_conversation_id is null or p_channel is null or p_provider is null
    or nullif(trim(p_channel),'') is null or nullif(trim(p_provider),'') is null
    or p_idempotency_key is null or length(trim(p_idempotency_key))<8 or length(p_idempotency_key)>200
    or p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'invalid channel send reservation' using errcode='22023'; end if;
  insert into public.orkto_channel_send_requests(workspace_id,conversation_id,channel,provider,idempotency_key,request_fingerprint,status)
  values(p_workspace_id,p_conversation_id,trim(p_channel),trim(p_provider),trim(p_idempotency_key),p_request_fingerprint,'PREPARED')
  on conflict(workspace_id,channel,idempotency_key) do nothing;
  get diagnostics inserted_count = row_count;
  select s.* into v from public.orkto_channel_send_requests s where s.workspace_id=p_workspace_id
    and s.channel=trim(p_channel) and s.idempotency_key=trim(p_idempotency_key) for update;
  if v.id is null then raise exception 'channel send reservation failed' using errcode='40001'; end if;
  if v.conversation_id<>p_conversation_id or v.provider<>trim(p_provider) or v.request_fingerprint<>p_request_fingerprint then
    return query select 'IDEMPOTENCY_CONFLICT'::text,v.id,v.status,v.provider_message_id; return;
  end if;
  if inserted_count=1 then return query select 'RESERVED'::text,v.id,v.status,v.provider_message_id; return; end if;
  if v.status in ('PREPARED','QUEUED') then return query select 'IN_PROGRESS'::text,v.id,v.status,v.provider_message_id; return; end if;
  if v.status='UNKNOWN' then return query select 'RECONCILIATION_REQUIRED'::text,v.id,v.status,v.provider_message_id; return; end if;
  return query select 'REPLAY'::text,v.id,v.status,v.provider_message_id;
end $$;

create or replace function public.orkto_mark_channel_send(
  p_workspace_id uuid,p_send_request_id uuid,p_target_status text,p_provider_message_id text default null,
  p_failure_category text default null,p_occurred_at timestamptz default now()
) returns text language plpgsql security definer set search_path=public as $$
declare v public.orkto_channel_send_requests%rowtype;
begin
  if p_target_status is null or p_target_status not in ('QUEUED','REQUEST_ACCEPTED','PROVIDER_ACKNOWLEDGED','DELIVERED','FAILED','UNKNOWN') then
    raise exception 'invalid channel status' using errcode='22023';
  end if;
  if p_target_status in ('REQUEST_ACCEPTED','PROVIDER_ACKNOWLEDGED','DELIVERED') and nullif(trim(p_provider_message_id),'') is null then
    raise exception 'provider message ID required for acknowledged delivery state' using errcode='22023';
  end if;
  select s.* into v from public.orkto_channel_send_requests s where s.id=p_send_request_id and s.workspace_id=p_workspace_id for update;
  if v.id is null then return 'NOT_FOUND'; end if;
  if v.status='DELIVERED' and p_target_status<>'DELIVERED' then return 'STALE_IGNORED'; end if;
  if v.last_status_at is not null and p_occurred_at<v.last_status_at then return 'STALE_IGNORED'; end if;
  if v.provider_message_id is not null and nullif(trim(p_provider_message_id),'') is not null and v.provider_message_id<>trim(p_provider_message_id) then
    return 'PROVIDER_REFERENCE_CONFLICT';
  end if;
  update public.orkto_channel_send_requests s set status=p_target_status,
    provider_message_id=coalesce(nullif(trim(p_provider_message_id),''),s.provider_message_id),
    failure_category=case when p_target_status='FAILED' then nullif(left(p_failure_category,80),'') else null end,
    accepted_at=case when p_target_status='REQUEST_ACCEPTED' then coalesce(s.accepted_at,p_occurred_at) else s.accepted_at end,
    acknowledged_at=case when p_target_status='PROVIDER_ACKNOWLEDGED' then coalesce(s.acknowledged_at,p_occurred_at) else s.acknowledged_at end,
    delivered_at=case when p_target_status='DELIVERED' then coalesce(s.delivered_at,p_occurred_at) else s.delivered_at end,
    last_status_at=p_occurred_at,attempt_count=s.attempt_count+case when p_target_status='QUEUED' then 1 else 0 end,updated_at=now()
    where s.id=p_send_request_id and s.workspace_id=p_workspace_id;
  return 'APPLIED';
end $$;

create or replace function public.orkto_record_channel_delivery_event(
  p_workspace_id uuid,p_send_request_id uuid,p_provider text,p_provider_event_id text,p_payload_fingerprint text,
  p_provider_message_id text,p_status text,p_occurred_at timestamptz,p_failure_category text default null
) returns text language plpgsql security definer set search_path=public as $$
declare v public.orkto_channel_send_requests%rowtype; ev public.orkto_channel_delivery_events%rowtype; inserted_count integer;
begin
  if p_status is null or p_status not in ('PROVIDER_ACKNOWLEDGED','DELIVERED','FAILED','UNKNOWN') or p_workspace_id is null or p_send_request_id is null
    or p_provider is null or p_provider_event_id is null or p_provider_message_id is null
    or nullif(trim(p_provider),'') is null or nullif(trim(p_provider_event_id),'') is null
    or p_payload_fingerprint is null or p_payload_fingerprint !~ '^[a-f0-9]{64}$' or nullif(trim(p_provider_message_id),'') is null or p_occurred_at is null then
    raise exception 'invalid channel delivery receipt' using errcode='22023';
  end if;
  select s.* into v from public.orkto_channel_send_requests s where s.id=p_send_request_id and s.workspace_id=p_workspace_id for update;
  if v.id is null then return 'NOT_FOUND'; end if;
  if v.provider<>trim(p_provider) or (v.provider_message_id is not null and v.provider_message_id<>trim(p_provider_message_id)) then
    return 'PROVIDER_REFERENCE_CONFLICT';
  end if;
  insert into public.orkto_channel_delivery_events(workspace_id,send_request_id,provider,provider_event_id,payload_fingerprint,provider_message_id,status,failure_category,occurred_at)
  values(p_workspace_id,p_send_request_id,trim(p_provider),trim(p_provider_event_id),p_payload_fingerprint,trim(p_provider_message_id),p_status,nullif(left(p_failure_category,80),''),p_occurred_at)
  on conflict(provider,provider_event_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count=0 then
    select e.* into ev from public.orkto_channel_delivery_events e where e.provider=trim(p_provider) and e.provider_event_id=trim(p_provider_event_id);
    if ev.workspace_id<>p_workspace_id or ev.send_request_id<>p_send_request_id or ev.payload_fingerprint<>p_payload_fingerprint then return 'EVENT_CONFLICT'; end if;
    return 'DUPLICATE';
  end if;
  if (v.status='DELIVERED' and p_status<>'DELIVERED') or (v.last_status_at is not null and p_occurred_at<v.last_status_at) then return 'STALE_IGNORED'; end if;
  update public.orkto_channel_send_requests s set status=p_status,provider_message_id=trim(p_provider_message_id),
    failure_category=case when p_status='FAILED' then nullif(left(p_failure_category,80),'') else null end,
    acknowledged_at=case when p_status='PROVIDER_ACKNOWLEDGED' then coalesce(s.acknowledged_at,p_occurred_at) else s.acknowledged_at end,
    delivered_at=case when p_status='DELIVERED' then coalesce(s.delivered_at,p_occurred_at) else s.delivered_at end,
    last_status_at=p_occurred_at,updated_at=now() where s.id=p_send_request_id and s.workspace_id=p_workspace_id;
  return 'APPLIED';
end $$;

revoke all on function public.orkto_claim_payment_intent(uuid,uuid,text,text,text,bigint,text) from PUBLIC,anon,authenticated;
grant execute on function public.orkto_claim_payment_intent(uuid,uuid,text,text,text,bigint,text) to service_role;
revoke all on function public.orkto_finish_payment_intent(uuid,uuid,text,text,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.orkto_finish_payment_intent(uuid,uuid,text,text,text,text) to service_role;
revoke all on function public.orkto_claim_payment_webhook_event(text,text,text,text,timestamptz) from PUBLIC,anon,authenticated;
grant execute on function public.orkto_claim_payment_webhook_event(text,text,text,text,timestamptz) to service_role;
revoke all on function public.orkto_finish_payment_webhook_event(text,text,text,uuid,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.orkto_finish_payment_webhook_event(text,text,text,uuid,text,text) to service_role;
revoke all on function public.orkto_reserve_channel_send(uuid,uuid,text,text,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.orkto_reserve_channel_send(uuid,uuid,text,text,text,text) to service_role;
revoke all on function public.orkto_mark_channel_send(uuid,uuid,text,text,text,timestamptz) from PUBLIC,anon,authenticated;
grant execute on function public.orkto_mark_channel_send(uuid,uuid,text,text,text,timestamptz) to service_role;
revoke all on function public.orkto_record_channel_delivery_event(uuid,uuid,text,text,text,text,text,timestamptz,text) from PUBLIC,anon,authenticated;
grant execute on function public.orkto_record_channel_delivery_event(uuid,uuid,text,text,text,text,text,timestamptz,text) to service_role;
