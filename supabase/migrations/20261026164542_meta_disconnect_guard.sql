-- ORKTO-local revocation only; no provider-wide permission revocation or token export.
begin;
create or replace function public.orkto_disconnect_meta_connection(p_workspace_id uuid,p_actor_user_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_connection public.orkto_channel_connections%rowtype;
begin
  if not exists(select 1 from public.orkto_workspace_members m where m.workspace_id=p_workspace_id
    and m.user_id=p_actor_user_id and m.status='active' and m.role in ('owner','admin')) then
    raise exception 'ORKTO_PERMISSION_DENIED' using errcode='42501';
  end if;
  select c.* into v_connection from public.orkto_channel_connections c
    where c.workspace_id=p_workspace_id and c.provider='meta_whatsapp_cloud' for update;
  if v_connection.id is null then return 'NOT_FOUND'; end if;
  if v_connection.status='revoked' then return 'REPLAY'; end if;
  -- Never abandon in-flight or uncertain sends; reconcile before disconnecting.
  if exists(select 1 from public.orkto_channel_send_requests s where s.workspace_id=p_workspace_id
    and s.provider='meta_whatsapp_cloud' and s.status not in ('DELIVERED','FAILED')) then
    return 'RECONCILIATION_REQUIRED';
  end if;
  update public.orkto_whatsapp_controls set human_takeover=true,updated_by=p_actor_user_id,updated_at=now()
    where workspace_id=p_workspace_id;
  update public.orkto_channel_connections set status='revoked',last_error_category=null,updated_at=now()
    where id=v_connection.id;
  -- orkto_read_meta_token rejects revoked connections. Encrypted Vault material
  -- is retained for controlled lifecycle handling; no irreversible secret deletion.
  insert into public.orkto_audit_log(user_id,workspace_id,event_type,actor_type,actor_id,event_data)
  values(p_actor_user_id,p_workspace_id,'channel.meta.disconnected','human',p_actor_user_id::text,
    jsonb_build_object('connection_id',v_connection.id,'scope','orkto_local','provider_revocation','not_performed'));
  return 'DISCONNECTED';
end $$;
revoke all on function public.orkto_disconnect_meta_connection(uuid,uuid) from public,anon,authenticated;
grant execute on function public.orkto_disconnect_meta_connection(uuid,uuid) to service_role;
commit;
