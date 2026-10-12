# Database Schema Guide

Comprehensive reference for the Caregiver Platform PostgreSQL database schema, including tables, relationships, soft deletion design, legal hold flags, and stored procedures.

---

## 1. Schema Overview

The database runs on **Supabase Postgres (PostgreSQL 15+)**.
All tables enforce **Row Level Security (RLS)** as defense-in-depth. The FastAPI backend connects using the service role key and applies state and role scoping programmatically.

### Soft Deletion Standard
Operational tables implement a unified soft-deletion strategy:
- `deleted_at TIMESTAMPTZ NULL`: Timestamp when record was soft-deleted (`NULL` indicates active row).
- `deleted_by UUID NULL`: ID of the user who deleted the record.
- **Partial Unique Indexes**: Prevent collision when re-registering or re-enrolling after deletion (e.g. `idx_users_email_live ON users (lower(email)) WHERE deleted_at IS NULL`).

### Legal Hold & Evidence Protection
Sensitive compliance tables (`clients`, `caregivers`, `documents`) include:
- `legal_hold BOOLEAN NOT NULL DEFAULT FALSE`
- When `legal_hold = TRUE`, automated retention cleanup jobs cannot purge the record regardless of age.

---

## 2. Table Catalog by Domain

### Core Multi-Tenant & Identity Tables

#### `states`
Jurisdictions served by the platform.
- `id` (SERIAL, PK): State identifier (1: FL, 2: IN, 3: GA).
- `code` (VARCHAR(2), UNIQUE): State postal code (e.g., 'FL', 'IN', 'GA').
- `name` (VARCHAR(50), UNIQUE): Full state name.
- `slug` (VARCHAR(50), UNIQUE): Route slug ('florida', 'indiana', 'georgia').
- `active` (BOOLEAN): Status of state operations.
- `created_at`, `updated_at` (TIMESTAMPTZ).

#### `roles`
System access privilege tiers.
- `id` (SERIAL, PK): Role identifier.
- `name` (VARCHAR(50), UNIQUE): `super_admin`, `administrator`, `caregiver`, `client`.
- `description` (TEXT): Description of scope.

#### `users`
Extends `auth.users` with application metadata.
- `id` (UUID, PK): References `auth.users(id)` ON DELETE CASCADE.
- `email` (VARCHAR(255)): User email address (unique among non-deleted rows).
- `role_id` (INTEGER, FK -> `roles.id`): Assigned role.
- `state_id` (INTEGER NULL, FK -> `states.id`): Scoped state (`NULL` permitted only for `super_admin`).
- `status` (VARCHAR(20)): 'active', 'inactive', 'suspended'.
- `deleted_at`, `deleted_by` (TIMESTAMPTZ, UUID).

---

### Caregiver Management Tables

#### `caregivers`
Caregiver identity and personal details.
- `id` (UUID, PK): References `users(id)` ON DELETE CASCADE.
- `state_id` (INTEGER, FK -> `states.id`): State of practice.
- `first_name`, `last_name` (VARCHAR(100)): Full name.
- `phone` (VARCHAR(20)), `address` (TEXT).
- `date_of_birth` (DATE), `ssn_last4` (VARCHAR(4)).
- `legal_hold` (BOOLEAN, DEFAULT FALSE).
- `deleted_at`, `deleted_by` (TIMESTAMPTZ, UUID).

#### `caregiver_applications`
Applicant intake and review pipeline.
- `id` (UUID, PK): Primary key.
- `caregiver_id` (UUID, FK -> `caregivers.id`).
- `state_id` (INTEGER, FK -> `states.id`).
- `status` (VARCHAR(20)): `draft`, `submitted`, `under_review`, `approved`, `rejected`, `onboarding`.
- `submitted_at`, `reviewed_at` (TIMESTAMPTZ).
- `reviewed_by` (UUID NULL, FK -> `users.id`).
- `notes`, `rejection_reason` (TEXT).
- `signature_data` (TEXT): Base64 signature canvas data.
- `signed_name` (VARCHAR(200)), `signed_at` (TIMESTAMPTZ).
- `version` (INTEGER, DEFAULT 1), `content_hash` (TEXT): SHA-256 integrity hash.

---

### Client Management Tables

