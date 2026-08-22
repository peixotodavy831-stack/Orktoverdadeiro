-- =============================================
-- ORKTO — Tabela de Propostas (links compartilháveis)
-- Cada proposta tem um slug de 8 caracteres, seguro e curto
-- =============================================

CREATE TABLE IF NOT EXISTS proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug VARCHAR(8) NOT NULL UNIQUE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
  is_active BOOLEAN DEFAULT true,
  viewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_proposals_slug ON proposals(slug);
CREATE INDEX IF NOT EXISTS idx_proposals_quote_id ON proposals(quote_id);
CREATE INDEX IF NOT EXISTS idx_proposals_user_id ON proposals(user_id);

-- RLS
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa com o slug pode ler (público, sem auth)
CREATE POLICY "Proposta pode ser lida por slug"
  ON proposals FOR SELECT USING (true);

-- Só o dono (profissional) pode criar propostas
CREATE POLICY "Profissional cria proposta"
  ON proposals FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Só o dono pode atualizar (regenerar slug, marcar visualizado)
CREATE POLICY "Profissional atualiza proposta"
  ON proposals FOR UPDATE USING (auth.uid() = user_id);

-- Função para invalidar propostas expiradas
CREATE OR REPLACE FUNCTION deactivate_expired_proposals()
RETURNS void AS $$
BEGIN
  UPDATE proposals SET is_active = false WHERE expires_at < now() AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-invalidar propostas expiradas ao acessar
CREATE OR REPLACE FUNCTION check_proposal_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at < now() THEN
    NEW.is_active = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_proposal_expiry
  BEFORE SELECT ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION check_proposal_expiry();
