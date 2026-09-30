-- ============================================================
-- Query Performance Indexes (Plan 011, section E)
--
-- Every list endpoint in the backend has the same shape:
--
--   WHERE state_id IN (...) AND deleted_at IS NULL
--     ORDER BY <timestamp> DESC
--     LIMIT 20 OFFSET n
--
-- The schema only ever had single-column indexes on the filter
-- columns, and none at all on two of the sort columns
-- (documents.uploaded_at, announcements.created_at). No
-- single-column index can serve that predicate, so Postgres
-- bitmap-scans on state_id and then sorts the entire matching
-- set to return 20 rows.
--
-- The indexes below are partial on `WHERE deleted_at IS NULL`,
-- which is exactly what active_only() in
-- backend/app/core/soft_delete.py emits. Partial keeps them
-- small and makes them immune to the soft-delete predicate
-- being re-checked at runtime.
--
-- Forward-only and re-runnable (CREATE INDEX IF NOT EXISTS),
-- per supabase/RUNBOOK.md. Verified against production on
-- 2026-09-29 at 41 total rows across all indexed tables, so
-- CREATE INDEX is effectively instant here. At agency data
-- volume these builds take a write lock; if that ever matters,
-- recreate this file with CREATE INDEX CONCURRENTLY, which
-- cannot run inside the transaction block `db push` wraps
-- migrations in.
--
-- NOT included, and why -- see plan 011 section E.2:
--   documents.reviewed_by, care_plans.created_by,
--   client_referrals.converted_client_id, deleted_by (x13)
--     Write-only columns. Never filtered, joined, or embedded
--     anywhere in backend/app, so an index would be pure write
--     cost. Postgres does not auto-index foreign keys, but a
--     FK that is only ever written does not need one.
--   authorizations.document_id
--     Read only as a primary key lookup (admin.py:1077
--     .eq("id", auth["document_id"])), never as a filter or a
--     join. Already served by the PK.
--   care_plans(client_id)
--     Already served by idx_care_plans_client_live from the
--     soft-deletion migration, which is already partial on
--     deleted_at IS NULL.
--   announcements(is_active, audience, state_id, created_at)
--     get_my_announcements (caregivers.py:701-719) applies its
--     audience and state predicates in Python AFTER limit(20)
--     and then returns items[:5], so it can return an empty
--     list while matching announcements exist. Indexing a query
--     that returns the wrong answer is premature; fix the
--     query first, then index it.
--   Any index for super_admin list paths
--     scope_query (dependencies.py:183-184) returns the query
--     untouched when the caller is unrestricted, so those
--     requests carry no state_id predicate at all. There is
--     nothing to index until the query changes. Recorded in
--     plan 011 section E.3 rather than papered over.
-- ============================================================


-- ============================================================
-- 1. State-scoped admin list indexes
--    (state_id, <sort col>) WHERE deleted_at IS NULL
-- ============================================================

