-- Five owner-approved offers. Preserve retired legacy rows and subscription history.
alter table public.orkto_plan_catalog add column if not exists commercial_available boolean not null default false;
update public.orkto_plan_catalog set commercial_available=false;
with prices(plan_key,name,cents) as (values ('starter','Start',7990::bigint),('pro','Pro',14990),
 ('business','Business',29990),('scale','Scale',59990),('enterprise','Enterprise',null::bigint))
insert into public.orkto_plan_price_versions(plan_key,version,price_cents,currency,price_is_public,status,entitlements,effective_from)
select p.plan_key,2,p.cents,'BRL',true,'approved',
 jsonb_build_object('features',coalesce(c.entitlements->'features','{}'::jsonb),
 'limits',coalesce(c.entitlements->'limits','{}'::jsonb),
 'commercial_limits_pending',jsonb_build_array('seats','monthly_wia_runs','pulso'),
 'contracting',case when p.plan_key='enterprise' then 'proposal' else 'subscription_disabled' end),now()
from prices p join public.orkto_plan_catalog c using(plan_key);
update public.orkto_plan_catalog c set display_name=case when c.plan_key='starter' then 'Start' else c.display_name end,
 price_cents=v.price_cents,price_is_public=true,commercial_available=true,version=2,entitlements=v.entitlements,updated_at=now()
from public.orkto_plan_price_versions v where v.plan_key=c.plan_key and v.version=2;

-- Price history is immutable. Retiring a version never rewrites its price/entitlements.
create function public.orkto_preserve_price_version() returns trigger language plpgsql set search_path='' as $$
begin
 if new.plan_key is distinct from old.plan_key or new.version is distinct from old.version
 or new.price_cents is distinct from old.price_cents or new.currency is distinct from old.currency
 or new.entitlements is distinct from old.entitlements then raise exception 'PRICE_VERSION_IMMUTABLE' using errcode='23514'; end if;
 return new;
end $$;
create trigger orkto_price_version_immutable before update on public.orkto_plan_price_versions
for each row execute function public.orkto_preserve_price_version();

create table public.orkto_commercial_requests(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.orkto_workspaces(id),
 requested_by uuid not null references auth.users(id),plan_key text not null references public.orkto_plan_catalog(plan_key),
 requirements text not null check(length(requirements) between 10 and 3000),
 status text not null default 'requested' check(status in ('requested','reviewing','proposed','closed')),
 idempotency_key text not null,created_at timestamptz not null default now(),unique(workspace_id,idempotency_key)
);
create index orkto_commercial_requests_actor_idx on public.orkto_commercial_requests(requested_by);
create index orkto_commercial_requests_plan_idx on public.orkto_commercial_requests(plan_key);

-- No allowances seeded: owners still need to approve plan limits and Pulso packages.
create table public.orkto_pulso_policies(
 workspace_id uuid primary key references public.orkto_workspaces(id),version integer not null check(version>0),
 allowance_milli bigint not null check(allowance_milli>=0),approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null default now(),expires_at timestamptz not null,reason text not null check(length(reason)>=10)
);
create index orkto_pulso_policy_approver_idx on public.orkto_pulso_policies(approved_by);
create function public.orkto_audit_pulso_policy() returns trigger language plpgsql set search_path='' as $$
begin
 if new.expires_at<=now() or (TG_OP='UPDATE' and new.version<=old.version) then raise exception 'PULSO_POLICY_VERSION_REQUIRED'; end if;
 insert into public.orkto_wia_events(workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,payload)
 values(new.workspace_id,new.approved_by,'billing.pulso.policy_approved','system','pulso_policy',new.workspace_id::text,
 jsonb_build_object('version',new.version,'allowance_milli',new.allowance_milli,'reason',new.reason));
 return new;
end $$;
create trigger orkto_pulso_policy_audited after insert or update on public.orkto_pulso_policies
for each row execute function public.orkto_audit_pulso_policy();
revoke all on function public.orkto_audit_pulso_policy() from public,anon,authenticated;
create table public.orkto_pulso_ledger(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.orkto_workspaces(id),
 period_start date not null,request_key text not null,policy_version integer not null,
 operation_class text not null check(operation_class in ('simple','light','normal','complex')),
 reserved_milli bigint not null check(reserved_milli>0),state text not null check(state in ('reserved','consumed','unknown','released')),
 usage jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(workspace_id,request_key)
);
create index orkto_pulso_ledger_period_idx on public.orkto_pulso_ledger(workspace_id,period_start,state);
create table public.orkto_model_tariffs(
 provider text not null,model text not null,version integer not null check(version>0),
 input_microusd_per_million bigint not null check(input_microusd_per_million>=0),
 output_microusd_per_million bigint not null check(output_microusd_per_million>=0),
 cached_microusd_per_million bigint not null check(cached_microusd_per_million>=0),
 effective_from timestamptz not null,effective_until timestamptz,approved_by uuid not null references auth.users(id),
 primary key(provider,model,version),check(effective_until is null or effective_until>effective_from)
);
create index orkto_model_tariffs_approver_idx on public.orkto_model_tariffs(approved_by);

