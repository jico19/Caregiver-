# Plan 003 — Client Admission Lifecycle

**Status:** Completed
**Closes:** `Scope of work.md:109` (approve admissions), `Scope of work.md:112` (monitor service start dates)
**Depends on:** 001 (soft deletion — `clients` gains `deleted_at`)
**Blocks:** 004, 005

## Problem

`POST /clients/intake` (`backend/app/api/routes/clients.py:104-156`) upserts the client row and sends a notification. That is the end of the process. The client is a live client the moment the form is submitted.

The `clients` table has no lifecycle column at all. Its full definition is at `supabase/migrations/20260924101138_initial_schema.sql:296-307`: primary key, `state_id`, name, date of birth, phone, address, Medicaid number, timestamps. There is no status, no admission decision, no decision-maker, no start date.

The only status-like lifecycle in the client domain belongs to a different object: `authorizations.status` with a `pending` / `active` / `expiring_soon` / `expired` / `rejected` check constraint (`initial_schema.sql:356-357`). That is Medicaid approval for a set of visits, not admission of a person. Treating the two as the same thing is the mistake to avoid — a client can be admitted with no authorization yet, and can hold an authorization with no admission, and neither state is legitimate.

Service start date has the same shape of gap. `authorizations.start_date` exists and is `NOT NULL` (`initial_schema.sql:354`), but that is the window of billable visits. There is no field anywhere for the day care actually begins, and no report that buckets upcoming service starts.

## Scope

### A. Migration

`supabase/migrations/20260929090000_client_admission_lifecycle.sql`

```sql
ALTER TABLE clients
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','active','discharged','rejected')),
  ADD COLUMN service_start_date DATE,
  ADD COLUMN admitted_by UUID REFERENCES users(id),
  ADD COLUMN admitted_at TIMESTAMPTZ,
  ADD COLUMN admission_notes TEXT;

CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_start   ON clients(service_start_date);
```

`admitted_by` references `users(id)` rather than `auth.users(id)`, so the actor is resolvable by the same service-role join the rest of the admin surface uses.

Forward-only, per `supabase/RUNBOOK.md`. Read the `--dry-run` output before pushing.

### B. Backfill

Existing clients default to `pending`. That is the honest reading: nothing in the current data proves an admission review happened. Confirm this is acceptable with the agency before pushing, because it will report existing clients as awaiting approval. If the agency would rather existing clients read as `active`, seed an explicit backfill in the same migration instead of relying on the default.

### C. Backend

- New transition guard in `backend/app/models/enums.py` following the existing `ALLOWED_TRANSITIONS` pattern used for applications.
- `POST /admin/clients/{id}/admission` in the client cluster of `backend/app/api/routes/admin.py` (starts at line 412), guarded by `require_admin_scoped`.
- Rejection requires a reason, matching the caregiver application review behaviour at `admin.py:208`.
- `GET /admin/clients` accepts a status filter and can sort by upcoming `service_start_date`.
- `GET /clients/me` returns the client's own status and service start date.
- Every transition writes an audit entry with old and new values.

### D. Frontend

- `frontend/src/pages/admin/ClientsPage.jsx`: status filter, status badge, start date column.
- `frontend/src/pages/admin/ClientDetailPage.jsx`: admission panel with the decision action and a service start date field.
- `frontend/src/pages/client/DashboardPage.jsx`: show admission status and the confirmed start date.
- New badge vocabulary in the existing design token set, not hardcoded colors.

## Database

- **Migration:** `supabase/migrations/20260929090000_client_admission_lifecycle.sql`
- **Seed data:** none. Backfill decision recorded in section B.
- **Rollback path:** forward-only. The added columns are nullable or defaulted, so reverting the application code leaves them inert and harmless. Dropping the columns is not required and not recommended.
- **Production verification:** after push, confirm the default applied to existing rows with a read-only count grouped by `status`, then exercise one real approval through the API and confirm the audit row exists.

## Tests

New `backend/tests/test_client_admission.py`.

- A client can be admitted by an administrator in the same state.
- A client in another state is denied, by id and in the list.
- `super_admin` may admit across states.
- A caregiver is denied.
- An unscoped `administrator` is denied.
- Rejection requires a reason; the reason is stored separately from any other field so a later edit cannot overwrite it, following the mistake `application_rejection_reason` migration fixed.
- An invalid transition is rejected, and a state-skipping transition is rejected, matching the application coverage in `tests/test_admin.py`.
- Approving sets `admitted_by`, `admitted_at`, and `service_start_date`.
- A cross-state `service_start_date` write is denied, the same shape of guard the authorization create path already has at `admin.py:697`.
- The client sees their own status through `GET /clients/me`.

## Rollback

Revert the admin route, the client route, the enum change, and the frontend pages. The migration is additive and forward-only, so the database is left in a consistent state.

## Deliverable tracker

- [x] A. Migration written and `--dry-run` reviewed
- [x] B. Backfill decision confirmed with the agency
- [x] C. Enum transition guard added
- [x] D. `POST /admin/clients/{id}/admission` with state scoping
- [x] E. Status filter and start date sort on `GET /admin/clients`
- [x] F. Client-facing status on `GET /clients/me`
- [x] G. Admin and client UI
- [x] H. `tests/test_client_admission.py`
- [x] I. Verify: `pytest -q`, `compileall`, `npm.cmd run lint`, `npm.cmd run build`
- [x] J. Push to production, read back the status counts, confirm the audit row

