# Database Migrations Log & Policy

Complete catalog of all database migrations in the Caregiver Platform, documenting purpose, schema evolution, and deployment policies.

---

## 1. Migration Operating Rules

All database modifications must adhere to the rules outlined in `AGENTS.md` and `supabase/RUNBOOK.md`:

1. **Forward-Only Migrations**: Applied migrations must never be altered or retroactively edited. Any adjustments must be authored in a new forward-only SQL migration file.
2. **No Local Database**: Local instances (`db start`, `db diff`) are not supported in this repository. All schema validations are conducted against remote instances using dry-run verification.
3. **Approval Required Before Push**: Never execute `npx supabase db push` without explicit user confirmation. Inspect and display `--dry-run` output prior to execution.
4. **Composite Index Standard**: Every new listing query must include a composite partial index following this pattern:
   ```sql
   CREATE INDEX idx_<table_name>_<sort_col>
     ON <table_name>(state_id, <sort_col>)
     WHERE deleted_at IS NULL;
   ```

---

## 2. Chronological Migrations Catalog

### Phase 1: Core Foundation & Initial Portals

#### `20260924101138_initial_schema.sql`
- **Applied**: Sept 24, 2026
- **Purpose**: Establishes initial database schema baseline.
- **Key Artifacts**:
  - `update_updated_at()` trigger function.
  - Multi-tenant foundations: `states`, `roles`, `users`.
  - Public CMS tables: `website_content`, `services`, `forms`, `licensing_info`, `job_postings`.
  - Core domain tables: `caregivers`, `caregiver_applications`, `clients`, `client_referrals`, `authorizations`.
  - Compliance tables: `document_types`, `document_requirements`, `documents`, `training_courses`, `training_enrollments`, `notifications`, `audit_logs`.
  - Enables RLS on all created tables.

#### `20260924101200_job_postings.sql`
- **Purpose**: Adds additional metadata and indexes for state-scoped career postings.

#### `20260924101300_application_rejection_reason.sql`
- **Purpose**: Adds `rejection_reason TEXT` to `caregiver_applications` to record administrative rationale for application denial.

#### `20260924101400_caregiver_portal_gaps.sql`
- **Purpose**: Addresses initial operational gaps in caregiver portal.
- **Modifications**:
  - Adds e-signature fields (`signature_data`, `signed_name`, `signed_at`) to `caregiver_applications`.
  - Adds `reference_id` to `notifications` for idempotent expiration alerts.
  - Creates `announcements` table for in-app staff broadcasts.

#### `20260924101500_documents_bucket.sql`
- **Purpose**: Configures the `documents` storage bucket in Supabase Storage for secure PDF and binary attachments.

#### `20260924101600_rls_policies.sql`
- **Purpose**: Establishes baseline client-side Row Level Security (RLS) rules restricting users to their own records (`auth.uid() = owner_id`).

#### `20260924101700_client_portal_gaps_iter1.sql`
- **Purpose**: Expands client portal capabilities.
- **Modifications**:
  - Adds intake consent signature columns to `clients`.
  - Creates `client_agreements` table for electronic signing of care agreements, HIPAA notices, and client rights.
  - Adds self-service tracking to `authorizations` (`source` enum: 'admin', 'client', and review metadata).

#### `20260924101800_care_plan_schedule.sql`
- **Purpose**: Implements database-backed clinical care plans and visit scheduling.
- **Modifications**:
  - Creates `care_plans` (primary nurse, effective dates, emergency protocols).
  - Creates `care_plan_activities` (ADL task definitions and frequencies).
  - Creates `care_schedules` (recurring weekly shift blocks and status).

#### `20260924101900_super_admin_state_scoping.sql`
- **Purpose**: Enforces strict privilege separation between `administrator` and `super_admin`.
- **Modifications**:
  - Restricts `users.state_id IS NULL` exclusively to the `super_admin` role.
  - Administrators without an assigned state are denied by default.

