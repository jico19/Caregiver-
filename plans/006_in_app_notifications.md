# Plan 006 — In-App Notifications and Client Document Requirements

**Status:** Completed
**Closes:** `Scope of work.md:47` (training reminders), `Scope of work.md:111` (track missing client documents), `Scope of work.md:128` (new referral notifications)
**Depends on:** 001 (soft deletion — new jobs and lists must filter `deleted_at`)

## Constraint

Email and SMS are **deferred** pending provider accounts and API keys. `Scope of work.md:36,123,124` stay open. Everything here is delivered inside the application and needs no external service.

The current channel is a single function, `notify()` at `backend/app/utils/notifications.py:1-15`, which inserts into `notifications`. Sixteen call sites use it. All of that stays as is; this plan adds new call sites and new reads.

## Problem, part one — nothing tells staff about training

No training reminder exists. `backend/app/jobs/` contains exactly two files, `credential_reminders.py` and `authorization_reminders.py`, both wired at `backend/app/main.py:49-50`. There is no third.

The blocker is structural, not just an omitted job. **There is no due date to scan.** `training_courses` (`initial_schema.sql:378-387`) has `id`, `state_id`, `name`, `description`, `duration_hours`, `active`. `training_enrollments` (`:401-414`) has `course_id`, `caregiver_id`, `status`, `enrolled_at`, `completed_at`. Neither carries a due date, a validity period, or a renewal interval. Even a complete job implementation would have nothing to query.

The only training notification that exists is a self-confirmation: completing a course notifies the caregiver that they completed it (`backend/app/api/routes/training.py:140`). The agency is never told a caregiver is overdue.

## Problem, part two — a new enquiry arrives and nobody knows

`POST /states/{state}/contact` (`backend/app/api/routes/states.py:85-113`) validates the state, resolves the state id, inserts a `client_referrals` row with `status='new'`, and returns a referral id.

That is all it does. The file does not import `notify` (imports at lines 1-3), writes no audit entry, and alerts no one. An administrator learns about a new enquiry only by opening the referral queue and noticing a new row. For a business where a referral is the start of revenue, that is the single most consequential silence in the system.

## Problem, part three — clients cannot be told what they owe

Caregivers have a credential status view that computes missing documents: `GET /caregivers/me/credential-status` (`backend/app/api/routes/caregivers.py:543-618`) joins `document_requirements` against uploaded documents and returns missing, expired, expiring, valid, and a compliant summary. Clients have no equivalent.

The reason is a data gap. `document_requirements` is keyed on `state_id` and `document_type_id` (`initial_schema.sql:187-196`) with **no role discriminator**, and `supabase/seeds/02_document_requirements.sql:13` seeds caregiver rows only. So there is no client requirement set to compare against, and the caregiver endpoint is correctly gated `require_caregiver` at `training.py:52`-style guards. Nothing to show, and nothing to show it from.

Two further gaps in the same area: the client upload UI (`frontend/src/pages/client/DocumentsPage.jsx:168-178`) ignores `requires_expiration` even though five of the six client document types set it, and there is no client "Other" catch-all type.

## Scope

### A. Migration

`supabase/migrations/20260929120000_training_reminders_and_client_requirements.sql`

```sql
ALTER TABLE training_courses
  ADD COLUMN validity_months INTEGER;

ALTER TABLE training_enrollments
  ADD COLUMN due_at DATE;

CREATE INDEX idx_enrollments_due ON training_enrollments(due_at)
  WHERE status <> 'completed';

ALTER TABLE document_requirements
  ADD COLUMN for_role VARCHAR(20) NOT NULL DEFAULT 'caregiver'
    CHECK (for_role IN ('caregiver','client','both'));
```

`due_at` is stamped at enrollment from the course's `validity_months`. Courses with a null validity are never due, which is the correct default for a course with no renewal requirement.

### B. Training reminder job

New `backend/app/jobs/training_reminders.py`, modelled directly on the two existing jobs so it inherits their proven shape: a pure `scan_due_training(supabase, today=None)` returning a count, idempotent through `notifications.reference_id`, and a 30-day window from a module constant matching `EXPIRING_WINDOW_DAYS` in the existing jobs.

