-- Provider state is distinct from entitlement. No termination policy is approved here.
alter table public.orkto_billing_bindings add column provider_status text
 check(provider_status in ('ACTIVE','INACTIVE','DELETED'));
create table public.orkto_subscription_lifecycle_events(
 id uuid primary key default gen_random_uuid(),binding_id uuid not null references public.orkto_billing_bindings(id),
 event_key text not null check(length(event_key) between 8 and 260),
 provider_status text not null check(provider_status in ('ACTIVE','INACTIVE','DELETED')),
 observed_at timestamptz not null default clock_timestamp(),unique(binding_id,event_key)
);
create table public.orkto_subscription_commands(
 id uuid primary key default gen_random_uuid(),binding_id uuid not null references public.orkto_billing_bindings(id),
 actor_id uuid not null references auth.users(id),request_key text not null check(length(request_key) between 8 and 128),
 operation text not null check(operation in ('update','cancel')),changes jsonb not null,
 state text not null default 'reserved' check(state in ('reserved','succeeded','unknown')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(binding_id,request_key)
);
create index orkto_subscription_commands_actor_idx on public.orkto_subscription_commands(actor_id);
-- An ambiguous provider result blocks subsequent commands until an operator reconciles it.
create unique index orkto_subscription_command_unresolved_idx on public.orkto_subscription_commands(binding_id)
 where state in ('reserved','unknown');
alter table public.orkto_subscription_lifecycle_events enable row level security;
alter table public.orkto_subscription_commands enable row level security;
revoke all on public.orkto_subscription_lifecycle_events,public.orkto_subscription_commands from public,anon,authenticated;
grant select,insert,update on public.orkto_subscription_lifecycle_events,public.orkto_subscription_commands to service_role;

create function public.orkto_observe_subscription(p_provider_id text,p_event_key text,p_customer text,p_reference text,p_amount bigint,p_status text)
returns text language plpgsql set search_path='' as $$
declare b public.orkto_billing_bindings; old_status text;
begin
 select * into b from public.orkto_billing_bindings where provider='asaas' and environment='sandbox'
 and provider_subscription_id=p_provider_id and creation_state='created' for update;
 if not found or p_customer is distinct from b.customer_ref or p_reference is distinct from 'orkto-sub:'||b.id::text
 or not exists(select 1 from public.orkto_plan_price_versions where id=b.price_version_id and price_cents=p_amount and currency='BRL')
 or p_status is null or p_status not in ('ACTIVE','INACTIVE','DELETED') or p_event_key is null
 or length(p_event_key) not between 8 and 260 then raise exception 'BILLING_PROVIDER_MISMATCH'; end if;
 select provider_status into old_status from public.orkto_subscription_lifecycle_events where binding_id=b.id and event_key=p_event_key;
 if found then
  if old_status<>p_status then raise exception 'BILLING_EVENT_CONFLICT'; end if;
  return 'REPLAY';
 end if;
 -- A deleted subscription cannot spontaneously return to ACTIVE under the same binding.
 if b.provider_status='DELETED' and p_status<>'DELETED' then raise exception 'BILLING_STATE_CONFLICT'; end if;
 insert into public.orkto_subscription_lifecycle_events(binding_id,event_key,provider_status) values(b.id,p_event_key,p_status);
 update public.orkto_billing_bindings set provider_status=p_status where id=b.id;
 insert into public.orkto_wia_events(workspace_id,event_type,source,entity_type,entity_ref,payload)
 values(b.workspace_id,'billing.subscription.observed','system','billing_binding',b.id::text,
 jsonb_build_object('provider_status',p_status,'event_key',p_event_key,'access_policy','approval_required','environment','sandbox'));
 -- Deliberately no entitlement mutation. Commercial termination timing remains unapproved.
 return case when p_status='ACTIVE' then 'RECORDED' else 'RECORDED_POLICY_REQUIRED' end;
end $$;

create function public.orkto_reserve_subscription_command(p_workspace uuid,p_actor uuid,p_binding uuid,p_key text,p_operation text,p_changes jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare b public.orkto_billing_bindings; c public.orkto_subscription_commands; price bigint;
begin
 if not exists(select 1 from public.orkto_workspace_members where workspace_id=p_workspace and user_id=p_actor
 and status='active' and role in ('owner','admin')) then raise exception 'BILLING_PERMISSION_DENIED' using errcode='42501'; end if;
 if p_key is null or length(p_key) not between 8 and 128 or p_operation is null or p_operation not in ('cancel','update')
 or p_changes is null or jsonb_typeof(p_changes)<>'object' then raise exception 'BILLING_INVALID'; end if;
 if p_operation='cancel' then
  if p_changes<>'{}'::jsonb then raise exception 'BILLING_INVALID'; end if;
 else
  if coalesce(p_changes->>'status','') not in ('ACTIVE','INACTIVE') or p_changes-array['status','nextDueDate']<>'{}'::jsonb
   or (p_changes->>'status'='ACTIVE' and not p_changes?'nextDueDate')
   or (p_changes?'nextDueDate' and (jsonb_typeof(p_changes->'nextDueDate')<>'string'
    or p_changes->>'nextDueDate' !~ '^\d{4}-\d{2}-\d{2}$'
    or (p_changes->>'nextDueDate')::date<current_date)) then raise exception 'BILLING_INVALID'; end if;
 end if;
 select * into b from public.orkto_billing_bindings where id=p_binding and workspace_id=p_workspace
 and provider='asaas' and environment='sandbox' for update;
 if not found or b.creation_state<>'created' or b.provider_subscription_id is null then raise exception 'BILLING_BINDING_MISMATCH'; end if;
 select * into c from public.orkto_subscription_commands where binding_id=b.id and request_key=p_key;
 if found then
  if c.operation<>p_operation or c.changes<>p_changes then raise exception 'BILLING_EVENT_CONFLICT'; end if;
  return jsonb_build_object('execute',false,'state',c.state);
 end if;
 if b.provider_status='DELETED' then raise exception 'BILLING_STATE_CONFLICT'; end if;
 insert into public.orkto_subscription_commands(binding_id,actor_id,request_key,operation,changes)
 values(b.id,p_actor,p_key,p_operation,p_changes) returning * into c;
 select price_cents into price from public.orkto_plan_price_versions where id=b.price_version_id;
 return jsonb_build_object('execute',true,'id',c.id,'providerId',b.provider_subscription_id,'customerRef',b.customer_ref,'priceCents',price);
end $$;
create function public.orkto_finish_subscription_command(p_id uuid,p_state text)
returns boolean language plpgsql set search_path='' as $$
declare c public.orkto_subscription_commands; b public.orkto_billing_bindings;
begin
 if p_state is null or p_state not in ('succeeded','unknown') then raise exception 'BILLING_INVALID'; end if;
 update public.orkto_subscription_commands set state=p_state,updated_at=now() where id=p_id and state='reserved' returning * into c;
 if not found then return false; end if;
 select * into b from public.orkto_billing_bindings where id=c.binding_id;
 insert into public.orkto_wia_events(workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,payload)
 values(b.workspace_id,c.actor_id,'billing.subscription.command_finished','system','subscription_command',c.id::text,
 jsonb_build_object('operation',c.operation,'state',p_state,'environment','sandbox'));
 return true;
end $$;
revoke all on function public.orkto_observe_subscription(text,text,text,text,bigint,text),
 public.orkto_reserve_subscription_command(uuid,uuid,uuid,text,text,jsonb),public.orkto_finish_subscription_command(uuid,text) from public,anon,authenticated;
grant execute on function public.orkto_observe_subscription(text,text,text,text,bigint,text),
 public.orkto_reserve_subscription_command(uuid,uuid,uuid,text,text,jsonb),public.orkto_finish_subscription_command(uuid,text) to service_role;

create or replace function public.orkto_reconcile_subscription(p_binding_id uuid,p_event_key text,p_provider_subscription_id text,
 p_amount_cents bigint,p_currency text,p_financial_status text,p_period_start timestamptz,p_period_end timestamptz,p_observed_at timestamptz)
returns text language plpgsql set search_path='' as $$
declare binding public.orkto_billing_bindings; price public.orkto_plan_price_versions; previous public.orkto_subscription_events; current_end timestamptz;
begin
 select * into binding from public.orkto_billing_bindings where id=p_binding_id for update;
 if not found or binding.creation_state<>'created' or p_provider_subscription_id is null
 or binding.provider_subscription_id is distinct from p_provider_subscription_id then raise exception 'BILLING_BINDING_MISMATCH'; end if;
 select * into price from public.orkto_plan_price_versions where id=binding.price_version_id;
 if price.plan_key='enterprise' or price.version<>2 or price.price_cents is distinct from p_amount_cents or p_currency<>'BRL'
 or price.currency<>p_currency or p_financial_status not in ('pending','confirmed','overdue','refunded','cancelled')
 or p_period_end<=p_period_start or p_observed_at>now()+interval '1 minute' or length(p_event_key) not between 8 and 200
 or p_amount_cents is null or p_currency is null or p_financial_status is null or p_observed_at is null
 or p_period_start is null or p_period_end is null then raise exception 'BILLING_RECONCILIATION_INVALID'; end if;
 select * into previous from public.orkto_subscription_events where binding_id=p_binding_id and event_key=p_event_key;
 if found then
  if previous.amount_cents<>p_amount_cents or previous.financial_status<>p_financial_status or previous.period_start<>p_period_start
   or previous.period_end<>p_period_end or previous.currency<>p_currency then raise exception 'BILLING_EVENT_CONFLICT'; end if;
  return 'REPLAY';
 end if;
 insert into public.orkto_subscription_events(binding_id,event_key,observed_at,financial_status,period_start,period_end,amount_cents,currency)
 values(p_binding_id,p_event_key,p_observed_at,p_financial_status,p_period_start,p_period_end,p_amount_cents,p_currency);
 select current_period_end into current_end from public.orkto_workspace_subscriptions where id=binding.subscription_id;
 if current_end is not null and p_period_end<current_end then return 'STALE'; end if;
 if binding.last_reconciled_at is not null and p_observed_at<=binding.last_reconciled_at then return 'STALE'; end if;
 update public.orkto_billing_bindings set financial_status=p_financial_status,last_reconciled_at=p_observed_at where id=p_binding_id;
 if p_financial_status<>'confirmed' or binding.provider_status is distinct from 'ACTIVE' then
  insert into public.orkto_wia_events(workspace_id,event_type,source,entity_type,entity_ref,payload)
  values(binding.workspace_id,'billing.subscription.policy_required','system','billing_binding',binding.id::text,
   jsonb_build_object('financial_status',p_financial_status,'environment','sandbox'));
  return 'RECORDED_POLICY_REQUIRED';
 end if;
 update public.orkto_workspace_subscriptions set status=case when p_period_end<=now() or p_period_start>now() then 'suspended'
 when p_financial_status='confirmed' then 'active' when p_financial_status='overdue' then 'past_due'
 when p_financial_status in ('cancelled','refunded') then 'cancelled' else 'suspended' end,
 current_period_start=p_period_start,current_period_end=p_period_end,
 billing_pending=case when p_financial_status='confirmed' and p_period_start<=now() and p_period_end>now() then false else billing_pending end,
 updated_at=now() where id=binding.subscription_id and workspace_id=binding.workspace_id;
 insert into public.orkto_wia_events(workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,payload)
 values(binding.workspace_id,null,'billing.subscription.reconciled','system','subscription',binding.subscription_id::text,
 jsonb_build_object('event_key',p_event_key,'financial_status',p_financial_status,'environment','sandbox'));
 return 'APPLIED';
end $$;
