-- Convergência local de Plans/Billing e Finance/POK.
-- Preços ficam não públicos; não instala checkout nem altera assinatura remota.

-- 1) Keep an explicit product key for accounts that used the legacy `free` plan.
alter table public.orkto_workspaces drop constraint if exists orkto_workspaces_plan_key_check;
alter table public.orkto_workspaces add constraint orkto_workspaces_plan_key_check
  check (plan_key in ('starter','pro','business','scale','enterprise','founders','legacy_standard'));

alter table public.orkto_plan_catalog drop constraint if exists orkto_plan_catalog_plan_key_check;
alter table public.orkto_plan_catalog add constraint orkto_plan_catalog_plan_key_check
  check (plan_key in ('starter','pro','business','scale','enterprise','founders','legacy_standard'));

insert into public.orkto_plan_catalog(plan_key, display_name, price_cents, currency, price_is_public, status, entitlements, version)
values ('legacy_standard','Legacy Standard',null,'BRL',false,'approved','{}'::jsonb,1)
on conflict (plan_key) do update set display_name='Legacy Standard', price_cents=null, price_is_public=false;

-- Plan entitlements are versioned separately from public prices. Null quota means explicitly uncapped;
-- numeric seats/WIA caps remain unset until the commercial limits are approved.
with plan_defaults(plan_key, display_name, active_proposals) as (
  values
    ('starter','Starter',5),
    ('pro','Pro',50),
    ('business','Business',999),
    ('scale','Scale',null::integer),
    ('enterprise','Enterprise',null::integer),
    ('founders','Founders',5),
    ('legacy_standard','Legacy Standard',5)
)
insert into public.orkto_plan_price_versions(
  plan_key, version, price_cents, currency, price_is_public, status, entitlements, effective_from
)
select plan_key, 1, null, 'BRL', false, 'approved',
  jsonb_build_object(
    'features', jsonb_build_object('core_crm',true,'proposals',true,'wia',true),
    'limits', jsonb_build_object('seats',null,'monthly_wia_runs',null,'active_proposals',active_proposals),
    'commercial_limits_pending', jsonb_build_array('seats','monthly_wia_runs')
  ), now()
from plan_defaults
on conflict (plan_key,version) do nothing;

update public.orkto_plan_catalog c
set status='approved', price_cents=null, price_is_public=false,
    entitlements=v.entitlements, version=greatest(c.version,1), effective_from=v.effective_from, updated_at=now()
from public.orkto_plan_price_versions v
where v.plan_key=c.plan_key and v.version=1 and c.plan_key in ('starter','pro','business','scale','enterprise','founders','legacy_standard');

-- Keep legacy profile plan data readable while mapping `free` to Legacy Standard.
update public.orkto_workspaces w
set plan_key = case p.active_plan when 'free' then 'legacy_standard' else p.active_plan end,
    updated_at = now()
from public.profiles p
where p.id = w.owner_user_id
  and p.active_plan in ('free','pro','business')
  and not exists (select 1 from public.orkto_workspace_subscriptions s where s.workspace_id=w.id);

-- A configurable Postgres setting controls the default trial duration; fallback is 14 days.
create or replace function public.orkto_default_trial_days()
returns integer language plpgsql stable security invoker set search_path=pg_catalog as $$
declare configured text; days integer;
begin
  configured := current_setting('orkto.default_trial_days', true);
  begin days := nullif(configured,'')::integer; exception when others then days := null; end;
  if days is null or days < 0 or days > 365 then return 14; end if;
  return days;
end;
$$;

-- Preserve old paid-plan markers as active for compatibility, and create a timed trial for new/default workspaces.
insert into public.orkto_workspace_subscriptions(workspace_id,plan_key,status,trial_ends_at,current_period_start,idempotency_key)
select w.id, w.plan_key,
       case when w.plan_key in ('pro','business','scale','enterprise','founders') or w.subscription_status='active' then 'active' else 'trial' end,
       case when w.plan_key in ('pro','business','scale','enterprise','founders') or w.subscription_status='active' then null
            else w.created_at + make_interval(days => public.orkto_default_trial_days()) end,
       w.created_at,
       'convergence-4-initial'
from public.orkto_workspaces w
where not exists (select 1 from public.orkto_workspace_subscriptions s where s.workspace_id=w.id);