-- Invoker functions are deliberately service-only; no new SECURITY DEFINER authority.
create function public.orkto_reserve_pulso(p_workspace_id uuid,p_request_key text,p_class text)
returns jsonb language plpgsql set search_path='' as $$
declare policy public.orkto_pulso_policies; existing public.orkto_pulso_ledger; used bigint; units bigint;
begin
 units:=case p_class when 'simple' then 250 when 'light' then 500 when 'normal' then 1000 when 'complex' then 4000 else null end;
 if units is null or p_request_key is null or length(p_request_key) not between 8 and 200 then raise exception 'PULSO_INVALID'; end if;
 select * into policy from public.orkto_pulso_policies where workspace_id=p_workspace_id for update;
 if not found or policy.expires_at<=now() then return jsonb_build_object('allowed',false,'reason','configuration_required'); end if;
 select * into existing from public.orkto_pulso_ledger where workspace_id=p_workspace_id and request_key=p_request_key;
 if found then return jsonb_build_object('allowed',false,'reason','already_reserved','state',existing.state); end if;
 select coalesce(sum(reserved_milli),0) into used from public.orkto_pulso_ledger
 where workspace_id=p_workspace_id and period_start=date_trunc('month',now())::date and state<>'released';
 if used+units>policy.allowance_milli then return jsonb_build_object('allowed',false,'reason','limit_reached'); end if;
 insert into public.orkto_pulso_ledger(workspace_id,period_start,request_key,policy_version,operation_class,reserved_milli,state)
 values(p_workspace_id,date_trunc('month',now())::date,p_request_key,policy.version,p_class,units,'reserved');
 return jsonb_build_object('allowed',true,'reservedMilli',units,'remainingMilli',policy.allowance_milli-used-units);
end $$;
create function public.orkto_finish_pulso(p_workspace_id uuid,p_request_key text,p_state text,p_usage jsonb)
returns boolean language plpgsql set search_path='' as $$
begin
 if p_state not in ('consumed','unknown','released') then raise exception 'PULSO_INVALID'; end if;
 update public.orkto_pulso_ledger set state=p_state,usage=p_usage,updated_at=now()
 where workspace_id=p_workspace_id and request_key=p_request_key and state='reserved';
 return found;
end $$;

-- Sandbox subscription bindings are server-created before calling the provider.
alter table public.orkto_workspace_subscriptions add column if not exists billing_pending boolean not null default false;
create table public.orkto_billing_customers(
 workspace_id uuid primary key references public.orkto_workspaces(id),provider text not null check(provider='asaas'),
 environment text not null check(environment='sandbox'),customer_ref text not null unique,
 approved_by uuid not null references auth.users(id),approved_at timestamptz not null default now()
);
create index orkto_billing_customer_approver_idx on public.orkto_billing_customers(approved_by);
create table public.orkto_billing_bindings(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.orkto_workspaces(id),
 subscription_id uuid not null unique references public.orkto_workspace_subscriptions(id),
 provider text not null check(provider='asaas'),environment text not null check(environment='sandbox'),
 provider_subscription_id text unique,price_version_id uuid not null references public.orkto_plan_price_versions(id),
 idempotency_key text not null,customer_ref text not null,creation_state text not null default 'reserved' check(creation_state in ('reserved','created','unknown')),
 financial_status text not null default 'pending' check(financial_status in ('pending','confirmed','overdue','refunded','cancelled')),
 last_reconciled_at timestamptz,created_at timestamptz not null default now(),unique(workspace_id,idempotency_key)
);
create index orkto_billing_binding_workspace_idx on public.orkto_billing_bindings(workspace_id);
create index orkto_billing_binding_price_idx on public.orkto_billing_bindings(price_version_id);
create table public.orkto_subscription_events(
 id uuid primary key default gen_random_uuid(),binding_id uuid not null references public.orkto_billing_bindings(id),
 event_key text not null,observed_at timestamptz not null,financial_status text not null,
 period_start timestamptz not null,period_end timestamptz not null,amount_cents bigint not null,currency text not null,
 created_at timestamptz not null default now(),unique(binding_id,event_key),check(period_end>period_start)
);
create index orkto_subscription_events_binding_idx on public.orkto_subscription_events(binding_id,observed_at);
create function public.orkto_reconcile_subscription(p_binding_id uuid,p_event_key text,p_provider_subscription_id text,
 p_amount_cents bigint,p_currency text,p_financial_status text,p_period_start timestamptz,p_period_end timestamptz,p_observed_at timestamptz)
