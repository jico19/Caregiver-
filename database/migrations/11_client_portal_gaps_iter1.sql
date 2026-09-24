-- ============================================================
-- Migration 11: Client Portal SOW gaps — Iteration 1
--  1. clients signature columns (intake consent e-signature)
--  2. client_agreements table (care agreement / client rights e-sign)
--  3. authorizations: source + review columns (client self-service uploads)
-- Re-runnable. Run in Supabase SQL Editor after 10_.
-- ============================================================

-- 1. Intake consent signature on clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS signature_data TEXT,
  ADD COLUMN IF NOT EXISTS signed_name   VARCHAR(200),
  ADD COLUMN IF NOT EXISTS signed_at     TIMESTAMPTZ;

-- 2. Electronically signed client agreements (care agreement, client rights, ...)
CREATE TABLE IF NOT EXISTS client_agreements (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state_id       INTEGER     REFERENCES states(id),
  agreement_key  VARCHAR(100) NOT NULL,
  title          VARCHAR(200) NOT NULL,
  version        INTEGER     NOT NULL DEFAULT 1,
  body           TEXT,
  signature_data TEXT,
  signed_name    VARCHAR(200),
  signed_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, agreement_key)
);

CREATE INDEX IF NOT EXISTS idx_client_agreements_client ON client_agreements(client_id);

CREATE TRIGGER client_agreements_updated_at
  BEFORE UPDATE ON client_agreements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE client_agreements ENABLE ROW LEVEL SECURITY;

-- 3. Authorization self-service tracking
ALTER TABLE authorizations
  ADD COLUMN IF NOT EXISTS source       VARCHAR(20) NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS reviewed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by  UUID REFERENCES users(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'authorizations_source_check'
  ) THEN
    ALTER TABLE authorizations
      ADD CONSTRAINT authorizations_source_check
      CHECK (source IN ('admin', 'client'));
  END IF;
END $$;

-- ============================================================
-- RLS (defense in depth; backend service role bypasses RLS)
-- client_agreements: own-row read/write for the client, admin override
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON client_agreements TO authenticated;

DROP POLICY IF EXISTS "p_client_agreements_select" ON client_agreements;
CREATE POLICY "p_client_agreements_select"
  ON client_agreements FOR SELECT
  TO authenticated
  USING (client_id = auth.uid() OR app_has_role('administrator'));

DROP POLICY IF EXISTS "p_client_agreements_insert" ON client_agreements;
CREATE POLICY "p_client_agreements_insert"
  ON client_agreements FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "p_client_agreements_update" ON client_agreements;
CREATE POLICY "p_client_agreements_update"
  ON client_agreements FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid() OR app_has_role('administrator'))
  WITH CHECK (client_id = auth.uid() OR app_has_role('administrator'));