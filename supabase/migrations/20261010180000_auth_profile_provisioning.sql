-- Auth creates the identity; this trigger creates only its minimal profile.
-- The existing profile trigger provisions the personal workspace and owner
-- membership. No client-supplied workspace, role, plan, or privilege is read.
create or replace function public.orkto_provision_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- An identity without an email is not provisioned for the core app.
  if nullif(btrim(new.email), '') is null then
    return new;
  end if;

  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    left(coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Usuário'), 160)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.orkto_provision_profile_for_auth_user()
  from public, anon, authenticated;
grant execute on function public.orkto_provision_profile_for_auth_user()
  to service_role;

drop trigger if exists orkto_auth_provision_profile on auth.users;
create trigger orkto_auth_provision_profile
after insert on auth.users
for each row execute function public.orkto_provision_profile_for_auth_user();
