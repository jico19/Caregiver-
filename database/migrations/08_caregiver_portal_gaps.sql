-- ============================================================
-- Migration 08: Caregiver Portal SOW gaps
--  1. E-signature fields on caregiver_applications (drawn canvas signature)
--  2. notifications.reference_id -> idempotent credential reminders
--  3. announcements table (admin broadcast, in-app only)
--  4. "Other" catch-all document type (not required)
--  5. Seed document_requirements per state for the required caregiver types
-- ============================================================

-- 1. E-signature on caregiver applications
ALTER TABLE caregiver_applications
  ADD COLUMN IF NOT EXISTS signature_data TEXT,
  ADD COLUMN IF NOT EXISTS signed_name   VARCHAR(200),
  ADD COLUMN IF NOT EXISTS signed_at     TIMESTAMPTZ;

-- 2. notifications.reference_id for dedup (e.g. one reminder per expiring credential)
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS reference_id TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_user_type_reference
  ON notifications(user_id, type, reference_id);

-- 3. Announcements (admin broadcast, in-app only)
CREATE TABLE IF NOT EXISTS announcements (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      VARCHAR(200) NOT NULL,
  body       TEXT        NOT NULL,
  audience   VARCHAR(20) NOT NULL DEFAULT 'caregiver'
               CHECK (audience IN ('caregiver', 'client', 'all', 'administrator')),
  state_id   INTEGER     REFERENCES states(id),
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by UUID        REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcements_active_audience ON announcements(is_active, audience);
CREATE INDEX idx_announcements_state          ON announcements(state_id);

CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 4. "Other" catch-all document type (optional, no expiry)
INSERT INTO document_types (name, for_role, requires_expiration)
VALUES ('Other', 'caregiver', FALSE)
ON CONFLICT (name) DO NOTHING;

-- 5. Seed document_requirements for every state: all caregiver types except "Other"
INSERT INTO document_requirements (state_id, document_type_id, required)
SELECT s.id, dt.id, TRUE
FROM states s
JOIN document_types dt
  ON dt.for_role = 'caregiver'
 AND dt.name <> 'Other'
ON CONFLICT (state_id, document_type_id) DO NOTHING;