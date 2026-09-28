-- Reconciled to remote history version 20260908184808.
-- Fail closed rather than silently deleting any provider credential or account
-- identifier that unexpectedly still contains a value.
do $$
declare
  has_values boolean;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='asaas_api_key'
  ) then
    execute 'select exists(select 1 from public.profiles where nullif(btrim(asaas_api_key), '''') is not null)' into has_values;
    if has_values then raise exception 'profiles.asaas_api_key contains values; export/reconcile before removing this legacy column'; end if;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='asaas_customer_id'
  ) then
    execute 'select exists(select 1 from public.profiles where nullif(btrim(asaas_customer_id), '''') is not null)' into has_values;
    if has_values then raise exception 'profiles.asaas_customer_id contains values; export/reconcile before removing this legacy column'; end if;
  end if;
end;
$$;

alter table public.profiles drop column if exists asaas_api_key;
alter table public.profiles drop column if exists asaas_customer_id;
