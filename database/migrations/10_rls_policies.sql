-- ============================================================
-- Migration 10: RLS policies matching the application access model
--
-- All application traffic flows through the FastAPI backend using the
-- service-role client, which bypasses RLS. These policies are defense in
-- depth: they grant `anon`/`authenticated` (the Data API roles) the same
-- access the backend grants through FastAPI, so that if service_role were
-- ever exposed or a client-side Supabase client were added, row access is
-- still bounded to the caller's own records (or admin).
--
-- Run in Supabase SQL Editor. Re-runnable.
-- ============================================================

-- ============================================================
-- Helper: is the current caller an active administrator?
-- SECURITY INVOKER (not DEFINER — no RLS bypass). It only reads the
-- caller's OWN row in `users`, which the users SELECT policy allows.
-- ============================================================
CREATE OR REPLACE FUNCTION public.app_has_role(required text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = auth.uid()
      AND r.name = required
      AND u.status = 'active'
  );
$$;

-- ============================================================
-- GRANTS
-- Publicly readable (anon + authenticated)
-- ============================================================
GRANT SELECT ON states, services, forms, licensing_info,
    website_content, training_courses, document_types, roles
  TO anon, authenticated;

-- Authenticated gets its own-row read/write surface
GRANT SELECT, INSERT, UPDATE ON
    users, caregivers, clients, caregiver_applications,
    documents, notifications, training_enrollments
  TO authenticated;

-- Read-mostly surfaces for the signed-in user, admin management via backend
GRANT SELECT ON
    document_requirements, authorizations, announcements
  TO authenticated;

-- ============================================================
-- PUBLIC READ POLICY helpers (content tables)
-- ============================================================
DROP POLICY IF EXISTS "p_states_public_read" ON states;
CREATE POLICY "p_states_public_read"
  ON states FOR SELECT
  TO anon, authenticated
  USING (active = TRUE);

DROP POLICY IF EXISTS "p_services_public_read" ON services;
CREATE POLICY "p_services_public_read"
  ON services FOR SELECT
  TO anon, authenticated
  USING (active = TRUE);

DROP POLICY IF EXISTS "p_forms_public_read" ON forms;
CREATE POLICY "p_forms_public_read"
  ON forms FOR SELECT
  TO anon, authenticated
  USING (active = TRUE);

DROP POLICY IF EXISTS "p_licensing_public_read" ON licensing_info;
CREATE POLICY "p_licensing_public_read"
  ON licensing_info FOR SELECT
  TO anon, authenticated
  USING (active = TRUE);

DROP POLICY IF EXISTS "p_website_content_public_read" ON website_content;
CREATE POLICY "p_website_content_public_read"
  ON website_content FOR SELECT
  TO anon, authenticated
  USING (active = TRUE);

DROP POLICY IF EXISTS "p_training_courses_public_read" ON training_courses;
CREATE POLICY "p_training_courses_public_read"
  ON training_courses FOR SELECT
  TO anon, authenticated
  USING (active = TRUE);

DROP POLICY IF EXISTS "p_document_types_public_read" ON document_types;
CREATE POLICY "p_document_types_public_read"
  ON document_types FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "p_roles_public_read" ON roles;
CREATE POLICY "p_roles_public_read"
  ON roles FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- job_postings already has "Allow public read active job postings" (06).

-- ============================================================
-- AUTHENTICATED, OWNERSHIP-BOUND POLICIES
-- Owner reads/writes their own rows; administrators read/write all rows.
-- ============================================================

-- users: own row only (+ admin)
DROP POLICY IF EXISTS "p_users_select" ON users;
CREATE POLICY "p_users_select"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR app_has_role('administrator'));

DROP POLICY IF EXISTS "p_users_insert" ON users;
CREATE POLICY "p_users_insert"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "p_users_update" ON users;
CREATE POLICY "p_users_update"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR app_has_role('administrator'))
  WITH CHECK (id = auth.uid() OR app_has_role('administrator'));

-- caregivers: id doubles as the owning auth.users id
DROP POLICY IF EXISTS "p_caregivers_select" ON caregivers;
CREATE POLICY "p_caregivers_select"
  ON caregivers FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR app_has_role('administrator'));

DROP POLICY IF EXISTS "p_caregivers_insert" ON caregivers;
CREATE POLICY "p_caregivers_insert"
  ON caregivers FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "p_caregivers_update" ON caregivers;
CREATE POLICY "p_caregivers_update"
  ON caregivers FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR app_has_role('administrator'))
  WITH CHECK (id = auth.uid() OR app_has_role('administrator'));

-- clients
DROP POLICY IF EXISTS "p_clients_select" ON clients;
CREATE POLICY "p_clients_select"
  ON clients FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR app_has_role('administrator'));

