-- Bound foreign-key lookups introduced by the Meta WhatsApp channel and avoid
-- recalculating auth.uid() for every Sussurros row. No privileges are widened.

create index if not exists orkto_channel_connections_connected_by_idx
  on public.orkto_channel_connections(connected_by)
  where connected_by is not null;

create index if not exists orkto_whatsapp_controls_connection_workspace_idx
  on public.orkto_whatsapp_controls(connection_id, workspace_id);

create index if not exists orkto_whatsapp_controls_updated_by_idx
  on public.orkto_whatsapp_controls(updated_by)
  where updated_by is not null;

create index if not exists orkto_whatsapp_rate_cards_approved_by_idx
  on public.orkto_whatsapp_rate_cards(approved_by)
  where approved_by is not null;

create index if not exists orkto_whatsapp_webhook_connection_workspace_idx
  on public.orkto_whatsapp_webhook_events(connection_id, workspace_id);

create index if not exists orkto_whatsapp_usage_connection_workspace_idx
  on public.orkto_whatsapp_usage_events(connection_id, workspace_id);

create index if not exists orkto_whatsapp_usage_rate_card_idx
  on public.orkto_whatsapp_usage_events(rate_card_id)
  where rate_card_id is not null;

create index if not exists orkto_channel_send_rate_card_idx
  on public.orkto_channel_send_requests(rate_card_id)
  where rate_card_id is not null;

create index if not exists orkto_channel_send_conversation_workspace_idx
  on public.orkto_channel_send_requests(conversation_id, workspace_id);

drop policy if exists orkto_sussurros_recipient_select on public.orkto_sussurros;

create policy orkto_sussurros_recipient_select
  on public.orkto_sussurros
  for select
  to authenticated
  using (
    public.orkto_is_workspace_member(workspace_id)
    and (
      to_user_id is null
      or to_user_id = (select auth.uid())
      or from_user_id = (select auth.uid())
    )
  );
