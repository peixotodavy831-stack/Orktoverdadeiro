-- Official Meta WhatsApp Cloud API tenancy, credential references and usage controls.
-- Additive only. Provider credentials are encrypted in Supabase Vault at runtime;
-- this migration never stores a plaintext token in a public table.

create table if not exists public.orkto_channel_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
  provider text not null check (provider in ('meta_whatsapp_cloud')),
  status text not null default 'pending' check (status in ('pending','connected','error','revoked')),
  business_id text check (business_id is null or business_id ~ '^[0-9]{5,30}$'),
  waba_id text check (waba_id is null or waba_id ~ '^[0-9]{5,30}$'),
  phone_number_id text check (phone_number_id is null or phone_number_id ~ '^[0-9]{5,30}$'),
  display_phone_number text,
  verified_name text,
  coexistence_state text not null default 'unknown'
    check (coexistence_state in ('unknown','eligible','enabled','ineligible','not_requested')),
  service_mode text not null default 'manual'
    check (service_mode in ('manual','assisted','controlled')),
  token_secret_id uuid,
  granted_scopes text[] not null default '{}'::text[],
  connected_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  webhook_subscribed_at timestamptz,
  last_error_category text,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider),
  unique (id, workspace_id),
  check (status <> 'connected' or (
    waba_id is not null and phone_number_id is not null and token_secret_id is not null and verified_at is not null
  )),
  check (jsonb_typeof(provider_metadata) = 'object')
);

create unique index if not exists orkto_channel_connections_active_phone_uidx
  on public.orkto_channel_connections(provider, phone_number_id)
  where status = 'connected' and phone_number_id is not null;
create index if not exists orkto_channel_connections_workspace_status_idx
  on public.orkto_channel_connections(workspace_id, status, updated_at desc);

create table if not exists public.orkto_whatsapp_controls (
  workspace_id uuid primary key references public.orkto_workspaces(id) on delete cascade,
  connection_id uuid not null,
  monthly_message_limit bigint check (monthly_message_limit is null or monthly_message_limit >= 0),
  monthly_cost_limit_micros bigint check (monthly_cost_limit_micros is null or monthly_cost_limit_micros >= 0),
  pricing_market text check (pricing_market is null or pricing_market ~ '^[A-Z]{2}$'),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  block_on_unpriced boolean not null default true,
  block_on_cost_limit boolean not null default true,
  allow_marketing boolean not null default false,
  human_takeover boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint orkto_whatsapp_controls_connection_workspace_fkey
    foreign key(connection_id, workspace_id)
    references public.orkto_channel_connections(id, workspace_id) on delete cascade
);

create table if not exists public.orkto_whatsapp_rate_cards (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'meta_whatsapp_cloud' check (provider = 'meta_whatsapp_cloud'),
  version text not null check (length(version) between 1 and 80),
  market text not null check (market ~ '^[A-Z]{2}$'),
  category text not null check (category in ('marketing','utility','authentication','service')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  unit_price_micros bigint not null check (unit_price_micros >= 0),
  free_messages bigint not null default 0 check (free_messages >= 0),
  effective_from timestamptz not null,
  effective_until timestamptz,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  source_url text not null check (source_url ~ '^https://'),
  source_checked_at timestamptz not null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, version, market, category, currency),
  check (effective_until is null or effective_until > effective_from),
  check (status <> 'approved' or approved_by is not null)
);
create index if not exists orkto_whatsapp_rate_cards_lookup_idx
  on public.orkto_whatsapp_rate_cards(provider, market, category, currency, effective_from desc)
  where status = 'approved';

create table if not exists public.orkto_whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'meta_whatsapp_cloud' check (provider = 'meta_whatsapp_cloud'),
  provider_event_id text not null check (length(provider_event_id) between 1 and 400),
  payload_fingerprint text not null check (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  workspace_id uuid references public.orkto_workspaces(id) on delete cascade,
  connection_id uuid,
  event_kind text not null check (event_kind in ('message','status')),
  status text not null default 'processing' check (status in ('processing','processed','ignored','failed')),
  processing_claim_token uuid not null default gen_random_uuid(),
  processing_started_at timestamptz not null default now(),
  attempt_count integer not null default 1 check (attempt_count between 1 and 1000),
  failure_category text,
  occurred_at timestamptz not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_event_id),
  constraint orkto_whatsapp_webhook_connection_workspace_fkey
    foreign key(connection_id, workspace_id)
    references public.orkto_channel_connections(id, workspace_id) on delete cascade
);
create index if not exists orkto_whatsapp_webhook_workspace_status_idx
  on public.orkto_whatsapp_webhook_events(workspace_id, status, created_at desc);

