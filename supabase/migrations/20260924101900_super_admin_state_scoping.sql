-- ============================================================
-- Super admin role + state-scoping support
-- Supports the backend state authorization boundary:
--   super_admin        -> all states (users.state_id IS NULL)
--   administrator      -> assigned state only (users.state_id = <id>)
--
-- The backend enforces this with the service-role key, so RLS is
-- NOT the enforcement point. This change only adds the role and
-- the supporting index.
-- ============================================================

-- 1. The super_admin role.
--    Appended last on purpose: application code resolves roles by
--    name, but some legacy paths depend on positional role ids.
INSERT INTO roles (name, description)
VALUES ('super_admin', 'Agency staff with administrative access to all states')
ON CONFLICT (name) DO NOTHING;

-- 2. Index documents(state_id).
--    Every admin document query now filters on this column.
CREATE INDEX IF NOT EXISTS idx_documents_state ON documents(state_id);

-- The seeded administrator is created as a super_admin directly by
-- supabase/seeds/01_core.sql, so there is no promotion step here.
-- Deploying this migration against a database whose admin is still an
-- unscoped administrator requires that promotion, which is left to
-- the ROLLOUT CHECK below.

-- ============================================================
-- ROLLOUT CHECK (run manually after applying)
-- ============================================================
-- Any OTHER row that is an administrator with state_id IS NULL will be
-- denied all admin access (fail-closed). Find them before deploying:
--
--   SELECT u.id, u.email
--   FROM users u
--   JOIN roles r ON r.id = u.role_id
--   WHERE r.name = 'administrator' AND u.state_id IS NULL;
--
-- Fix by assigning a state, or promoting to super_admin:
--
--   UPDATE users SET state_id = 2 WHERE id = '<uuid>';
--   UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'super_admin')
--    WHERE id = '<uuid>';
-- ============================================================
