-- ============================================================
-- Caregiver Platform — Initial Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- Auto-update trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STATES
-- ============================================================
CREATE TABLE IF NOT EXISTS states (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(2)  NOT NULL UNIQUE,
  name        VARCHAR(50) NOT NULL UNIQUE,
  slug        VARCHAR(50) NOT NULL UNIQUE,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER states_updated_at
  BEFORE UPDATE ON states
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE states ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL UNIQUE,
  role_id     INTEGER     NOT NULL REFERENCES roles(id),
  state_id    INTEGER     REFERENCES states(id),
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_role_id  ON users(role_id);
CREATE INDEX idx_users_state_id ON users(state_id);
CREATE INDEX idx_users_status   ON users(status);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- WEBSITE CONTENT
-- ============================================================
CREATE TABLE IF NOT EXISTS website_content (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id    INTEGER     NOT NULL REFERENCES states(id),
  section     VARCHAR(50) NOT NULL,
  key         VARCHAR(100) NOT NULL,
  value       TEXT,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (state_id, section, key)
);

CREATE INDEX idx_website_content_state ON website_content(state_id);

CREATE TRIGGER website_content_updated_at
  BEFORE UPDATE ON website_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE website_content ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id    INTEGER     NOT NULL REFERENCES states(id),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_state ON services(state_id);

CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FORMS
-- ============================================================
CREATE TABLE IF NOT EXISTS forms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id    INTEGER     NOT NULL REFERENCES states(id),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  file_url    TEXT,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forms_state ON forms(state_id);

CREATE TRIGGER forms_updated_at
  BEFORE UPDATE ON forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE forms ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- LICENSING INFORMATION
-- ============================================================
CREATE TABLE IF NOT EXISTS licensing_info (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id    INTEGER     NOT NULL REFERENCES states(id),
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_licensing_state ON licensing_info(state_id);

CREATE TRIGGER licensing_info_updated_at
  BEFORE UPDATE ON licensing_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE licensing_info ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DOCUMENT TYPES
-- ============================================================
CREATE TABLE IF NOT EXISTS document_types (
  id          SERIAL      PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  for_role    VARCHAR(20) NOT NULL CHECK (for_role IN ('caregiver', 'client', 'both')),
  requires_expiration BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DOCUMENT REQUIREMENTS (per state)
-- ============================================================
CREATE TABLE IF NOT EXISTS document_requirements (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id         INTEGER NOT NULL REFERENCES states(id),
  document_type_id INTEGER NOT NULL REFERENCES document_types(id),
  required         BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (state_id, document_type_id)
);

CREATE INDEX idx_doc_req_state ON document_requirements(state_id);

CREATE TRIGGER document_requirements_updated_at
  BEFORE UPDATE ON document_requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE document_requirements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CAREGIVERS
-- ============================================================
CREATE TABLE IF NOT EXISTS caregivers (
  id            UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state_id      INTEGER     NOT NULL REFERENCES states(id),
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  phone         VARCHAR(20),
  address       TEXT,
  date_of_birth DATE,
  ssn_last4     VARCHAR(4),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_caregivers_state ON caregivers(state_id);

CREATE TRIGGER caregivers_updated_at
  BEFORE UPDATE ON caregivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE caregivers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CAREGIVER APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS caregiver_applications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID        NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  state_id     INTEGER     NOT NULL REFERENCES states(id),
  status       VARCHAR(20) NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','submitted','under_review','approved','rejected','onboarding')),
  submitted_at TIMESTAMPTZ,
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  UUID        REFERENCES users(id),
  notes        TEXT,
  rejection_reason TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_applications_caregiver ON caregiver_applications(caregiver_id);
CREATE INDEX idx_applications_state     ON caregiver_applications(state_id);
CREATE INDEX idx_applications_status    ON caregiver_applications(status);

CREATE TRIGGER caregiver_applications_updated_at
  BEFORE UPDATE ON caregiver_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE caregiver_applications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type_id INTEGER     NOT NULL REFERENCES document_types(id),
  state_id         INTEGER     REFERENCES states(id),
  storage_path     TEXT        NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending_review'
                     CHECK (status IN ('pending_review','approved','rejected','expired')),
  expiration_date  DATE,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID        REFERENCES users(id),
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_owner        ON documents(owner_id);
CREATE INDEX idx_documents_type         ON documents(document_type_id);
CREATE INDEX idx_documents_status       ON documents(status);
CREATE INDEX idx_documents_expiration   ON documents(expiration_date);

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id              UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state_id        INTEGER     NOT NULL REFERENCES states(id),
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  date_of_birth   DATE,
  phone           VARCHAR(20),
  address         TEXT,
  medicaid_number VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_state ON clients(state_id);

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CLIENT REFERRALS
-- ============================================================
CREATE TABLE IF NOT EXISTS client_referrals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id        INTEGER     NOT NULL REFERENCES states(id),
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  phone           VARCHAR(20),
  email           VARCHAR(255),
  referral_source VARCHAR(100),
  notes           TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','contacted','converted','closed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referrals_state  ON client_referrals(state_id);
CREATE INDEX idx_referrals_status ON client_referrals(status);

CREATE TRIGGER client_referrals_updated_at
  BEFORE UPDATE ON client_referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE client_referrals ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- AUTHORIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS authorizations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  state_id              INTEGER     NOT NULL REFERENCES states(id),
  authorization_number  VARCHAR(100) NOT NULL,
  start_date            DATE        NOT NULL,
  end_date              DATE        NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','active','expiring_soon','expired','rejected')),
  document_id           UUID        REFERENCES documents(id),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_client  ON authorizations(client_id);
CREATE INDEX idx_auth_state   ON authorizations(state_id);
CREATE INDEX idx_auth_status  ON authorizations(status);
CREATE INDEX idx_auth_end     ON authorizations(end_date);

CREATE TRIGGER authorizations_updated_at
  BEFORE UPDATE ON authorizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE authorizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRAINING COURSES
-- ============================================================
CREATE TABLE IF NOT EXISTS training_courses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id    INTEGER     REFERENCES states(id),
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  duration_hours DECIMAL(5,2),
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_courses_state ON training_courses(state_id);

CREATE TRIGGER training_courses_updated_at
  BEFORE UPDATE ON training_courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE training_courses ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRAINING ENROLLMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS training_enrollments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID        NOT NULL REFERENCES training_courses(id),
  caregiver_id UUID        NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'not_started'
                 CHECK (status IN ('not_started','in_progress','completed')),
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, caregiver_id)
);

CREATE INDEX idx_enrollments_caregiver ON training_enrollments(caregiver_id);
CREATE INDEX idx_enrollments_course    ON training_enrollments(course_id);
CREATE INDEX idx_enrollments_status    ON training_enrollments(status);

CREATE TRIGGER training_enrollments_updated_at
  BEFORE UPDATE ON training_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE training_enrollments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  read        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  table_name  VARCHAR(100),
  record_id   TEXT,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user       ON audit_logs(user_id);
CREATE INDEX idx_audit_table      ON audit_logs(table_name);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- JOB POSTINGS (Careers per state)
-- ============================================================
CREATE TABLE IF NOT EXISTS job_postings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id     INTEGER     NOT NULL REFERENCES states(id),
  title        VARCHAR(200) NOT NULL,
  job_type     VARCHAR(100) NOT NULL,
  compensation VARCHAR(100) NOT NULL,
  requirements TEXT,
  description  TEXT,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_postings_state  ON job_postings(state_id);
CREATE INDEX idx_job_postings_active ON job_postings(active);

CREATE TRIGGER job_postings_updated_at
  BEFORE UPDATE ON job_postings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;

