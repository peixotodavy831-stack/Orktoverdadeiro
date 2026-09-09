-- Remove a leitura anônima dos slugs. O acesso público ocorre exclusivamente
-- pelos endpoints do servidor, que usam a service role e validam expiração.

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Proposta pode ser lida por slug" ON proposals;
DROP POLICY IF EXISTS "Public can read proposals" ON proposals;

CREATE POLICY "Dono pode ler propostas"
  ON proposals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Dono pode excluir propostas" ON proposals;
CREATE POLICY "Dono pode excluir propostas"
  ON proposals FOR DELETE
  USING (auth.uid() = user_id);
