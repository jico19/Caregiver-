-- ============================================================
-- Job postings table + public read policy
--
-- The nine career rows are seed data, not schema, and live in
-- supabase/seeds/01_core.sql. Migrations run before seeds on a
-- fresh `supabase db reset`, so seeding them here would have
-- inserted nothing on a clean database.
-- ============================================================

CREATE TABLE IF NOT EXISTS job_postings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id     INTEGER NOT NULL REFERENCES states(id),
  title        VARCHAR(200) NOT NULL,
  job_type     VARCHAR(100) NOT NULL,
  compensation VARCHAR(100) NOT NULL,
  requirements TEXT,
  description  TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_postings_state ON job_postings(state_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_active ON job_postings(active);

DROP TRIGGER IF EXISTS job_postings_updated_at ON job_postings;
CREATE TRIGGER job_postings_updated_at
  BEFORE UPDATE ON job_postings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_postings' AND policyname = 'Allow public read active job postings'
  ) THEN
    CREATE POLICY "Allow public read active job postings"
      ON job_postings
      FOR SELECT
      USING (active = TRUE);
  END IF;
END $$;

-- ============================================================
-- SEED DATA
-- ============================================================
-- The nine state-specific postings are inserted by
-- supabase/seeds/01_core.sql. Only the uniqueness constraint they
-- depend on belongs here.

-- Re-runnability guard. The seed has no natural key of its own, so
-- without a uniqueness constraint a re-run silently appends a second
-- copy of all nine rows. Enforce one posting per (state, title) and
-- dedupe first, so a database that already ran an older copy of this
-- file ends up consistent.
DELETE FROM job_postings a
USING job_postings b
WHERE a.ctid > b.ctid
  AND a.state_id = b.state_id
  AND a.title = b.title;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_postings_state_title
  ON job_postings(state_id, title);

