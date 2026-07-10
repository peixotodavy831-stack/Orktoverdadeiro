-- ============================================
-- ORKTO V2 - Adicionar colunas faltantes
-- Execute no SQL Editor do Supabase
-- ============================================

-- Adicionar colunas Asaas (ignora se já existir)
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN asaas_api_key TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN asaas_customer_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN is_founder BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN founder_price INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Adicionar colunas de plano (ignora se já existir)
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN active_plan TEXT DEFAULT 'free';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN plan_period TEXT DEFAULT 'monthly';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- View pública de orçamentos (substitui se já existir)
CREATE OR REPLACE VIEW public_quotes AS
SELECT
  q.id,
  q.quote_number,
  q.client_name,
  q.client_phone,
  q.client_email,
  q.client_company,
  q.client_vehicle_or_service,
  q.items,
  q.subtotal,
  q.discount_total,
  q.total,
  q.valid_value_days,
  q.payment_instructions,
  q.status,
  q.created_at,
  q.sent_at,
  q.viewed_at,
  p.company_name,
  p.company_logo,
  p.address,
  p.quote_color,
  p.profession,
  p.brand_name,
  p.whatsapp_number
FROM quotes q
JOIN profiles p ON q.user_id = p.id
WHERE q.status IN ('sent', 'viewed', 'pending');
