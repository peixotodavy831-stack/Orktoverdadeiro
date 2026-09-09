-- ORKTO — Tabela de Propostas (links compartilháveis)

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

CREATE INDEX IF NOT EXISTS idx_proposals_slug ON proposals(slug);
CREATE INDEX IF NOT EXISTS idx_proposals_quote_id ON proposals(quote_id);
CREATE INDEX IF NOT EXISTS idx_proposals_user_id ON proposals(user_id);

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Proposta pode ser lida por slug" ON proposals;
CREATE POLICY "Proposta pode ser lida por slug"
  ON proposals FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Profissional cria proposta" ON proposals;
CREATE POLICY "Profissional cria proposta"
  ON proposals FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Profissional atualiza proposta" ON proposals;
CREATE POLICY "Profissional atualiza proposta"
  ON proposals FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION deactivate_expired_proposals()
RETURNS void AS $$
BEGIN
  UPDATE proposals SET is_active = false WHERE expires_at < now() AND is_active = true;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_proposal_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at < now() THEN
    NEW.is_active = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_proposal_expiry ON proposals;
CREATE TRIGGER trg_check_proposal_expiry
  BEFORE INSERT OR UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION check_proposal_expiry();