-- The original legacy key used the owner id. A company channel is tenant-scoped,
-- so the same owner may safely use the same contact in two different workspaces.
alter table public.orkto_conversations
  drop constraint if exists orkto_conversations_user_id_source_channel_contact_phone_key;
create unique index if not exists orkto_conversations_workspace_channel_phone_uidx
  on public.orkto_conversations(workspace_id,source_channel,contact_phone);

alter table public.orkto_channel_send_requests
  add column if not exists rate_card_id uuid references public.orkto_whatsapp_rate_cards(id) on delete restrict,
  add column if not exists pricing_market text check (pricing_market is null or pricing_market ~ '^[A-Z]{2}$'),
  add column if not exists pricing_currency text check (pricing_currency is null or pricing_currency ~ '^[A-Z]{3}$'),
  add column if not exists estimated_cost_micros bigint check (estimated_cost_micros is null or estimated_cost_micros >= 0);

create table if not exists public.orkto_whatsapp_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.orkto_workspaces(id) on delete cascade,
  connection_id uuid not null,
  provider_message_id text not null check (length(provider_message_id) between 1 and 400),
  direction text not null check (direction in ('incoming','outgoing')),
  category text not null check (category in ('marketing','utility','authentication','service','unclassified')),
  market text check (market is null or market ~ '^[A-Z]{2}$'),
  quantity bigint not null default 1 check (quantity > 0),
  cost_state text not null default 'unpriced' check (cost_state in ('unpriced','estimated','confirmed')),
  estimated_cost_micros bigint check (estimated_cost_micros is null or estimated_cost_micros >= 0),
  actual_cost_micros bigint check (actual_cost_micros is null or actual_cost_micros >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  rate_card_id uuid references public.orkto_whatsapp_rate_cards(id) on delete restrict,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(connection_id, provider_message_id, direction),
  constraint orkto_whatsapp_usage_connection_workspace_fkey
    foreign key(connection_id, workspace_id)
    references public.orkto_channel_connections(id, workspace_id) on delete cascade,
  check ((cost_state = 'unpriced' and estimated_cost_micros is null and actual_cost_micros is null)
    or (cost_state = 'estimated' and estimated_cost_micros is not null and actual_cost_micros is null)
    or (cost_state = 'confirmed' and actual_cost_micros is not null))
);
create index if not exists orkto_whatsapp_usage_workspace_period_idx
  on public.orkto_whatsapp_usage_events(workspace_id, occurred_at desc);

