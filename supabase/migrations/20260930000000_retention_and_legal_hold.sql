-- Migration: 20260930000000_retention_and_legal_hold.sql
-- Description: Add legal_hold flag for retention management and legal evidence immunity

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE caregivers
  ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_clients_legal_hold ON clients(legal_hold) WHERE legal_hold = TRUE;
CREATE INDEX IF NOT EXISTS idx_caregivers_legal_hold ON caregivers(legal_hold) WHERE legal_hold = TRUE;
CREATE INDEX IF NOT EXISTS idx_documents_legal_hold ON documents(legal_hold) WHERE legal_hold = TRUE;
