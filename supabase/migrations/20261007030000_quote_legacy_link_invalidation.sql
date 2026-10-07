-- Any edit to customer-visible terms invalidates legacy proposal links in the
-- same transaction. Accepted snapshots in orkto_live_quotes remain immutable.
create or replace function public.orkto_invalidate_legacy_proposals_on_quote_edit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if row(new.client_name,new.client_phone,new.client_email,new.client_company,
         new.client_vehicle_or_service,new.customer_id,new.deal_id,new.notes,
         new.items,new.subtotal,new.discount_total,new.taxes,new.total,
         new.valid_value_days,new.payment_instructions)
     is distinct from
     row(old.client_name,old.client_phone,old.client_email,old.client_company,
         old.client_vehicle_or_service,old.customer_id,old.deal_id,old.notes,
         old.items,old.subtotal,old.discount_total,old.taxes,old.total,
         old.valid_value_days,old.payment_instructions) then
    update public.proposals set is_active=false
      where workspace_id=new.workspace_id and quote_id=new.id and is_active=true;
  end if;
  return new;
end;
$$;

revoke all on function public.orkto_invalidate_legacy_proposals_on_quote_edit()
  from public,anon,authenticated;
grant execute on function public.orkto_invalidate_legacy_proposals_on_quote_edit()
  to service_role;

drop trigger if exists quotes_invalidate_legacy_proposals_on_edit on public.quotes;
create trigger quotes_invalidate_legacy_proposals_on_edit
after update of client_name,client_phone,client_email,client_company,
  client_vehicle_or_service,customer_id,deal_id,notes,items,subtotal,
  discount_total,taxes,total,valid_value_days,payment_instructions
on public.quotes for each row
execute function public.orkto_invalidate_legacy_proposals_on_quote_edit();
