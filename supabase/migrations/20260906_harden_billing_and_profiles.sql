-- Keep billing authority on the server and make webhook delivery idempotent.
-- Existing Asaas customer IDs are retained for server-side reconciliation only.

CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.asaas_webhook_events FROM anon, authenticated;

-- Browser sessions may edit their own business profile, but never billing state
-- or private payment-provider credentials.
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (
  display_name, email, photo_url, onboarding_completed,
  company_name, tax_id, company_logo, whatsapp_number, whatsapp_template,
  payment_info, quote_color, address, profession, brand_name, brand_tone,
  checklist_dismissed
) ON TABLE public.profiles TO authenticated;

REVOKE INSERT ON TABLE public.profiles FROM authenticated;
GRANT INSERT (
  id, display_name, email, photo_url, onboarding_completed,
  company_name, tax_id, company_logo, whatsapp_number, whatsapp_template,
  payment_info, quote_color, address, profession, brand_name, brand_tone,
  checklist_dismissed
) ON TABLE public.profiles TO authenticated;

-- A legacy per-user API key must never be exposed by PostgREST again.
REVOKE SELECT (asaas_api_key, asaas_customer_id) ON TABLE public.profiles FROM authenticated;