returns text language plpgsql set search_path='' as $$
declare binding public.orkto_billing_bindings; price public.orkto_plan_price_versions; previous public.orkto_subscription_events;
begin
 select * into binding from public.orkto_billing_bindings where id=p_binding_id for update;
 if not found or binding.provider_subscription_id is distinct from p_provider_subscription_id then raise exception 'BILLING_BINDING_MISMATCH'; end if;
 select * into price from public.orkto_plan_price_versions where id=binding.price_version_id;
 if price.plan_key='enterprise' or price.version<>2 or price.price_cents is distinct from p_amount_cents or p_currency<>'BRL'
 or price.currency<>p_currency or p_financial_status not in ('pending','confirmed','overdue','refunded','cancelled')
 or p_period_end<=p_period_start or p_observed_at>now()+interval '1 minute' or length(p_event_key) not between 8 and 200
 or p_amount_cents is null or p_currency is null or p_financial_status is null or p_observed_at is null
 or p_period_start is null or p_period_end is null then raise exception 'BILLING_RECONCILIATION_INVALID'; end if;
 select * into previous from public.orkto_subscription_events where binding_id=p_binding_id and event_key=p_event_key;
 if found then
  if previous.amount_cents<>p_amount_cents or previous.financial_status<>p_financial_status or previous.period_start<>p_period_start
   or previous.period_end<>p_period_end or previous.observed_at<>p_observed_at or previous.currency<>p_currency then raise exception 'BILLING_EVENT_CONFLICT'; end if;
  return 'REPLAY';
 end if;
 insert into public.orkto_subscription_events(binding_id,event_key,observed_at,financial_status,period_start,period_end,amount_cents,currency)
 values(p_binding_id,p_event_key,p_observed_at,p_financial_status,p_period_start,p_period_end,p_amount_cents,p_currency);
 if binding.last_reconciled_at is not null and p_observed_at<=binding.last_reconciled_at then return 'STALE'; end if;
 update public.orkto_billing_bindings set financial_status=p_financial_status,last_reconciled_at=p_observed_at where id=p_binding_id;
 update public.orkto_workspace_subscriptions set status=case when p_period_end<=now() then 'suspended'
 when p_financial_status='confirmed' then 'active' when p_financial_status='overdue' then 'past_due'
 when p_financial_status in ('cancelled','refunded') then 'cancelled' else 'suspended' end,
 current_period_start=p_period_start,current_period_end=p_period_end,
 billing_pending=case when p_financial_status='confirmed' and p_period_end>now() then false else billing_pending end,
 updated_at=now() where id=binding.subscription_id and workspace_id=binding.workspace_id;
 insert into public.orkto_wia_events(workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,payload)
 values(binding.workspace_id,null,'billing.subscription.reconciled','system','subscription',binding.subscription_id::text,
 jsonb_build_object('event_key',p_event_key,'financial_status',p_financial_status,'environment','sandbox'));
 return 'APPLIED';
end $$;