-- admin.py:212-222  list_caregivers
CREATE INDEX IF NOT EXISTS idx_apps_state_created
  ON public.caregiver_applications (state_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- admin.py:529      list_admin_clients, default sort
CREATE INDEX IF NOT EXISTS idx_clients_state_created
  ON public.clients (state_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- admin.py:527      list_admin_clients, sort_by=service_start_date
-- Ascending, matching the route. A b-tree serves both
-- directions, so one index covers ascending and descending.
CREATE INDEX IF NOT EXISTS idx_clients_state_start
  ON public.clients (state_id, service_start_date)
  WHERE deleted_at IS NULL;

-- admin.py:426      list_admin_documents. uploaded_at had NO index.
CREATE INDEX IF NOT EXISTS idx_documents_state_uploaded
  ON public.documents (state_id, uploaded_at DESC)
  WHERE deleted_at IS NULL;

-- admin.py:934      list_admin_authorizations
CREATE INDEX IF NOT EXISTS idx_auth_state_created
  ON public.authorizations (state_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- admin.py:1361     list_admin_referrals
CREATE INDEX IF NOT EXISTS idx_referrals_state_created
  ON public.client_referrals (state_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- admin.py:1144     list_announcements. created_at had NO index.
CREATE INDEX IF NOT EXISTS idx_announcements_state_created
  ON public.announcements (state_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- admin_users.py:86 list_users
CREATE INDEX IF NOT EXISTS idx_users_state_created
  ON public.users (state_id, created_at DESC)
  WHERE deleted_at IS NULL;


-- ============================================================
-- 2. Owner- and client-scoped list indexes
-- ============================================================

-- document_service.py:49   get_user_documents
CREATE INDEX IF NOT EXISTS idx_documents_owner_uploaded
  ON public.documents (owner_id, uploaded_at DESC)
  WHERE deleted_at IS NULL;

-- clients.py:330           get_my_authorizations
CREATE INDEX IF NOT EXISTS idx_auth_client_end
  ON public.authorizations (client_id, end_date DESC)
  WHERE deleted_at IS NULL;

-- caregivers.py:542, clients.py:498  notification lists.
-- Also the supporting index for plan 011 section C.6, which
-- paginates these.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- training.py:66           get_my_enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_caregiver_enrolled
  ON public.training_enrollments (caregiver_id, enrolled_at DESC)
  WHERE deleted_at IS NULL;

-- admin.py:849             next sort_order for a schedule entry
CREATE INDEX IF NOT EXISTS idx_schedules_client_sort
  ON public.care_schedules (client_id, sort_order DESC)
  WHERE deleted_at IS NULL;

-- admin.py:703             _fetch_care_plan_with_activities
CREATE INDEX IF NOT EXISTS idx_activities_plan_sort
  ON public.care_plan_activities (care_plan_id, sort_order)
  WHERE deleted_at IS NULL;


-- ============================================================
-- 3. Foreign keys used as embedded joins
--    Not partial: these serve PostgREST LEFT JOINs and the
--    ON DELETE CASCADE parent check, neither of which can use
--    a partial index.
-- ============================================================

-- admin.py:322  users!caregiver_applications_reviewed_by_fkey
CREATE INDEX IF NOT EXISTS idx_applications_reviewed_by
  ON public.caregiver_applications (reviewed_by);

-- admin.py:1138 users!announcements_created_by_fkey
CREATE INDEX IF NOT EXISTS idx_announcements_created_by
  ON public.announcements (created_by);


-- ============================================================
-- Verify afterwards:
--
--   -- all 16 present
--   SELECT indexname FROM pg_indexes
--   WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
--   ORDER BY indexname;
--
--   -- and every one is partial on the soft-delete predicate
--   SELECT c.relname AS table, i.relname AS index, pg_get_expr(x.indpred, x.indrelid) AS predicate
--   FROM pg_index x
--   JOIN pg_class c ON c.oid = x.indrelid
--   JOIN pg_class i ON i.oid = x.indexrelid
--   WHERE c.relname IN ('caregiver_applications','clients','documents',
--                       'authorizations','client_referrals','announcements',
--                       'users','notifications','training_enrollments',
--                       'care_schedules','care_plan_activities')
--     AND i.relname IN ('idx_apps_state_created','idx_clients_state_created',
--                       'idx_clients_state_start','idx_documents_state_uploaded',
--                       'idx_auth_state_created','idx_referrals_state_created',
--                       'idx_announcements_state_created','idx_users_state_created',
--                       'idx_documents_owner_uploaded','idx_auth_client_end',
--                       'idx_notifications_user_created','idx_enrollments_caregiver_enrolled',
--                       'idx_schedules_client_sort','idx_activities_plan_sort')
--   ORDER BY c.relname;
--
--   -- did the two previously unindexed sort columns land?
--   SELECT tablename, indexname FROM pg_indexes
--   WHERE indexname IN ('idx_documents_state_uploaded',
--                       'idx_announcements_state_created');
--
--   -- the plan is used and no sort survives to the LIMIT.
--   -- At 41 rows Postgres will still prefer a seq scan, which
--   -- is correct; force the comparison to see the index serve
--   -- the ORDER BY:
--   EXPLAIN (COSTS OFF)
--   SELECT id FROM caregiver_applications
--   WHERE state_id = 1 AND deleted_at IS NULL
--   ORDER BY created_at DESC LIMIT 20;
--
--   EXPLAIN (COSTS OFF)
--   SET enable_seqscan = off;
--   SELECT id FROM caregiver_applications
--   WHERE state_id = 1 AND deleted_at IS NULL
--   ORDER BY created_at DESC LIMIT 20;
--   -- expect: Index Scan using idx_apps_state_created
--   -- and NO "Sort" node above the Limit.
-- ============================================================