#### `clients`
Patient clinical profile and intake status.
- `id` (UUID, PK): References `users(id)` ON DELETE CASCADE.
- `state_id` (INTEGER, FK -> `states.id`).
- `first_name`, `last_name` (VARCHAR(100)).
- `date_of_birth` (DATE), `phone` (VARCHAR(20)), `address` (TEXT).
- `medicaid_number` (VARCHAR(50)): Insurance identifier.
- `status` (VARCHAR(20), DEFAULT 'pending'): `pending`, `approved`, `active`, `discharged`, `rejected`.
- `service_start_date` (DATE NULL): Service commencement date.
- `admitted_by` (UUID NULL, FK -> `users.id`), `admitted_at` (TIMESTAMPTZ NULL).
- `admission_notes`, `rejection_reason` (TEXT).
- `signature_data`, `signed_name`, `signed_at`: E-signature for intake consent.
- `legal_hold` (BOOLEAN, DEFAULT FALSE).
- `deleted_at`, `deleted_by` (TIMESTAMPTZ, UUID).

#### `client_referrals`
Prospective client pipeline and inquiry tracking.
- `id` (UUID, PK): Unique referral identifier.
- `state_id` (INTEGER, FK -> `states.id`).
- `first_name`, `last_name`, `phone`, `email` (Contact information).
- `referral_source` (VARCHAR(100)), `notes` (TEXT).
- `status` (VARCHAR(20)): `new`, `contacted`, `converted`, `closed`.
- `assigned_to` (UUID NULL, FK -> `users.id`): Assigned intake coordinator.
- `handled_notes` (TEXT).
- `converted_client_id` (UUID NULL, FK -> `clients.id`): Linked client record upon conversion.
- `deleted_at`, `deleted_by` (TIMESTAMPTZ, UUID).

#### `client_agreements`
Legally binding agreements (Care Agreement, HIPAA Disclosure, Client Rights).
- `id` (UUID, PK): Primary key.
- `client_id` (UUID, FK -> `users.id`).
- `state_id` (INTEGER, FK -> `states.id`).
- `agreement_key` (VARCHAR(100)): Identifier (e.g., `client_rights`, `service_agreement`).
- `title` (VARCHAR(200)), `version` (INTEGER, DEFAULT 1).
- `body` (TEXT): Rendered agreement body.
- `signature_data` (TEXT), `signed_name` (VARCHAR(200)), `signed_at` (TIMESTAMPTZ).
- `content_hash` (TEXT): Cryptographic hash of signed agreement.
*(Note: Excluded from soft deletion as immutable legal evidence).*

---

### Authorizations & Unit Burndown

#### `authorizations`
Payer prior authorizations and usage caps.
- `id` (UUID, PK): Primary key.
- `client_id` (UUID, FK -> `clients.id`).
- `state_id` (INTEGER, FK -> `states.id`).
- `caregiver_id` (UUID NULL, FK -> `caregivers.id`): Optional restricted caregiver.
- `authorization_number` (VARCHAR(100)): Payer reference number.
- `hcpcs_code` (VARCHAR(20), DEFAULT 'T1019'): Procedure billing code.
- `service_description` (VARCHAR(150), DEFAULT 'Personal Care Services').
- `unit_type` (VARCHAR(20)): `15_min`, `hourly`, `visit`.
- `total_units_authorized` (INT): Total authorized units for authorization period.
- `units_used` (INT, DEFAULT 0): Units consumed through completed shifts.
- `max_weekly_hours` (NUMERIC(4,2)): Weekly service hour cap.
- `start_date`, `end_date` (DATE): Validity timeframe.
- `status` (VARCHAR(20)): `pending`, `active`, `expiring_soon`, `expired`, `rejected`.
- `source` (VARCHAR(20)): `admin` or `client` (self-service upload).
- `reviewed_at`, `reviewed_by`: Audit verification columns.
- `document_id` (UUID NULL, FK -> `documents.id`): Uploaded authorization document.
- `deleted_at`, `deleted_by` (TIMESTAMPTZ, UUID).

---

### Care Plans, Schedules & Staffing

#### `care_plans`
Clinical care directives per client.
- `id` (UUID, PK): Unique plan ID.
- `client_id` (UUID, UNIQUE, FK -> `users.id`).
- `state_id` (INTEGER, FK -> `states.id`).
- `caregiver_id` (UUID NULL, FK -> `caregivers.id`).
- `status` (VARCHAR(20)): `active`, `pending`, `inactive`.
- `effective_date` (DATE), `primary_nurse` (VARCHAR(200)), `emergency_protocol` (TEXT).
- `created_by` (UUID, FK -> `users.id`).
- `deleted_at`, `deleted_by` (TIMESTAMPTZ, UUID).

