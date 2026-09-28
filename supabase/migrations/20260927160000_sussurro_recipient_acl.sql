-- Keep team-wide Sussurros visible to active workspace members while restricting
-- addressed instructions to their recipient and sender. The API uses service_role
-- for writes and applies the same recipient filter on reads.
drop policy if exists orkto_sussurros_workspace_access on public.orkto_sussurros;

create policy orkto_sussurros_recipient_select
  on public.orkto_sussurros
  for select
  to authenticated
  using (
    public.orkto_is_workspace_member(workspace_id)
    and (
      to_user_id is null
      or to_user_id = auth.uid()
      or from_user_id = auth.uid()
    )
  );