do $$ declare name text; begin
 foreach name in array array['orkto_commercial_requests','orkto_pulso_policies','orkto_pulso_ledger','orkto_model_tariffs','orkto_billing_customers','orkto_billing_bindings','orkto_subscription_events'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('revoke all on public.%I from public,anon,authenticated',name);
  execute format('grant select,insert,update on public.%I to service_role',name);
 end loop;
end $$;
revoke all on function public.orkto_reserve_pulso(uuid,text,text),public.orkto_finish_pulso(uuid,text,text,jsonb),
 public.orkto_reconcile_subscription(uuid,text,text,bigint,text,text,timestamptz,timestamptz,timestamptz),
 public.orkto_preserve_price_version() from public,anon,authenticated;
grant execute on function public.orkto_reserve_pulso(uuid,text,text),public.orkto_finish_pulso(uuid,text,text,jsonb),
 public.orkto_reconcile_subscription(uuid,text,text,bigint,text,text,timestamptz,timestamptz,timestamptz) to service_role;

create function public.orkto_request_commercial_proposal(p_workspace_id uuid,p_actor_id uuid,p_key text,p_requirements text)
returns uuid language plpgsql set search_path='' as $$
declare result uuid; old_requirements text;
begin
 if length(p_requirements) not between 10 and 3000 or length(p_key) not between 8 and 128 then raise exception 'COMMERCIAL_INVALID'; end if;
 if not exists(select 1 from public.orkto_workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id
 and status='active' and role in ('owner','admin')) then raise exception 'COMMERCIAL_PERMISSION_DENIED' using errcode='42501'; end if;
 perform 1 from public.orkto_workspaces where id=p_workspace_id for update;
 select id,requirements into result,old_requirements from public.orkto_commercial_requests where workspace_id=p_workspace_id and idempotency_key=p_key;
 if found then
  if old_requirements<>p_requirements then raise exception 'COMMERCIAL_IDEMPOTENCY_CONFLICT'; end if;
  return result;
 end if;
 if (select count(*) from public.orkto_commercial_requests where workspace_id=p_workspace_id and created_at>now()-interval '1 day')>=5 then raise exception 'COMMERCIAL_RATE_LIMITED'; end if;
 insert into public.orkto_commercial_requests(workspace_id,requested_by,plan_key,requirements,idempotency_key)
 values(p_workspace_id,p_actor_id,'enterprise',p_requirements,p_key) returning id into result;
 insert into public.orkto_wia_events(workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,payload)
 values(p_workspace_id,p_actor_id,'commercial.proposal.requested','user','commercial_request',result::text,'{"plan":"enterprise"}');
 return result;
end $$;
revoke all on function public.orkto_request_commercial_proposal(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.orkto_request_commercial_proposal(uuid,uuid,text,text) to service_role;

create function public.orkto_begin_sandbox_subscription(p_workspace_id uuid,p_actor_id uuid,p_key text,p_plan text,p_customer text)
returns jsonb language plpgsql set search_path='' as $$
declare existing public.orkto_billing_bindings; price public.orkto_plan_price_versions; subscription_id uuid; binding_id uuid;
begin
 if not exists(select 1 from public.orkto_workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id
 and status='active' and role in ('owner','admin')) then raise exception 'BILLING_PERMISSION_DENIED' using errcode='42501'; end if;
 if p_plan not in ('starter','pro','business','scale') or p_customer !~ '^cus_[A-Za-z0-9_-]{1,100}$' or length(p_key) not between 8 and 128 then raise exception 'BILLING_INVALID'; end if;
 if not exists(select 1 from public.orkto_billing_customers where workspace_id=p_workspace_id and customer_ref=p_customer
 and environment='sandbox' and provider='asaas') then raise exception 'BILLING_CUSTOMER_NOT_APPROVED'; end if;
 perform 1 from public.orkto_workspaces where id=p_workspace_id for update;
 select * into existing from public.orkto_billing_bindings where workspace_id=p_workspace_id and idempotency_key=p_key;
 if found then
  select * into price from public.orkto_plan_price_versions where id=existing.price_version_id;
  if price.plan_key<>p_plan or existing.customer_ref<>p_customer then raise exception 'BILLING_EVENT_CONFLICT'; end if;
  return jsonb_build_object('created',false,'bindingId',existing.id,'providerId',existing.provider_subscription_id,'state',existing.creation_state);
 end if;
 if exists(select 1 from public.orkto_billing_bindings where workspace_id=p_workspace_id and creation_state in ('reserved','unknown')) then raise exception 'BILLING_RECONCILIATION_REQUIRED'; end if;
 select * into price from public.orkto_plan_price_versions where plan_key=p_plan and version=2 and status='approved' and price_cents is not null;
 if not found then raise exception 'BILLING_PRICE_REQUIRED'; end if;
 insert into public.orkto_workspace_subscriptions(workspace_id,plan_key,status,idempotency_key,billing_pending)
 values(p_workspace_id,p_plan,'suspended','sandbox:'||p_key,true) returning id into subscription_id;
 insert into public.orkto_billing_bindings(workspace_id,subscription_id,provider,environment,price_version_id,idempotency_key,customer_ref)
 values(p_workspace_id,subscription_id,'asaas','sandbox',price.id,p_key,p_customer) returning id into binding_id;
 insert into public.orkto_wia_events(workspace_id,actor_user_id,event_type,source,entity_type,entity_ref,payload)
 values(p_workspace_id,p_actor_id,'billing.sandbox.reserved','system','billing_binding',binding_id::text,jsonb_build_object('price_version',2,'plan',p_plan));
 return jsonb_build_object('created',true,'bindingId',binding_id,'priceCents',price.price_cents,'priceVersion',price.version);
end $$;
revoke all on function public.orkto_begin_sandbox_subscription(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.orkto_begin_sandbox_subscription(uuid,uuid,text,text,text) to service_role;