---

### Phase 2: Compliance, Soft Deletion & Staffing

#### `20260929012850_soft_deletion.sql`
- **Purpose**: Transitions 13 operational tables from hard deletes to audit-safe soft deletion.
- **Modifications**:
  - Adds `deleted_at TIMESTAMPTZ` and `deleted_by UUID REFERENCES users(id)` across operational tables.
  - Replaces raw unique constraints with partial unique indexes (e.g. `idx_users_email_live WHERE deleted_at IS NULL`).
  - Revokes hard `DELETE` privileges from authenticated users.

#### `20260929090000_client_admission_lifecycle.sql`
- **Purpose**: Implements formal client admission workflow.
- **Modifications**:
  - Adds `status` enum (`pending`, `approved`, `active`, `discharged`, `rejected`) to `clients`.
  - Adds `service_start_date`, `admitted_by`, `admitted_at`, `admission_notes`, and `rejection_reason`.

#### `20260929100000_referral_conversion.sql`
- **Purpose**: Links public inquiries and referrals directly to admitted clients.
- **Modifications**:
  - Adds `assigned_to`, `handled_notes`, and `converted_client_id REFERENCES clients(id)` to `client_referrals`.

#### `20260929110000_caregiver_client_assignment.sql`
- **Purpose**: Connects qualified caregivers to admitted clients.
- **Modifications**:
  - Adds `caregiver_id` to `care_plans`, `care_schedules`, and `authorizations`.
  - Creates `caregiver_client_assignments` table with unique active assignment constraints.

#### `20260929120000_training_reminders_and_client_requirements.sql`
- **Purpose**: Course validity tracking and role-differentiated document requirements.
- **Modifications**:
  - Adds `validity_months` to `training_courses`.
  - Adds `due_at DATE` to `training_enrollments` for automated reminder triggers.
  - Adds `for_role` column to `document_requirements` (`caregiver`, `client`, `both`).

#### `20260929130000_audit_hardening.sql`
- **Purpose**: Hardens HIPAA compliance audit logging and digital signature integrity.
- **Modifications**:
  - Adds `user_agent`, `request_id`, and `entity_state_id` to `audit_logs`.
  - Adds `version` and `content_hash` to `caregiver_applications` and `client_agreements`.

#### `20260929214500_query_performance_indexes.sql`
- **Purpose**: Adds optimized partial composite indexes to support performant state-filtered queries.

#### `20260930000000_retention_and_legal_hold.sql`
- **Purpose**: Adds evidence protection for legal and regulatory proceedings.
- **Modifications**:
  - Adds `legal_hold BOOLEAN NOT NULL DEFAULT FALSE` to `clients`, `caregivers`, and `documents`.
  - Indexes active legal hold flags to optimize retention query immunity.

---

### Phase 3: Atomic Workflows & Authorization Units

#### `20261006160000_atomic_caregiver_application.sql`
- **Purpose**: Prevents incomplete registrations during caregiver onboarding.
- **Modifications**:
  - Creates PostgreSQL stored procedure `create_caregiver_application_atomic(p_user_id, p_state_id, p_email, p_profile, p_application)`.
  - Atomically provisions user record, updates profile, and stores application within a single transaction.

#### `20261007150000_authorization_units_and_burn_down.sql`
- **Purpose**: Standardizes prior authorizations with Medicaid billing codes and unit caps.
- **Modifications**:
  - Adds `hcpcs_code VARCHAR(20) NOT NULL DEFAULT 'T1019'`.
  - Adds `service_description VARCHAR(150) NOT NULL DEFAULT 'Personal Care Services'`.
  - Adds `total_units_authorized INT NOT NULL DEFAULT 0` and `units_used INT NOT NULL DEFAULT 0`.
  - Adds `max_weekly_hours NUMERIC(4,2)` and `unit_type` (`15_min`, `hourly`, `visit`).
