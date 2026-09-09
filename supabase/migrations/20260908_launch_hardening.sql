-- Launch hardening: keep binary logos out of profiles and remove unused secrets.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-logos', 'company-logos', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS company_logos_insert_own_folder ON storage.objects;
CREATE POLICY company_logos_insert_own_folder ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS company_logos_update_own_folder ON storage.objects;
CREATE POLICY company_logos_update_own_folder ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'company-logos' AND owner_id = (SELECT auth.uid()::text))
WITH CHECK (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS company_logos_select_own_folder ON storage.objects;
CREATE POLICY company_logos_select_own_folder ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS company_logos_delete_own_folder ON storage.objects;
CREATE POLICY company_logos_delete_own_folder ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'company-logos' AND owner_id = (SELECT auth.uid()::text));

ALTER TABLE public.payment_records ALTER COLUMN confirmed_at DROP NOT NULL;
ALTER TABLE public.payment_records ALTER COLUMN confirmed_at DROP DEFAULT;
UPDATE public.payment_records SET confirmed_at = NULL WHERE lower(status) NOT IN ('confirmed', 'received');
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'asaas';

CREATE INDEX IF NOT EXISTS quote_extensions_quote_id_idx ON public.quote_extensions(quote_id);
DROP POLICY IF EXISTS quote_extensions_owner_select ON public.quote_extensions;
CREATE POLICY quote_extensions_owner_select ON public.quote_extensions
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- These legacy columns are unused. Keeping provider credentials in a browser-readable
-- profile row would unnecessarily expose them to the account owner session.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS asaas_api_key;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS asaas_customer_id;