do $$ declare tbl text; begin
  foreach tbl in array array[
    'orkto_channel_connections','orkto_whatsapp_controls','orkto_whatsapp_rate_cards',
    'orkto_whatsapp_webhook_events','orkto_whatsapp_usage_events'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all privileges on table public.%I from PUBLIC, anon, authenticated', tbl);
    execute format('grant all privileges on table public.%I to service_role', tbl);
  end loop;
end $$;

create or replace function public.orkto_store_meta_connection(
  p_workspace_id uuid,
  p_actor_user_id uuid,
  p_business_id text,
  p_waba_id text,
  p_phone_number_id text,
  p_display_phone_number text,
  p_verified_name text,
  p_coexistence_state text,
  p_granted_scopes text[],
  p_access_token text,
  p_provider_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_connection public.orkto_channel_connections%rowtype;
  v_secret_id uuid;
  v_role text;
begin
  if p_workspace_id is null or p_actor_user_id is null
    or p_waba_id is null or p_waba_id !~ '^[0-9]{5,30}$'
    or p_phone_number_id is null or p_phone_number_id !~ '^[0-9]{5,30}$'
    or p_business_id is not null and p_business_id !~ '^[0-9]{5,30}$'
    or p_coexistence_state not in ('unknown','eligible','enabled','ineligible','not_requested')
    or nullif(trim(p_access_token),'') is null or length(p_access_token) > 8192
    or jsonb_typeof(coalesce(p_provider_metadata,'{}'::jsonb)) <> 'object' then
    raise exception 'invalid Meta connection request' using errcode = '22023';
  end if;
  select m.role into v_role from public.orkto_workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = p_actor_user_id and m.status = 'active';
  if v_role is null or v_role not in ('owner','admin') then
    raise exception 'workspace admin required' using errcode = '42501';
  end if;
  if not exists(select 1 from pg_catalog.pg_namespace where nspname = 'vault') then
    raise exception 'Supabase Vault is not available' using errcode = '55000';
  end if;

  select c.* into v_connection from public.orkto_channel_connections c
    where c.workspace_id = p_workspace_id and c.provider = 'meta_whatsapp_cloud' for update;
  if v_connection.token_secret_id is null then
    execute 'select vault.create_secret($1,$2,$3)'
      into v_secret_id
      using p_access_token,
        'orkto-meta-token-' || p_workspace_id::text,
        'ORKTO Meta WhatsApp access token for one staging or production workspace';
  else
    v_secret_id := v_connection.token_secret_id;
    execute 'select vault.update_secret($1,$2,$3,$4)'
      using v_secret_id, p_access_token,
        'orkto-meta-token-' || p_workspace_id::text,
        'ORKTO Meta WhatsApp access token for one staging or production workspace';
  end if;

  insert into public.orkto_channel_connections(
    workspace_id,provider,status,business_id,waba_id,phone_number_id,display_phone_number,
    verified_name,coexistence_state,token_secret_id,granted_scopes,connected_by,verified_at,
    last_error_category,provider_metadata,updated_at
  ) values (
    p_workspace_id,'meta_whatsapp_cloud','connected',nullif(trim(p_business_id),''),trim(p_waba_id),
    trim(p_phone_number_id),nullif(trim(p_display_phone_number),''),nullif(trim(p_verified_name),''),
    p_coexistence_state,v_secret_id,coalesce(p_granted_scopes,'{}'::text[]),p_actor_user_id,now(),null,
    coalesce(p_provider_metadata,'{}'::jsonb),now()
  ) on conflict(workspace_id,provider) do update set
    status='connected',business_id=excluded.business_id,waba_id=excluded.waba_id,
    phone_number_id=excluded.phone_number_id,display_phone_number=excluded.display_phone_number,
    verified_name=excluded.verified_name,coexistence_state=excluded.coexistence_state,
    token_secret_id=excluded.token_secret_id,granted_scopes=excluded.granted_scopes,
    connected_by=excluded.connected_by,verified_at=excluded.verified_at,last_error_category=null,
    provider_metadata=excluded.provider_metadata,updated_at=now()
  returning * into v_connection;

  insert into public.orkto_whatsapp_controls(workspace_id,connection_id,updated_by)
  values(p_workspace_id,v_connection.id,p_actor_user_id)
  on conflict(workspace_id) do update set connection_id=excluded.connection_id,
    updated_by=excluded.updated_by,updated_at=now();
  insert into public.orkto_audit_log(user_id,workspace_id,event_type,actor_type,actor_id,event_data)
  values(p_actor_user_id,p_workspace_id,'channel.meta.connected','human',p_actor_user_id::text,
    jsonb_build_object('connection_id',v_connection.id,'phone_number_id_suffix',right(p_phone_number_id,4),
      'coexistence_state',p_coexistence_state));
  return v_connection.id;
end $$;

create or replace function public.orkto_read_meta_token(p_connection_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_secret_id uuid; v_token text;
begin
  select c.token_secret_id into v_secret_id from public.orkto_channel_connections c
    where c.id=p_connection_id and c.provider='meta_whatsapp_cloud' and c.status='connected';
  if v_secret_id is null then return null; end if;
  if not exists(select 1 from pg_catalog.pg_namespace where nspname='vault') then return null; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where id=$1'
    into v_token using v_secret_id;
  return v_token;
end $$;

create or replace function public.orkto_set_whatsapp_mode(
  p_workspace_id uuid,p_actor_user_id uuid,p_mode text,p_human_takeover boolean default false
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_role text; v_connection_id uuid;
begin
  if p_mode not in ('manual','assisted','controlled') then
    raise exception 'invalid WhatsApp service mode' using errcode='22023';
  end if;
  select m.role into v_role from public.orkto_workspace_members m
    where m.workspace_id=p_workspace_id and m.user_id=p_actor_user_id and m.status='active';
  if v_role is null or v_role not in ('owner','admin') then
    raise exception 'workspace admin required' using errcode='42501';
  end if;
  select c.id into v_connection_id from public.orkto_channel_connections c
    where c.workspace_id=p_workspace_id and c.provider='meta_whatsapp_cloud' and c.status='connected' for update;
  if v_connection_id is null then return false; end if;
  update public.orkto_channel_connections set service_mode=p_mode,updated_at=now() where id=v_connection_id;
  update public.orkto_whatsapp_controls set human_takeover=coalesce(p_human_takeover,false),
    updated_by=p_actor_user_id,updated_at=now() where workspace_id=p_workspace_id;
  insert into public.orkto_audit_log(user_id,workspace_id,event_type,actor_type,actor_id,event_data)
  values(p_actor_user_id,p_workspace_id,'channel.meta.mode_changed','human',p_actor_user_id::text,
    jsonb_build_object('connection_id',v_connection_id,'service_mode',p_mode,'human_takeover',coalesce(p_human_takeover,false)));
  return true;
end $$;

create or replace function public.orkto_claim_meta_webhook_event(
  p_phone_number_id text,p_waba_id text,p_provider_event_id text,p_payload_fingerprint text,
  p_event_kind text,p_occurred_at timestamptz
) returns table(decision text,workspace_id uuid,connection_id uuid,service_mode text,human_takeover boolean,claim_token uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_connection public.orkto_channel_connections%rowtype;
  v_existing public.orkto_whatsapp_webhook_events%rowtype;
  v_inserted_id uuid;
  v_takeover boolean;
begin
  if p_phone_number_id is null or p_phone_number_id !~ '^[0-9]{5,30}$'
    or p_waba_id is null or p_waba_id !~ '^[0-9]{5,30}$'
    or nullif(trim(p_provider_event_id),'') is null or length(p_provider_event_id)>400
    or p_payload_fingerprint !~ '^[a-f0-9]{64}$' or p_event_kind not in ('message','status')
    or p_occurred_at is null then raise exception 'invalid Meta webhook event' using errcode='22023'; end if;
  select c.* into v_connection from public.orkto_channel_connections c
    where c.provider='meta_whatsapp_cloud' and c.phone_number_id=p_phone_number_id
      and c.waba_id=p_waba_id and c.status='connected';
  if v_connection.id is null then
    return query select 'CONNECTION_NOT_FOUND'::text,null::uuid,null::uuid,null::text,false,null::uuid; return;
  end if;
  select coalesce(w.human_takeover,false) into v_takeover from public.orkto_whatsapp_controls w
    where w.workspace_id=v_connection.workspace_id;
  v_takeover:=coalesce(v_takeover,false);
  insert into public.orkto_whatsapp_webhook_events(provider,provider_event_id,payload_fingerprint,
    workspace_id,connection_id,event_kind,occurred_at)
  values('meta_whatsapp_cloud',trim(p_provider_event_id),p_payload_fingerprint,
    v_connection.workspace_id,v_connection.id,p_event_kind,p_occurred_at)
  on conflict(provider,provider_event_id) do nothing returning id into v_inserted_id;
  select e.* into v_existing from public.orkto_whatsapp_webhook_events e
    where e.provider='meta_whatsapp_cloud' and e.provider_event_id=trim(p_provider_event_id) for update;
  if v_existing.payload_fingerprint<>p_payload_fingerprint or v_existing.connection_id<>v_connection.id then
    return query select 'EVENT_CONFLICT'::text,v_connection.workspace_id,v_connection.id,
      v_connection.service_mode,v_takeover,null::uuid; return;
  end if;
  if v_inserted_id is not null then
    return query select 'CLAIMED'::text,v_connection.workspace_id,v_connection.id,
      v_connection.service_mode,v_takeover,v_existing.processing_claim_token; return;
  end if;
  if v_existing.status in ('processed','ignored') then
    return query select 'DUPLICATE'::text,v_connection.workspace_id,v_connection.id,
      v_connection.service_mode,v_takeover,null::uuid; return;
  end if;
  if v_existing.status='processing' and v_existing.processing_started_at > now()-interval '2 minutes' then
    return query select 'IN_PROGRESS'::text,v_connection.workspace_id,v_connection.id,
      v_connection.service_mode,v_takeover,null::uuid; return;
  end if;
  update public.orkto_whatsapp_webhook_events set status='processing',failure_category=null,
    processing_claim_token=gen_random_uuid(),processing_started_at=now(),
    attempt_count=attempt_count+1,updated_at=now() where id=v_existing.id returning * into v_existing;
  return query select 'CLAIMED'::text,v_connection.workspace_id,v_connection.id,
    v_connection.service_mode,v_takeover,v_existing.processing_claim_token;
end $$;

create or replace function public.orkto_ingest_meta_text_message(
  p_connection_id uuid,p_provider_event_id text,p_claim_token uuid,p_external_message_id text,p_sender_phone text,
  p_text text,p_occurred_at timestamptz
) returns table(decision text,conversation_id uuid,message_id uuid,service_mode text)
language plpgsql security definer set search_path = '' as $$
declare
  v_connection public.orkto_channel_connections%rowtype;
  v_event public.orkto_whatsapp_webhook_events%rowtype;
  v_conversation public.orkto_conversations%rowtype;
  v_owner uuid; v_customer_id uuid; v_message_id uuid; v_existing uuid;
begin
  if p_connection_id is null or p_claim_token is null or nullif(trim(p_provider_event_id),'') is null
    or nullif(trim(p_external_message_id),'') is null or length(p_external_message_id)>400
    or p_sender_phone is null or p_sender_phone !~ '^[0-9]{5,30}$'
    or nullif(p_text,'') is null or length(p_text)>65536
    or p_occurred_at is null then raise exception 'invalid Meta text message' using errcode='22023'; end if;
  select c.* into v_connection from public.orkto_channel_connections c
    where c.id=p_connection_id and c.provider='meta_whatsapp_cloud' and c.status='connected' for update;
  if v_connection.id is null then return query select 'CONNECTION_NOT_FOUND'::text,null::uuid,null::uuid,null::text; return; end if;
  select e.* into v_event from public.orkto_whatsapp_webhook_events e
    where e.provider='meta_whatsapp_cloud' and e.provider_event_id=trim(p_provider_event_id)
      and e.connection_id=v_connection.id and e.processing_claim_token=p_claim_token for update;
  if v_event.id is null or v_event.status<>'processing' then
    return query select case when v_event.status='processed' then 'DUPLICATE' else 'EVENT_NOT_CLAIMED' end,
      null::uuid,null::uuid,v_connection.service_mode; return;
  end if;
  select m.id into v_existing from public.orkto_messages m
    where m.workspace_id=v_connection.workspace_id and m.external_event_id=p_external_message_id;
  if v_existing is not null then
    update public.orkto_whatsapp_webhook_events set status='processed',processed_at=now(),updated_at=now() where id=v_event.id;
    return query select 'DUPLICATE'::text,null::uuid,v_existing,v_connection.service_mode; return;
  end if;
  select w.owner_user_id into v_owner from public.orkto_workspaces w where w.id=v_connection.workspace_id;
  select c.id into v_customer_id from public.clients c where c.workspace_id=v_connection.workspace_id
    and c.phone=p_sender_phone and c.archived_at is null order by c.created_at limit 1;
  select c.* into v_conversation from public.orkto_conversations c
    where c.workspace_id=v_connection.workspace_id and c.source_channel='whatsapp'
      and c.contact_phone=p_sender_phone order by c.created_at limit 1 for update;
  if v_conversation.id is null then
    insert into public.orkto_conversations(user_id,workspace_id,contact_name,contact_phone,status,
      source_channel,mood_state,customer_id,external_thread_id,last_message_at)
    values(v_owner,v_connection.workspace_id,case when v_customer_id is null then 'WhatsApp '||right(p_sender_phone,4)
      else (select c.name from public.clients c where c.id=v_customer_id) end,p_sender_phone,'active','whatsapp','neutral',
      v_customer_id,v_connection.id::text,p_occurred_at) returning * into v_conversation;
  end if;
  v_message_id:=gen_random_uuid();
  insert into public.orkto_messages(id,workspace_id,conversation_id,sender_role,content,message_type,
    direction,external_event_id,sent_at,metadata)
  values(v_message_id,v_connection.workspace_id,v_conversation.id,'contact',p_text,'text','incoming',
    p_external_message_id,p_occurred_at,jsonb_build_object('provider','meta_whatsapp_cloud','connection_id',v_connection.id));
  update public.orkto_conversations set status='active',customer_id=coalesce(customer_id,v_customer_id),
    last_message_at=greatest(coalesce(last_message_at,p_occurred_at),p_occurred_at),updated_at=now()
    where id=v_conversation.id and workspace_id=v_connection.workspace_id;
  insert into public.orkto_whatsapp_usage_events(workspace_id,connection_id,provider_message_id,
    direction,category,cost_state,occurred_at)
  values(v_connection.workspace_id,v_connection.id,p_external_message_id,'incoming','service','unpriced',p_occurred_at)
  on conflict(connection_id,provider_message_id,direction) do nothing;
  update public.orkto_whatsapp_webhook_events set status='processed',processed_at=now(),updated_at=now() where id=v_event.id;
  insert into public.orkto_audit_log(user_id,workspace_id,conversation_id,event_type,actor_type,actor_id,event_data)
  values(v_owner,v_connection.workspace_id,v_conversation.id,'channel.meta.message_received','system','meta_webhook',
    jsonb_build_object('message_id',v_message_id,'connection_id',v_connection.id,'service_mode',v_connection.service_mode));
  return query select 'APPLIED'::text,v_conversation.id,v_message_id,v_connection.service_mode;
end $$;

create or replace function public.orkto_finish_meta_webhook_event(
  p_provider_event_id text,p_claim_token uuid,p_status text,p_failure_category text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_claim_token is null or p_status not in ('processed','ignored','failed') then raise exception 'invalid webhook state' using errcode='22023'; end if;
  update public.orkto_whatsapp_webhook_events set status=p_status,
    failure_category=case when p_status='failed' then nullif(left(p_failure_category,80),'') else null end,
    processed_at=case when p_status in ('processed','ignored') then now() else processed_at end,updated_at=now()
  where provider='meta_whatsapp_cloud' and provider_event_id=trim(p_provider_event_id)
    and processing_claim_token=p_claim_token and status='processing';
  return found;
end $$;

create or replace function public.orkto_reserve_meta_send(
  p_workspace_id uuid,p_conversation_id uuid,p_idempotency_key text,p_request_fingerprint text,p_rate_card_id uuid
) returns table(decision text,send_request_id uuid,send_status text,provider_message_id text,estimated_cost_micros bigint)
language plpgsql security definer set search_path = '' as $$
declare
  v_controls public.orkto_whatsapp_controls%rowtype;
  v_card public.orkto_whatsapp_rate_cards%rowtype;
  v_existing public.orkto_channel_send_requests%rowtype;
  v_used bigint; v_cost bigint; v_pending_count bigint; v_pending_cost bigint; v_estimate bigint;
begin
  if p_workspace_id is null or p_conversation_id is null or p_rate_card_id is null
    or p_idempotency_key is null or length(trim(p_idempotency_key))<8 or length(p_idempotency_key)>200
    or p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid Meta send reservation' using errcode='22023';
  end if;
  select w.* into v_controls from public.orkto_whatsapp_controls w
    where w.workspace_id=p_workspace_id for update;
  select s.* into v_existing from public.orkto_channel_send_requests s
    where s.workspace_id=p_workspace_id and s.channel='whatsapp' and s.idempotency_key=trim(p_idempotency_key);
  if v_existing.id is not null then
    if v_existing.conversation_id<>p_conversation_id or v_existing.provider<>'meta_whatsapp_cloud'
      or v_existing.request_fingerprint<>p_request_fingerprint then
      return query select 'IDEMPOTENCY_CONFLICT'::text,v_existing.id,v_existing.status,
        v_existing.provider_message_id,v_existing.estimated_cost_micros; return;
    end if;
    if v_existing.status in ('PREPARED','QUEUED') then
      return query select 'IN_PROGRESS'::text,v_existing.id,v_existing.status,
        v_existing.provider_message_id,v_existing.estimated_cost_micros; return;
    end if;
    if v_existing.status='UNKNOWN' then
      return query select 'RECONCILIATION_REQUIRED'::text,v_existing.id,v_existing.status,
        v_existing.provider_message_id,v_existing.estimated_cost_micros; return;
    end if;
    return query select 'REPLAY'::text,v_existing.id,v_existing.status,
      v_existing.provider_message_id,v_existing.estimated_cost_micros; return;
  end if;
  if v_controls.workspace_id is null or v_controls.pricing_market is null then
    return query select 'CONFIGURATION_REQUIRED'::text,null::uuid,null::text,null::text,null::bigint; return;
  end if;
  select r.* into v_card from public.orkto_whatsapp_rate_cards r where r.id=p_rate_card_id
    and r.provider='meta_whatsapp_cloud' and r.status='approved'
    and r.market=v_controls.pricing_market and r.currency=v_controls.currency
    and r.category='service' and r.effective_from<=now()
    and (r.effective_until is null or r.effective_until>now());
  if v_card.id is null then
    return query select 'CONFIGURATION_REQUIRED'::text,null::uuid,null::text,null::text,null::bigint; return;
  end if;
  select coalesce(sum(u.quantity),0),coalesce(sum(coalesce(u.actual_cost_micros,u.estimated_cost_micros,0)),0)
    into v_used,v_cost from public.orkto_whatsapp_usage_events u
    where u.workspace_id=p_workspace_id and u.direction='outgoing'
      and u.occurred_at>=date_trunc('month',now() at time zone 'utc') at time zone 'utc';
  select count(*),coalesce(sum(s.estimated_cost_micros),0) into v_pending_count,v_pending_cost
    from public.orkto_channel_send_requests s where s.workspace_id=p_workspace_id
      and s.channel='whatsapp' and s.provider='meta_whatsapp_cloud'
      and s.status in ('PREPARED','QUEUED','UNKNOWN')
      and s.created_at>=date_trunc('month',now() at time zone 'utc') at time zone 'utc';
  v_estimate:=case when v_used+v_pending_count<v_card.free_messages then 0 else v_card.unit_price_micros end;
  if v_controls.monthly_message_limit is not null
    and v_used+v_pending_count+1>v_controls.monthly_message_limit then
    return query select 'RATE_LIMITED'::text,null::uuid,null::text,null::text,null::bigint; return;
  end if;
  if v_controls.block_on_cost_limit and v_controls.monthly_cost_limit_micros is not null
    and v_cost+v_pending_cost+v_estimate>v_controls.monthly_cost_limit_micros then
    return query select 'RATE_LIMITED'::text,null::uuid,null::text,null::text,null::bigint; return;
  end if;
  insert into public.orkto_channel_send_requests(workspace_id,conversation_id,channel,provider,
    idempotency_key,request_fingerprint,status,rate_card_id,pricing_market,pricing_currency,estimated_cost_micros)
  values(p_workspace_id,p_conversation_id,'whatsapp','meta_whatsapp_cloud',trim(p_idempotency_key),
    p_request_fingerprint,'PREPARED',v_card.id,v_card.market,v_card.currency,v_estimate)
  returning * into v_existing;
  return query select 'RESERVED'::text,v_existing.id,v_existing.status,
    v_existing.provider_message_id,v_existing.estimated_cost_micros;
end $$;

create or replace function public.orkto_accept_meta_send(
  p_workspace_id uuid,p_send_request_id uuid,p_actor_user_id uuid,p_provider_message_id text,
  p_content text,p_occurred_at timestamptz
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_send public.orkto_channel_send_requests%rowtype;
  v_connection public.orkto_channel_connections%rowtype;
  v_mark text;
  v_message_id uuid;
begin
  if p_workspace_id is null or p_send_request_id is null or p_actor_user_id is null
    or nullif(trim(p_provider_message_id),'') is null or length(p_provider_message_id)>400
    or nullif(trim(p_content),'') is null or length(p_content)>4000 or p_occurred_at is null then
    raise exception 'invalid Meta acceptance' using errcode='22023';
  end if;
  select s.* into v_send from public.orkto_channel_send_requests s
    where s.id=p_send_request_id and s.workspace_id=p_workspace_id and s.provider='meta_whatsapp_cloud'
      and s.channel='whatsapp' for update;
  if v_send.id is null then return 'NOT_FOUND'; end if;
  if v_send.status in ('REQUEST_ACCEPTED','PROVIDER_ACKNOWLEDGED','DELIVERED') then
    return case when v_send.provider_message_id=trim(p_provider_message_id) then 'REPLAY' else 'PROVIDER_REFERENCE_CONFLICT' end;
  end if;
  if v_send.status not in ('PREPARED','QUEUED') then return 'INVALID_STATE'; end if;
  select c.* into v_connection from public.orkto_channel_connections c
    where c.workspace_id=p_workspace_id and c.provider='meta_whatsapp_cloud' and c.status='connected';
  if v_connection.id is null then return 'CONNECTION_NOT_FOUND'; end if;
  if v_send.rate_card_id is null or v_send.pricing_market is null or v_send.pricing_currency is null
    or v_send.estimated_cost_micros is null or not exists(
      select 1 from public.orkto_whatsapp_rate_cards r where r.id=v_send.rate_card_id
        and r.provider='meta_whatsapp_cloud' and r.status='approved' and r.market=v_send.pricing_market
        and r.category='service' and r.currency=v_send.pricing_currency and r.effective_from<=p_occurred_at
        and (r.effective_until is null or r.effective_until>p_occurred_at)
    ) then return 'RATE_CONFIGURATION_REQUIRED'; end if;
  v_mark:=public.orkto_mark_channel_send(p_workspace_id,p_send_request_id,'REQUEST_ACCEPTED',
    trim(p_provider_message_id),null,p_occurred_at);
  if v_mark<>'APPLIED' then return v_mark; end if;
  select m.id into v_message_id from public.orkto_messages m
    where m.workspace_id=p_workspace_id and m.external_event_id=trim(p_provider_message_id);
  if v_message_id is null then
    insert into public.orkto_messages(workspace_id,conversation_id,sender_role,content,message_type,
      direction,external_event_id,sent_at,metadata)
    values(p_workspace_id,v_send.conversation_id,'operator',trim(p_content),'text','outgoing',
      trim(p_provider_message_id),p_occurred_at,
      jsonb_build_object('provider','meta_whatsapp_cloud','send_request_id',p_send_request_id,
        'connection_id',v_connection.id)) returning id into v_message_id;
  end if;
  insert into public.orkto_whatsapp_usage_events(workspace_id,connection_id,provider_message_id,
    direction,category,market,cost_state,estimated_cost_micros,currency,rate_card_id,occurred_at)
  values(p_workspace_id,v_connection.id,trim(p_provider_message_id),'outgoing','service',v_send.pricing_market,
    'estimated',v_send.estimated_cost_micros,v_send.pricing_currency,v_send.rate_card_id,p_occurred_at)
  on conflict(connection_id,provider_message_id,direction) do nothing;
  update public.orkto_conversations set last_message_at=greatest(coalesce(last_message_at,p_occurred_at),p_occurred_at),
    updated_at=now() where id=v_send.conversation_id and workspace_id=p_workspace_id;
  insert into public.orkto_audit_log(user_id,workspace_id,conversation_id,event_type,actor_type,actor_id,event_data)
  values(p_actor_user_id,p_workspace_id,v_send.conversation_id,'channel.send.accepted','human',p_actor_user_id::text,
    jsonb_build_object('provider','meta_whatsapp_cloud','send_request_id',p_send_request_id,
      'message_id',v_message_id,'rate_card_id',v_send.rate_card_id,'estimated_cost_micros',v_send.estimated_cost_micros,
      'currency',v_send.pricing_currency));
  return 'APPLIED';
end $$;

do $$ declare fn text; begin
  foreach fn in array array[
    'orkto_store_meta_connection(uuid,uuid,text,text,text,text,text,text,text[],text,jsonb)',
    'orkto_read_meta_token(uuid)',
    'orkto_set_whatsapp_mode(uuid,uuid,text,boolean)',
    'orkto_claim_meta_webhook_event(text,text,text,text,text,timestamptz)',
    'orkto_ingest_meta_text_message(uuid,text,uuid,text,text,text,timestamptz)',
    'orkto_finish_meta_webhook_event(text,uuid,text,text)',
    'orkto_reserve_meta_send(uuid,uuid,text,text,uuid)',
    'orkto_accept_meta_send(uuid,uuid,uuid,text,text,timestamptz)'
  ] loop
    execute format('revoke all on function public.%s from PUBLIC, anon, authenticated',fn);
    execute format('grant execute on function public.%s to service_role',fn);
  end loop;
end $$;
