-- A runtime pilot-mode flag must never turn a disabled database admission gate into access.
-- This closes the pilot boundary by default until the database allowlist is explicitly enabled.
create or replace function public.orkto_pilot_session_allowed() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare v_claims jsonb; v_session uuid;
begin
  if not orkto_pilot_private.is_enabled() then return false; end if;
  if auth.uid() is null or not orkto_pilot_private.identity_allowed(auth.uid()) then return false; end if;
  v_claims := auth.jwt();
  if not coalesce(v_claims->'amr' @> '[{"method":"oauth"}]'::jsonb,false) then return false; end if;
  begin v_session := (v_claims->>'session_id')::uuid;
  exception when invalid_text_representation then return false; end;
  return exists(select 1 from auth.sessions s where s.id=v_session and s.user_id=auth.uid()
    and (s.not_after is null or s.not_after>now()));
end;
$$;
revoke all on function public.orkto_pilot_session_allowed() from public,anon;
grant execute on function public.orkto_pilot_session_allowed() to authenticated,service_role;
