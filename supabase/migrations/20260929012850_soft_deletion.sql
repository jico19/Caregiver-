-- ============================================================
-- Soft deletion (Plan 001)
--  1. deleted_at / deleted_by on soft-deletable tables
--  2. partial unique indexes so a soft-deleted row does not
--     block a legitimate re-create
--  3. RLS rewritten so soft-deleted rows are invisible to
--     anon/authenticated, and hard DELETE is revoked from
--     those roles (service_role still bypasses RLS, but the
--     canonical delete policy documents intent and stops a
--     future client-side supabase-js client from hard deleting)
--
-- Excluded on purpose: audit_logs and client_agreements are
-- immutable evidence and never gain these columns.
-- ============================================================

-- 1. Columns ----------------------------------------------------
-- IF NOT EXISTS keeps this re-runnable; ADD COLUMN with a
-- volatile default is safe here because the default is NULL,
-- which Postgres does not rewrite.
DO $$
DECLARE
  t text;
  targets text[] := ARRAY[
    'users', 'caregivers', 'clients', 'caregiver_applications',
    'documents', 'notifications', 'training_enrollments',
    'care_plans', 'care_plan_activities', 'care_schedules',
    'authorizations', 'announcements', 'client_referrals'
  ];
BEGIN
  FOREACH t IN ARRAY targets LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.users(id)', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (deleted_at)', 'idx_' || t || '_deleted_at', t);
  END LOOP;
END $$;

-- 2. Partial unique indexes ------------------------------------
-- A plain UNIQUE constraint counts soft-deleted rows, so
-- after a delete the identifier could never be reused. The
-- verified conflicting constraints are:
--   users.email                              (initial_schema)
--   training_enrollments(course_id,caregiver_id) (initial_schema)
--   care_plans(client_id)                    (20260924101800)
-- NOTE: documents has NO unique constraint on
-- (owner_id, document_type_id) in the real schema, so
-- re-uploading a document after a soft delete already works
-- and needs no index here.

-- users.email: drop the constraint backing the index, if any,
-- then add a partial unique index over live rows only.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_live
  ON public.users (lower(email))
  WHERE deleted_at IS NULL;

