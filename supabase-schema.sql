-- ============================================
-- ORKTO V2 - Schema Completo
-- Execute no SQL Editor do Supabase
-- ============================================

-- 1. Tabela profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  onboarding_completed BOOLEAN DEFAULT false,

  -- Business Settings
  company_name TEXT,
  tax_id TEXT,
  company_logo TEXT,
  whatsapp_number TEXT,
  whatsapp_template TEXT,
  payment_info TEXT,
  quote_color TEXT DEFAULT '#FF9F1C',
  address TEXT,

  -- ORKTO Brand
  profession TEXT,
  brand_name TEXT,
  brand_tone TEXT DEFAULT 'comercial',

  -- Plans
  active_plan TEXT DEFAULT 'free' CHECK (active_plan IN ('free', 'pro', 'business')),
  plan_period TEXT DEFAULT 'monthly' CHECK (plan_period IN ('monthly', 'annual')),
  trial_expiration_date TEXT,
  checklist_dismissed BOOLEAN DEFAULT false,

  -- Asaas Integration
  asaas_api_key TEXT,
  asaas_customer_id TEXT,

  -- Founder (Vitalício)
  is_founder BOOLEAN DEFAULT false,
  founder_price INTEGER DEFAULT 0
);

-- 2. Tabela quotes (orçamentos)
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  quote_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_email TEXT,
  client_company TEXT,
  client_vehicle_or_service TEXT,
  notes TEXT,

  -- Money
  items JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount_total NUMERIC(12,2) DEFAULT 0,
  taxes NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,

  -- Terms
  valid_value_days INTEGER DEFAULT 15,
  payment_instructions TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'pending', 'approved', 'rejected', 'expired')),

  -- Timeline
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ
);

-- 3. Tabela clients (clientes salvos)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  company TEXT,
  vehicle_or_service TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  quote_count INTEGER DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  last_contact_date TIMESTAMPTZ
);

-- 4. Tabela services (serviços salvos)
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit_price NUMERIC(12,2) DEFAULT 0,
  category TEXT DEFAULT 'Outros Serviços',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id);

-- 6. RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Profiles: usuário só vê o próprio
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Quotes: usuário só vê os próprios
CREATE POLICY "Users can view own quotes" ON quotes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quotes" ON quotes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quotes" ON quotes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quotes" ON quotes
  FOR DELETE USING (auth.uid() = user_id);

-- Clients: usuário só vê os próprios
CREATE POLICY "Users can view own clients" ON clients
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients" ON clients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients" ON clients
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients" ON clients
  FOR DELETE USING (auth.uid() = user_id);

-- Services: usuário só vê os próprios
CREATE POLICY "Users can view own services" ON services
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own services" ON services
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own services" ON services
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own services" ON services
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Função RPC: incrementar uso de refinamentos IA
CREATE OR REPLACE FUNCTION increment_ai_usage(user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Placeholder: lógica de contagem de refinamentos pode ser expandida
  RAISE NOTICE 'AI usage incremented for user %', user_id;
END;
$$ LANGUAGE plpgsql;

-- 8. View pública de orçamentos (para aprovação online)
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
