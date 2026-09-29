-- ============================================================
-- Caregiver portal gaps
--  1. E-signature fields on caregiver_applications (drawn canvas signature)
--  2. notifications.reference_id -> idempotent credential reminders
--  3. announcements table (admin broadcast, in-app only)
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

CREATE INDEX IF NOT EXISTS idx_announcements_active_audience ON announcements(is_active, audience);
CREATE INDEX IF NOT EXISTS idx_announcements_state          ON announcements(state_id);

DROP TRIGGER IF EXISTS announcements_updated_at ON announcements;
CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED DATA
-- ============================================================
-- The "Other" catch-all document type and the per-state
-- document_requirements matrix are rows in tables that only exist
-- once states and document_types have been seeded, so they are
-- seed data, not schema:
--   supabase/seeds/01_core.sql
--   supabase/seeds/02_document_requirements.sql