DROP POLICY IF EXISTS "p_clients_insert" ON clients;
CREATE POLICY "p_clients_insert"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "p_clients_update" ON clients;
CREATE POLICY "p_clients_update"
  ON clients FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR app_has_role('administrator'))
  WITH CHECK (id = auth.uid() OR app_has_role('administrator'));

-- caregiver_applications
DROP POLICY IF EXISTS "p_applications_select" ON caregiver_applications;
CREATE POLICY "p_applications_select"
  ON caregiver_applications FOR SELECT
  TO authenticated
  USING (caregiver_id = auth.uid() OR app_has_role('administrator'));

DROP POLICY IF EXISTS "p_applications_insert" ON caregiver_applications;
CREATE POLICY "p_applications_insert"
  ON caregiver_applications FOR INSERT
  TO authenticated
  WITH CHECK (caregiver_id = auth.uid());

DROP POLICY IF EXISTS "p_applications_update" ON caregiver_applications;
CREATE POLICY "p_applications_update"
  ON caregiver_applications FOR UPDATE
  TO authenticated
  USING (caregiver_id = auth.uid() OR app_has_role('administrator'))
  WITH CHECK (caregiver_id = auth.uid() OR app_has_role('administrator'));

-- documents
DROP POLICY IF EXISTS "p_documents_select" ON documents;
CREATE POLICY "p_documents_select"
  ON documents FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR app_has_role('administrator'));

DROP POLICY IF EXISTS "p_documents_insert" ON documents;
CREATE POLICY "p_documents_insert"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "p_documents_update" ON documents;
CREATE POLICY "p_documents_update"
  ON documents FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR app_has_role('administrator'))
  WITH CHECK (owner_id = auth.uid() OR app_has_role('administrator'));

-- notifications
DROP POLICY IF EXISTS "p_notifications_select" ON notifications;
CREATE POLICY "p_notifications_select"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR app_has_role('administrator'));

DROP POLICY IF EXISTS "p_notifications_update" ON notifications;
CREATE POLICY "p_notifications_update"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR app_has_role('administrator'))
  WITH CHECK (user_id = auth.uid() OR app_has_role('administrator'));

-- training_enrollments
DROP POLICY IF EXISTS "p_enrollments_select" ON training_enrollments;
CREATE POLICY "p_enrollments_select"
  ON training_enrollments FOR SELECT
  TO authenticated
  USING (caregiver_id = auth.uid() OR app_has_role('administrator'));

DROP POLICY IF EXISTS "p_enrollments_insert" ON training_enrollments;
CREATE POLICY "p_enrollments_insert"
  ON training_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (caregiver_id = auth.uid());

DROP POLICY IF EXISTS "p_enrollments_update" ON training_enrollments;
CREATE POLICY "p_enrollments_update"
  ON training_enrollments FOR UPDATE
  TO authenticated
  USING (caregiver_id = auth.uid() OR app_has_role('administrator'))
  WITH CHECK (caregiver_id = auth.uid() OR app_has_role('administrator'));

-- ============================================================
-- ADMIN-ONLY TABLES
-- ============================================================

-- document_requirements: internal per-state matrix (readable to users,
-- write/administration via backend service role)
DROP POLICY IF EXISTS "p_document_requirements_read" ON document_requirements;
CREATE POLICY "p_document_requirements_read"
  ON document_requirements FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "p_document_requirements_write" ON document_requirements;
CREATE POLICY "p_document_requirements_write"
  ON document_requirements FOR ALL
  TO authenticated
  USING (app_has_role('administrator'))
  WITH CHECK (app_has_role('administrator'));

-- authorizations: clients read their own; administration via backend
DROP POLICY IF EXISTS "p_authorizations_select" ON authorizations;
CREATE POLICY "p_authorizations_select"
  ON authorizations FOR SELECT
  TO authenticated
  USING (client_id = auth.uid() OR app_has_role('administrator'));

DROP POLICY IF EXISTS "p_authorizations_write" ON authorizations;
CREATE POLICY "p_authorizations_write"
  ON authorizations FOR ALL
  TO authenticated
  USING (app_has_role('administrator'))
  WITH CHECK (app_has_role('administrator'));

-- announcements: signed-in users read active ones; admins manage
DROP POLICY IF EXISTS "p_announcements_read" ON announcements;
CREATE POLICY "p_announcements_read"
  ON announcements FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "p_announcements_write" ON announcements;
CREATE POLICY "p_announcements_write"
  ON announcements FOR ALL
  TO authenticated
  USING (app_has_role('administrator'))
  WITH CHECK (app_has_role('administrator'));

-- client_referrals / audit_logs: staff-only (no anon/authenticated policies;
-- backend service role performs inserts/reads).

-- ============================================================
-- Verify afterwards:
--   SELECT tablename, policyname FROM pg_policies
--    WHERE schemaname = 'public' ORDER BY tablename;
-- ============================================================