ALTER TABLE public.training_enrollments
  DROP CONSTRAINT IF EXISTS training_enrollments_course_id_caregiver_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_course_caregiver_live
  ON public.training_enrollments (course_id, caregiver_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.care_plans DROP CONSTRAINT IF EXISTS care_plans_client_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_care_plans_client_live
  ON public.care_plans (client_id)
  WHERE deleted_at IS NULL;

-- 3. RLS --------------------------------------------------------
-- SELECT policies gain "AND deleted_at IS NULL".
-- INSERT policies gain "AND deleted_at IS NULL" in WITH CHECK
-- so a client cannot insert a row that is already deleted.
-- Hard DELETE is revoked from anon/authenticated; the backend
-- uses service_role and performs soft deletes via UPDATE.

REVOKE DELETE ON public.caregivers, public.clients,
    public.caregiver_applications, public.documents,
    public.notifications, public.training_enrollments,
    public.care_plans, public.care_plan_activities,
    public.care_schedules, public.authorizations,
    public.announcements, public.client_referrals
  FROM anon, authenticated;

REVOKE DELETE ON public.care_plans, public.care_plan_activities,
    public.care_schedules
  FROM authenticated;

DROP POLICY IF EXISTS "p_users_select" ON public.users;
CREATE POLICY "p_users_select"
  ON public.users FOR SELECT
  TO authenticated
  USING ((id = auth.uid() OR app_has_role('administrator')) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_users_insert" ON public.users;
CREATE POLICY "p_users_insert"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_caregivers_select" ON public.caregivers;
CREATE POLICY "p_caregivers_select"
  ON public.caregivers FOR SELECT
  TO authenticated
  USING ((id = auth.uid() OR app_has_role('administrator')) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_caregivers_insert" ON public.caregivers;
CREATE POLICY "p_caregivers_insert"
  ON public.caregivers FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_clients_select" ON public.clients;
CREATE POLICY "p_clients_select"
  ON public.clients FOR SELECT
  TO authenticated
  USING ((id = auth.uid() OR app_has_role('administrator')) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_clients_insert" ON public.clients;
CREATE POLICY "p_clients_insert"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_applications_select" ON public.caregiver_applications;
CREATE POLICY "p_applications_select"
  ON public.caregiver_applications FOR SELECT
  TO authenticated
  USING ((caregiver_id = auth.uid() OR app_has_role('administrator')) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_applications_insert" ON public.caregiver_applications;
CREATE POLICY "p_applications_insert"
  ON public.caregiver_applications FOR INSERT
  TO authenticated
  WITH CHECK (caregiver_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_documents_select" ON public.documents;
CREATE POLICY "p_documents_select"
  ON public.documents FOR SELECT
  TO authenticated
  USING ((owner_id = auth.uid() OR app_has_role('administrator')) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_documents_insert" ON public.documents;
CREATE POLICY "p_documents_insert"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_notifications_select" ON public.notifications;
CREATE POLICY "p_notifications_select"
  ON public.notifications FOR SELECT
  TO authenticated
  USING ((user_id = auth.uid() OR app_has_role('administrator')) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_enrollments_select" ON public.training_enrollments;
CREATE POLICY "p_enrollments_select"
  ON public.training_enrollments FOR SELECT
  TO authenticated
  USING ((caregiver_id = auth.uid() OR app_has_role('administrator')) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_enrollments_insert" ON public.training_enrollments;
CREATE POLICY "p_enrollments_insert"
  ON public.training_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (caregiver_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_authorizations_select" ON public.authorizations;
CREATE POLICY "p_authorizations_select"
  ON public.authorizations FOR SELECT
  TO authenticated
  USING ((client_id = auth.uid() OR app_has_role('administrator')) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_announcements_read" ON public.announcements;
CREATE POLICY "p_announcements_read"
  ON public.announcements FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE AND deleted_at IS NULL);

-- Care plan surface (20260924101800). The activities policy
-- joins care_plans, so it must also exclude soft-deleted plans.
DROP POLICY IF EXISTS "p_care_plans_select" ON public.care_plans;
CREATE POLICY "p_care_plans_select"
  ON public.care_plans FOR SELECT
  TO authenticated
  USING ((client_id = auth.uid() OR app_has_role('administrator')) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_care_plans_write" ON public.care_plans;
CREATE POLICY "p_care_plans_write"
  ON public.care_plans FOR INSERT
  TO authenticated
  WITH CHECK (app_has_role('administrator') AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_care_plans_update" ON public.care_plans;
CREATE POLICY "p_care_plans_update"
  ON public.care_plans FOR UPDATE
  TO authenticated
  USING (app_has_role('administrator'))
  WITH CHECK (app_has_role('administrator'));

DROP POLICY IF EXISTS "p_care_plan_activities_select" ON public.care_plan_activities;
CREATE POLICY "p_care_plan_activities_select"
  ON public.care_plan_activities FOR SELECT
  TO authenticated
  USING (
    (
      care_plan_id IN (
        SELECT id FROM public.care_plans
        WHERE client_id = auth.uid() AND deleted_at IS NULL
      )
      OR app_has_role('administrator')
    )
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "p_care_plan_activities_write" ON public.care_plan_activities;
CREATE POLICY "p_care_plan_activities_write"
  ON public.care_plan_activities FOR INSERT
  TO authenticated
  WITH CHECK (app_has_role('administrator') AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_care_plan_activities_update" ON public.care_plan_activities;
CREATE POLICY "p_care_plan_activities_update"
  ON public.care_plan_activities FOR UPDATE
  TO authenticated
  USING (app_has_role('administrator'))
  WITH CHECK (app_has_role('administrator'));

DROP POLICY IF EXISTS "p_care_schedules_select" ON public.care_schedules;
CREATE POLICY "p_care_schedules_select"
  ON public.care_schedules FOR SELECT
  TO authenticated
  USING ((client_id = auth.uid() OR app_has_role('administrator')) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_care_schedules_write" ON public.care_schedules;
CREATE POLICY "p_care_schedules_write"
  ON public.care_schedules FOR INSERT
  TO authenticated
  WITH CHECK (app_has_role('administrator') AND deleted_at IS NULL);

DROP POLICY IF EXISTS "p_care_schedules_update" ON public.care_schedules;
CREATE POLICY "p_care_schedules_update"
  ON public.care_schedules FOR UPDATE
  TO authenticated
  USING (app_has_role('administrator'))
  WITH CHECK (app_has_role('administrator'));

-- ============================================================
-- Verify afterwards:
--   -- columns present on all 13 tables
--   SELECT table_name FROM information_schema.columns
--    WHERE column_name = 'deleted_at' ORDER BY table_name;
--   -- exactly 13 rows
--
--   -- no live duplicate users.email
--   SELECT lower(email) FROM users
--    WHERE deleted_at IS NULL
--    GROUP BY lower(email) HAVING count(*) > 1;
--
--   -- no hard DELETE left for anon/authenticated
--   SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
--    WHERE privilege_type = 'DELETE'
--      AND grantee IN ('anon','authenticated')
--      AND table_schema = 'public';
-- ============================================================
