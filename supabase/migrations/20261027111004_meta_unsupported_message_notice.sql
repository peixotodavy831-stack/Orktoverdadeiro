-- Local-only additive migration. No media download, provider call or browser grant.
begin;
create index if not exists orkto_messages_workspace_history_idx
 on public.orkto_messages(workspace_id,conversation_id,sent_at desc,id desc);
create or replace function public.orkto_ingest_meta_unsupported_message(
  p_connection_id uuid,p_provider_event_id text,p_claim_token uuid,p_external_message_id text,
  p_sender_phone text,p_message_type text,p_occurred_at timestamptz
) returns table(decision text,conversation_id uuid,message_id uuid,service_mode text)
language plpgsql security definer set search_path = '' as $$
declare r record; v_workspace uuid; v_label text;
begin
  if p_message_type is null or p_message_type !~ '^[a-z_]{1,40}$' or p_message_type='text' then
    raise exception 'invalid unsupported message type' using errcode='22023';
  end if;
  v_label:=case p_message_type when 'image' then 'Imagem' when 'audio' then 'Áudio'
    when 'video' then 'Vídeo' when 'document' then 'Documento' when 'location' then 'Localização'
    when 'contacts' then 'Contato' when 'sticker' then 'Figurinha' else 'Mensagem de tipo não suportado' end;
  -- Reuse the claim lock, connection/workspace binding, dedup, unique client match,
  -- conversation, audit and usage path. The marker and metadata commit atomically.
  select * into r from public.orkto_ingest_meta_text_message(p_connection_id,p_provider_event_id,
    p_claim_token,p_external_message_id,p_sender_phone,
    v_label||' recebida no WhatsApp. O conteúdo não foi processado pela ORKTO. Solicite uma descrição em texto.',p_occurred_at);
  if r.decision='APPLIED' then
    select c.workspace_id into v_workspace from public.orkto_channel_connections c where c.id=p_connection_id;
    update public.orkto_messages m set message_type=case when p_message_type in ('image','audio','video','document','location')
      then p_message_type when p_message_type='contacts' then 'contact' else 'system' end,
      metadata=coalesce(m.metadata,'{}'::jsonb)||jsonb_build_object('content_state','unsupported',
        'provider_message_type',p_message_type,'content_processed',false)
      where m.id=r.message_id and m.workspace_id=v_workspace and m.conversation_id=r.conversation_id;
    -- Provider/system notifications are visible but are not a customer message
    -- that authorizes a new service window. Unknown types fail closed as well.
    if p_message_type not in ('image','audio','video','document','location','contacts','sticker','reaction','interactive','button','order') then
      update public.orkto_messages set direction='internal',sender_role='system'
        where id=r.message_id and workspace_id=v_workspace;
      delete from public.orkto_whatsapp_usage_events where connection_id=p_connection_id
        and workspace_id=v_workspace and provider_message_id=p_external_message_id and direction='incoming';
    end if;
  end if;
  return query select r.decision::text,r.conversation_id::uuid,r.message_id::uuid,r.service_mode::text;
end $$;

create or replace function public.orkto_record_meta_receipt(
 p_workspace_id uuid,p_send_request_id uuid,p_provider_event_id text,p_payload_fingerprint text,
 p_provider_message_id text,p_provider_status text,p_occurred_at timestamptz
) returns text language plpgsql security definer set search_path='' as $$
declare v_decision text; v_mapped text;
begin
 if p_provider_status is null or p_provider_status not in ('sent','delivered','read','failed') then
   raise exception 'invalid Meta receipt status' using errcode='22023';
 end if;
 v_mapped:=case p_provider_status when 'sent' then 'PROVIDER_ACKNOWLEDGED' when 'failed' then 'FAILED' else 'DELIVERED' end;
 v_decision:=public.orkto_record_channel_delivery_event(p_workspace_id,p_send_request_id,'meta_whatsapp_cloud',
   p_provider_event_id,p_payload_fingerprint,p_provider_message_id,v_mapped,p_occurred_at,
   case when p_provider_status='failed' then 'provider_transient' else null end);
 if v_decision='APPLIED' then
   update public.orkto_messages m set metadata=coalesce(m.metadata,'{}'::jsonb)||jsonb_build_object(
     'provider_receipt_status',p_provider_status,'provider_receipt_at',p_occurred_at)
   from public.orkto_channel_send_requests s
   where s.id=p_send_request_id and s.workspace_id=p_workspace_id
     and m.workspace_id=s.workspace_id and m.conversation_id=s.conversation_id
     and m.external_event_id=p_provider_message_id and m.direction='outgoing'
     -- Read confirmation is terminal for presentation; an out-of-order receipt
     -- must not replace it, even if it arrives with a newer provider timestamp.
     and (m.metadata->>'provider_receipt_status' is distinct from 'read' or p_provider_status='read');
 end if;
 return v_decision;
end $$;
revoke all on function public.orkto_ingest_meta_unsupported_message(uuid,text,uuid,text,text,text,timestamptz) from PUBLIC,anon,authenticated;
grant execute on function public.orkto_ingest_meta_unsupported_message(uuid,text,uuid,text,text,text,timestamptz) to service_role;
revoke all on function public.orkto_record_meta_receipt(uuid,uuid,text,text,text,text,timestamptz) from PUBLIC,anon,authenticated;
grant execute on function public.orkto_record_meta_receipt(uuid,uuid,text,text,text,text,timestamptz) to service_role;
commit;