create or replace function public.orkto_create_default_workspace_trial()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.orkto_workspace_subscriptions(workspace_id,plan_key,status,trial_ends_at,current_period_start,idempotency_key)
  values(new.id,new.plan_key,'trial',now() + make_interval(days => public.orkto_default_trial_days()),now(),'convergence-4-initial')
  on conflict (workspace_id,idempotency_key) do nothing;
  return new;
end;
$$;
drop trigger if exists orkto_workspace_default_trial on public.orkto_workspaces;
create trigger orkto_workspace_default_trial after insert on public.orkto_workspaces
for each row execute function public.orkto_create_default_workspace_trial();

revoke all on function public.orkto_default_trial_days() from public, anon, authenticated;
revoke all on function public.orkto_create_default_workspace_trial() from public, anon, authenticated;

-- Atomic monthly WIA usage counter. The service-role-only function avoids concurrent limit bypasses.
create or replace function public.orkto_consume_plan_usage(
  p_workspace_id uuid,
  p_period_start date,
  p_feature_key text,
  p_delta numeric,
  p_limit numeric default null
)
returns table(allowed boolean, quantity numeric)
language plpgsql security definer set search_path=public as $$
declare current_quantity numeric;
begin
  if p_feature_key not in ('monthly_wia_runs','active_proposals','seats') or p_delta <= 0 or p_limit < 0 then
    raise exception 'invalid plan usage request' using errcode='22023';
  end if;
  insert into public.orkto_plan_usage(workspace_id,period_start,feature_key,quantity)
  values(p_workspace_id,p_period_start,p_feature_key,0)
  on conflict(workspace_id,period_start,feature_key) do nothing;
  select u.quantity into current_quantity from public.orkto_plan_usage u
  where u.workspace_id=p_workspace_id and u.period_start=p_period_start and u.feature_key=p_feature_key
  for update;
  if p_limit is not null and current_quantity + p_delta > p_limit then
    return query select false,current_quantity;
    return;
  end if;
  update public.orkto_plan_usage u set quantity=current_quantity+p_delta, updated_at=now()
  where u.workspace_id=p_workspace_id and u.period_start=p_period_start and u.feature_key=p_feature_key;
  return query select true,current_quantity+p_delta;
end;
$$;
revoke all on function public.orkto_consume_plan_usage(uuid,date,text,numeric,numeric) from public, anon, authenticated;
grant execute on function public.orkto_consume_plan_usage(uuid,date,text,numeric,numeric) to service_role;

-- Finance provenance: actual cash outlay and normalized economic cost are distinct nullable facts.
-- Replace the historical profile-based quota guard after workspace plans exist.
-- A workspace lock serializes concurrent inserts across the entire team.
create or replace function public.guard_quote_retention() returns trigger
language plpgsql set search_path=public as $$
declare subscription record; entitlement jsonb; quota numeric; used bigint;
begin
 if TG_OP='INSERT' then
  perform 1 from public.orkto_workspaces where id=new.workspace_id for update;
  select s.* into subscription from public.orkto_workspace_subscriptions s
    where s.workspace_id=new.workspace_id order by s.created_at desc limit 1;
  if not found or subscription.status not in ('active','trial')
    or (subscription.status='trial' and (subscription.trial_ends_at is null or subscription.trial_ends_at<=now())) then
    raise exception 'Workspace em modo somente leitura' using errcode='42501';
  end if;
  select v.entitlements into entitlement from public.orkto_plan_price_versions v
    where v.plan_key=subscription.plan_key and v.status='approved' and v.effective_from<=now()
      and (v.effective_until is null or v.effective_until>now())
    order by v.effective_from desc limit 1;
  if entitlement is null or not coalesce((entitlement->'features'->>'proposals')::boolean,false)
    or not coalesce((entitlement->'limits') ? 'active_proposals',false) then
    raise exception 'Entitlement de propostas não configurado' using errcode='42501';
  end if;
  quota:=(entitlement->'limits'->>'active_proposals')::numeric;
  select count(*) into used from public.quotes where workspace_id=new.workspace_id
    and archived_at is null and status not in ('rejected','expired')
    and (retention_expires_at is null or retention_expires_at>now());
  if quota is not null and (quota<0 or used>=quota) then
    raise exception 'Limite de orçamentos ativos do plano atingido' using errcode='23514';
  end if;
  new.retention_expires_at:=case when new.sent_at is not null then now()+interval '14 days' else null end;
  if new.sent_at is not null then new.sent_at:=now(); end if;
 else
  if old.retention_expires_at is not null and old.retention_expires_at<=now() then raise exception 'Orçamento expirado'; end if;
  if old.sent_at is not null then new.sent_at:=old.sent_at; end if;
  if new.retention_expires_at is distinct from old.retention_expires_at and current_user not in ('postgres','service_role') then raise exception 'Prazo controlado pelo servidor'; end if;
  if old.sent_at is null and new.sent_at is not null then new.sent_at:=now(); new.retention_expires_at:=now()+interval '14 days'; end if;
 end if;
 return new;
