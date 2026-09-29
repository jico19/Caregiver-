-- ============================================================
-- DB-backed care plan & schedule (Iteration 2)
--  1. care_plans / care_plan_activities / care_schedules tables
--  2. RLS (staff-only writes, client own-row reads) per the RLS policy pattern
-- ============================================================

-- 1. Tables ----------------------------------------------------
CREATE TABLE IF NOT EXISTS care_plans (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state_id           INTEGER     REFERENCES states(id),
  status             VARCHAR(20) NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'pending', 'inactive')),
  effective_date     DATE,
  primary_nurse      VARCHAR(200),
  emergency_protocol TEXT,
  created_by         UUID        REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id)
);

CREATE INDEX IF NOT EXISTS idx_care_plans_client ON care_plans(client_id);

CREATE TABLE IF NOT EXISTS care_plan_activities (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id  UUID        NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  task          VARCHAR(200) NOT NULL,
  frequency     VARCHAR(100),
  notes         TEXT,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_plan_activities_plan ON care_plan_activities(care_plan_id);

CREATE TABLE IF NOT EXISTS care_schedules (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state_id     INTEGER     REFERENCES states(id),
  day_of_week  VARCHAR(20) NOT NULL,
  start_time   TIME        NOT NULL,
  end_time     TIME        NOT NULL,
  service      VARCHAR(200),
  status       VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  notes        TEXT,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_schedules_client ON care_schedules(client_id);

-- 2. RLS (defense in depth; backend service role bypasses RLS) --
GRANT SELECT, INSERT, UPDATE, DELETE ON
    care_plans, care_plan_activities, care_schedules
  TO authenticated;

-- Care plans: client reads own, administrator manages
DROP POLICY IF EXISTS "p_care_plans_select" ON care_plans;
CREATE POLICY "p_care_plans_select"
  ON care_plans FOR SELECT
  TO authenticated
  USING (client_id = auth.uid() OR app_has_role('administrator'));

DROP POLICY IF EXISTS "p_care_plans_write" ON care_plans;
CREATE POLICY "p_care_plans_write"
  ON care_plans FOR ALL
  TO authenticated
  USING (app_has_role('administrator'))
  WITH CHECK (app_has_role('administrator'));

-- Activities: readable with the plan (own client), administered by staff
DROP POLICY IF EXISTS "p_care_plan_activities_select" ON care_plan_activities;
CREATE POLICY "p_care_plan_activities_select"
  ON care_plan_activities FOR SELECT
  TO authenticated
  USING (care_plan_id IN (
      SELECT id FROM care_plans WHERE client_id = auth.uid()
    ) OR app_has_role('administrator'));

DROP POLICY IF EXISTS "p_care_plan_activities_write" ON care_plan_activities;
CREATE POLICY "p_care_plan_activities_write"
  ON care_plan_activities FOR ALL
  TO authenticated
  USING (app_has_role('administrator'))
  WITH CHECK (app_has_role('administrator'));

-- Schedules: client reads own, administrator manages
DROP POLICY IF EXISTS "p_care_schedules_select" ON care_schedules;
CREATE POLICY "p_care_schedules_select"
  ON care_schedules FOR SELECT
  TO authenticated
  USING (client_id = auth.uid() OR app_has_role('administrator'));

DROP POLICY IF EXISTS "p_care_schedules_write" ON care_schedules;
CREATE POLICY "p_care_schedules_write"
  ON care_schedules FOR ALL
  TO authenticated
  USING (app_has_role('administrator'))
  WITH CHECK (app_has_role('administrator'));

-- ============================================================
-- SEED DATA
-- ============================================================
-- Demo care plans and schedules for the seeded clients (Eleanor Vance FL,
-- Thomas Sterling IN) are seed data: they reference rows created by
-- supabase/seeds/01_core.sql, and migrations run before seeds on a fresh
-- `supabase db reset`. They live in supabase/seeds/03_care_plan_demo.sql.
