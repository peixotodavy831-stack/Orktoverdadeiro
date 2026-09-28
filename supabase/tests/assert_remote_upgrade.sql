-- Synthetic fixture only, in the disposable cluster.
do $$ begin
  if not exists(select 1 from public.quotes where quote_number='EXPIRED-READINESS'
    and status='expired' and total=10 and workspace_id=user_id
    and retention_expires_at<now() and customer_id is null) then raise exception 'Expired quote was lost, changed or ambiguously linked by upgrade'; end if;
  if not exists(select 1 from public.proposals where slug='EXPTEST1' and not is_active
    and workspace_id=user_id and expires_at<now() and version=1)
    then raise exception 'Expired proposal was changed by upgrade'; end if;
end $$;
-- Remove this test-only edge case after preservation assertions, so the shared
-- tenant fixture still has exactly one quote per owner.
delete from public.quotes where quote_number='EXPIRED-READINESS';
delete from public.clients where name like 'AMBIGUOUS-READINESS-%';