end $$;

alter table public.orkto_model_usage add column if not exists cached_input_tokens integer not null default 0;
alter table public.orkto_model_usage add column if not exists task_class text;
alter table public.orkto_model_usage add column if not exists feature text;
alter table public.orkto_model_usage add column if not exists gateway text;
alter table public.orkto_model_usage add column if not exists actual_cash_cost_cents bigint;
alter table public.orkto_model_usage add column if not exists normalized_cost_cents bigint;
alter table public.orkto_model_usage add column if not exists cost_currency text;
alter table public.orkto_model_usage add column if not exists cost_source text;
alter table public.orkto_model_usage add column if not exists cost_assumption_version integer;
alter table public.orkto_model_usage add column if not exists billing_period_start date;
update public.orkto_model_usage set billing_period_start=date_trunc('month',created_at)::date where billing_period_start is null;
alter table public.orkto_model_usage alter column billing_period_start set default date_trunc('month',now())::date;
alter table public.orkto_model_usage alter column billing_period_start set not null;

alter table public.orkto_channel_usage add column if not exists actual_cash_cost_cents bigint;
alter table public.orkto_channel_usage add column if not exists normalized_cost_cents bigint;
alter table public.orkto_channel_usage add column if not exists infrastructure_allocation_cents bigint;
alter table public.orkto_channel_usage add column if not exists cost_currency text;
alter table public.orkto_channel_usage add column if not exists cost_source text;
alter table public.orkto_channel_usage add column if not exists billing_period_start date;
update public.orkto_channel_usage set billing_period_start=period_start where billing_period_start is null;
alter table public.orkto_channel_usage alter column billing_period_start set not null;

alter table public.orkto_finance_transactions add column if not exists cost_source text;
alter table public.orkto_finance_transactions add column if not exists assumption_version integer;
alter table public.orkto_finance_transactions add column if not exists currency text not null default 'BRL';
alter table public.orkto_finance_transactions add column if not exists billing_period_start date;
update public.orkto_finance_transactions set billing_period_start=date_trunc('month',occurred_on::timestamp)::date where billing_period_start is null;

-- Finance workspace IDs are ORKTO workspace IDs. Null only historical orphan associations, never financial rows.
alter table public.orkto_finance_transactions drop constraint if exists orkto_finance_transactions_workspace_id_fkey;
update public.orkto_finance_transactions t
set reference=concat_ws(' | ',nullif(t.reference,''),'legacy workspace reference: '||t.workspace_id::text), workspace_id=null
where t.workspace_id is not null and not exists(select 1 from public.orkto_workspaces w where w.id=t.workspace_id);
alter table public.orkto_finance_transactions add constraint orkto_finance_transactions_workspace_id_fkey
  foreign key (workspace_id) references public.orkto_workspaces(id) on delete set null;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='orkto_model_usage_costs_nonnegative') then
    alter table public.orkto_model_usage add constraint orkto_model_usage_costs_nonnegative check(
      cached_input_tokens>=0 and (actual_cash_cost_cents is null or actual_cash_cost_cents>=0)
      and (normalized_cost_cents is null or normalized_cost_cents>=0)
    );
  end if;
  if not exists(select 1 from pg_constraint where conname='orkto_channel_usage_costs_nonnegative') then
    alter table public.orkto_channel_usage add constraint orkto_channel_usage_costs_nonnegative check(
      (actual_cash_cost_cents is null or actual_cash_cost_cents>=0)
      and (normalized_cost_cents is null or normalized_cost_cents>=0)
      and (infrastructure_allocation_cents is null or infrastructure_allocation_cents>=0)
    );
  end if;
end $$;

create index if not exists orkto_model_usage_workspace_period_idx on public.orkto_model_usage(workspace_id,billing_period_start,provider,model);
create index if not exists orkto_plan_usage_period_feature_idx on public.orkto_plan_usage(workspace_id,period_start,feature_key);
