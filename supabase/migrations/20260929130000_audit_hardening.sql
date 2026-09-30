-- Migration: Audit trail hardening, IP/UserAgent/RequestId, and agreement/application versioning & hashing
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS entity_state_id INTEGER REFERENCES states(id);

CREATE INDEX IF NOT EXISTS idx_audit_state ON audit_logs(entity_state_id) WHERE entity_state_id IS NOT NULL;

ALTER TABLE caregiver_applications
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE client_agreements
  ADD COLUMN IF NOT EXISTS content_hash TEXT;