Wired in `backend/app/main.py` alongside the other two. Deduplicate the three near-identical loop bodies into one shared helper while adding the third; three copies of a scheduling loop is where the next drift comes from.

### C. Referral notification

On insert in `states.py`, create one notification per administrator in the referral's state, and write an audit entry for the submission itself. The submission is unauthenticated and captures a name, phone, email, and free-text notes, so it belongs in the audit trail.

### D. Admin notification surface

- `GET /admin/notifications` and a mark-read route, mirroring the caregiver and client implementations at `caregivers.py:492-531` and `clients.py:467-490`.
- Navbar badge on `frontend/src/layouts/AdminLayout.jsx`, which currently has none while the caregiver and client layouts both do.
- `frontend/src/pages/admin/NotificationsPage.jsx`.

### E. Client document requirements

- Seed client requirements per state in `supabase/seeds/02_document_requirements.sql`, using the `for_role` column from section A.
- `GET /clients/me/document-status`, mirroring `caregivers.py:543`.
- A requirements panel on `frontend/src/pages/client/DashboardPage.jsx` and `frontend/src/pages/client/DocumentsPage.jsx`.
- Honour `requires_expiration` on the client upload form, as the caregiver form already does at `caregiver/DocumentsPage.jsx:62-65`.
- Add a client-scoped "Other" document type in `supabase/seeds/01_core.sql`.

**Confirm the required document set per state with the agency before seeding.** This is compliance data and a guess would be worse than none.

### F. Caregiver dashboard training count

`frontend/src/pages/caregiver/DashboardPage.jsx:112-125` renders a hardcoded "In-Service" badge. Replace it with a real completed count, which already exists on the training page at `TrainingPage.jsx:54-55,92-95`.

## Database

- **Migration:** `supabase/migrations/20260929120000_training_reminders_and_client_requirements.sql`
- **Seed data:** `supabase/seeds/01_core.sql` gains a client "Other" document type. `supabase/seeds/02_document_requirements.sql` gains client rows per state. `supabase/seeds/01_core.sql` optionally gains `validity_months` on real courses.
- **Rollback path:** forward-only. `validity_months` and `due_at` are nullable, `for_role` is defaulted. Stop the new job by removing its task in `main.py`; the other two jobs are unaffected.
- **Production verification:** set one seeded enrollment's `due_at` inside the window, run the job, confirm exactly one notification, run it again and confirm zero. Then confirm the client requirements panel renders against production data.

## Tests

- New `backend/tests/test_training_reminders.py`, following `test_authorization_reminders.py` exactly: idempotency across two runs, and a no-match run that creates nothing.
- Extend `backend/tests/test_state_scoping.py` for the referral notification: a state administrator is notified for their own state, a `super_admin` is notified for all states, and a referral in one state never notifies an administrator of another.
- New coverage for the client document status: missing, expired, expiring, valid, and compliant summary, matching the caregiver cases already covered in `test_portal_gaps.py`.
- The client upload form rejects a missing expiration date on a type that requires one.

## Known limitation to record

The three jobs run as in-process asyncio tasks started at `main.py:49-50`, each firing immediately then sleeping 24 hours. They run only while uvicorn is alive, drift relative to process start, and each worker runs its own scan. The `reference_id` dedup prevents duplicate rows, so the output is correct, but the mechanism is not production-grade. `apscheduler==3.10.4` is already a declared dependency at `backend/requirements.txt:10` and unused. Moving to it is a small follow-up and is deliberately not bundled here, because it changes deployment behaviour for a reason unrelated to this plan.

## Deliverable tracker

- [x] A. Migration written and `--dry-run` reviewed
- [x] B. Client required-document set confirmed with the agency
- [x] C. `training_reminders.py` job, modelled on the existing two
- [x] D. Three loop bodies consolidated in `main.py`
- [x] E. Referral notification and submission audit entry
- [x] F. Admin notifications endpoint, page, and badge
- [x] G. Client document status endpoint and requirements panel
- [x] H. `requires_expiration` honoured on the client upload form
- [x] I. Client "Other" document type seeded
- [x] J. Real training count on the caregiver dashboard
- [x] K. Tests: training reminder idempotency, referral notification scoping, client document status
- [x] L. Verify: `pytest -q`, `compileall`, `npm.cmd run lint`, `npm.cmd run build`