#### `care_plan_activities`
Specific Activities of Daily Living (ADLs) and tasks.
- `id` (UUID, PK): Activity identifier.
- `care_plan_id` (UUID, FK -> `care_plans.id` ON DELETE CASCADE).
- `task` (VARCHAR(200)): Task description (e.g., "Personal Hygiene", "Meal Prep").
- `frequency` (VARCHAR(100)): Schedule interval (e.g., "Daily", "Mon/Wed/Fri").
- `notes` (TEXT), `sort_order` (INTEGER).
- `deleted_at`, `deleted_by` (TIMESTAMPTZ, UUID).

#### `care_schedules`
Weekly recurring shift commitments.
- `id` (UUID, PK): Schedule identifier.
- `client_id` (UUID, FK -> `users.id`).
- `caregiver_id` (UUID NULL, FK -> `caregivers.id`).
- `state_id` (INTEGER, FK -> `states.id`).
- `day_of_week` (VARCHAR(20)): Day name (e.g., "Monday").
- `start_time` (TIME), `end_time` (TIME).
- `service` (VARCHAR(200)), `notes` (TEXT).
- `status` (VARCHAR(20)): `scheduled`, `confirmed`, `completed`, `cancelled`.
- `deleted_at`, `deleted_by` (TIMESTAMPTZ, UUID).

#### `caregiver_client_assignments`
Active caregiver-to-client staffing links.
- `id` (UUID, PK): Assignment identifier.
- `caregiver_id` (UUID, FK -> `caregivers.id` ON DELETE CASCADE).
- `client_id` (UUID, FK -> `clients.id` ON DELETE CASCADE).
- `role` (VARCHAR(40), DEFAULT 'primary'): `primary`, `relief`, `backup`.
- `assigned_by` (UUID, FK -> `users.id`), `assigned_at` (TIMESTAMPTZ).
- `ended_at` (TIMESTAMPTZ NULL): Closure date of the assignment.
- Unique constraint: `unique_active_caregiver_client UNIQUE (caregiver_id, client_id)`.

---

### Documents, Training & Audit Trail

#### `document_types` & `document_requirements`
Matrix of required compliance documents per state.
- `document_types`: `id`, `name`, `for_role` (`caregiver`, `client`, `both`), `requires_expiration`.
- `document_requirements`: Defines state-specific mandates (`state_id`, `document_type_id`, `required`, `for_role`).

#### `documents`
Uploaded binary files stored in the Supabase Storage `documents` bucket.
- `id` (UUID, PK), `owner_id` (UUID, FK -> `users.id`), `document_type_id` (INTEGER, FK -> `document_types.id`).
- `state_id` (INTEGER, FK -> `states.id`), `storage_path` (TEXT).
- `status`: `pending_review`, `approved`, `rejected`, `expired`.
- `expiration_date` (DATE NULL), `reviewed_at`, `reviewed_by`, `rejection_reason`.
- `legal_hold` (BOOLEAN, DEFAULT FALSE).
- `deleted_at`, `deleted_by` (TIMESTAMPTZ, UUID).

#### `training_courses` & `training_enrollments`
Course curriculum and caregiver completion tracking.
- `training_courses`: `id`, `name`, `duration_hours`, `validity_months`, `active`.
- `training_enrollments`: `course_id`, `caregiver_id`, `status` (`not_started`, `in_progress`, `completed`), `due_at` (DATE), `enrolled_at`, `completed_at`.

#### `audit_logs`
Immutable compliance audit log for HIPAA and regulatory accountability.
- `id` (UUID, PK), `user_id` (UUID NULL, FK -> `users.id`), `action` (VARCHAR(100)).
- `table_name` (VARCHAR(100)), `record_id` (TEXT).
- `old_values` (JSONB NULL), `new_values` (JSONB NULL): Whitelisted field diffs.
- `ip_address` (VARCHAR(45)), `user_agent` (TEXT), `request_id` (UUID), `entity_state_id` (INTEGER).
- `created_at` (TIMESTAMPTZ).

#### `notifications` & `announcements`
- `notifications`: User-directed alerts (`type`, `title`, `body`, `read`, `reference_id` for deduplication).
- `announcements`: Regional or role-wide broadcasts (`audience`: `caregiver`, `client`, `all`, `administrator`).

---

## 3. Stored Procedures & Database Functions

### `create_caregiver_application_atomic`
Defined in migration `20261006160000_atomic_caregiver_application.sql`.
- **Purpose**: Synchronizes user record creation, caregiver profile upsert, and application record insertion into a single atomic PostgreSQL transaction.
- **Benefit**: Eliminates partial registrations caused by network drops or transient client-side failures during submission.

### `update_updated_at` Trigger Function
- Automatically updates `updated_at = NOW()` on every `UPDATE` operation across all operational tables.
