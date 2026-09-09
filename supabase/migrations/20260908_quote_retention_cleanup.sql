CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE POLICY quotes_retention_visibility ON public.quotes AS RESTRICTIVE FOR SELECT TO authenticated USING (retention_expires_at IS NULL OR retention_expires_at>now());
CREATE OR REPLACE FUNCTION public.purge_expired_quotes() RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$
DECLARE removed integer;
BEGIN
 WITH expired AS (SELECT id FROM public.quotes WHERE retention_expires_at<=now() ORDER BY retention_expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED)
 DELETE FROM public.quotes q USING expired e WHERE q.id=e.id;
 GET DIAGNOSTICS removed=ROW_COUNT;
 RETURN removed;
END $$;
REVOKE ALL ON FUNCTION public.purge_expired_quotes() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('orkto-purge-expired-quotes','*/5 * * * *','SELECT public.purge_expired_quotes()');
