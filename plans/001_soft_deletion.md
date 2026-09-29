# Plan 001 — Soft Deletion

**Status:** Implemented
**Closes:** the audit finding that three deletes in the backend are hard, and that plan 002's offboarding would have cascaded a client record away permanently
**Depends on:** none
**Blocks:** 002, and every later plan that writes to a table this one touches

## Problem

**No soft deletion exists anywhere in the platform.** A search across `supabase/`, `backend/`, and `frontend/` for `deleted_at`, `soft_delete`, `is_deleted`, or `archived_at` returns nothing. All 19 tables in `20260924101138_initial_schema.sql` hard-delete, and all 34 RLS policies in `20260924101600_rls_policies.sql` are written as though every row is live.

Three places delete data outright today:

| Location | What it destroys | Consequence |
|---|---|---|
| `backend/app/api/routes/admin.py:547` | Every `care_plan_activities` row for a care plan, immediately before re-inserting the new set | **A clinical record is destroyed on every edit.** Replace one activity in a plan and the previous wording is gone, with no history and no audit entry. |
| `backend/app/api/routes/admin.py:642` | One `care_schedules` row | A removed visit leaves no trace that it was ever scheduled. |
| `backend/app/api/routes/admin.py:991` | One `announcements` row | A sent announcement cannot be proven to have been sent. |

The first is the serious one. `PUT /admin/clients/{id}/care-plan` is a full replace: delete everything, insert the replacement. It is also unaudited, which plan 007 addresses separately. A care plan is a medical document, and a service that destroys the prior version of a medical document on ordinary editing cannot be shown to preserve it.

And the gap is about to get worse. Plan 002 offboards a user by calling `auth.admin.delete_user()`, which cascades: `users` → `caregivers` / `clients` → documents, agreements, care plans, schedules, authorizations. That cascade is architecturally convenient and clinically wrong. A client who received twelve months of care cannot have that record removed because someone pressed delete in a user screen. Medicaid and state record-retention rules generally require client and caregiver records to be kept for years after service ends.

## What soft deletion means here

A soft delete sets `deleted_at TIMESTAMPTZ` and leaves the row in place. Reads filter it out. Nothing in the application can bring it back except a deliberate, audited restore, and the raw data is still there for a legal hold, a records request, or a regulator.

**The design decision to make explicitly: Supabase Auth cannot soft-delete.** An `auth.users` row is either there or not. So a soft-deleted user keeps their auth account, and access is revoked by `users.status`, not by deleting the login. The auth account becomes an inert shell with no profile behind it. That is the correct trade — the alternative destroys the clinical record — and it should be stated in the code, because it looks wrong until you know why.

## Scope

### A. Migration

`supabase/migrations/20260928090000_soft_deletion.sql`

Add `deleted_at TIMESTAMPTZ` plus a `deleted_by UUID REFERENCES users(id)` to the tables that hold real records:

| Table | Why |
|---|---|
| `users` | The account and every profile hangs off it. |
| `caregivers`, `clients` | Identity and PHI. |
| `caregiver_applications` | An application record is part of a hiring file. |
| `documents` | Expiry history, and every audit entry references one. |
| `client_referrals` | Business record of an enquiry. |
| `authorizations` | Financial and Medicaid record. |
| `care_plans`, `care_plan_activities` | Clinical records. |
| `care_schedules` | Service delivery history. |
| `client_agreements` | **A signed agreement must never be soft-deleted at all.** Treat it as append-only; see section D. |
| `training_enrollments` | Compliance evidence. |

Partial index on `deleted_at` for the tables that get filtered on every read.

`states`, `roles`, `document_types`, `document_requirements`, `services`, `forms`, `licensing_info`, `website_content`, `training_courses`, `job_postings` and `audit_logs` do **not** get the column. These are reference data that is updated in place, not deleted, and `audit_logs` must remain physically immutable — adding a soft-delete column to the audit trail would invite exactly the kind of drift this plan is fixing.

### B. Filter every read

**89 select call sites across 12 files** need `.is("deleted_at", None)`. Blast radius by file: `admin.py` 30, `caregivers.py` 12, `states.py` 11, `clients.py` 10, `training.py` 10, `auth.py` 3, `document_service.py` 3, `dependencies.py` 3, and 2 each in the two reminder jobs and `pagination.py`.

This is the bulk of the work and it is mechanical. Two things to get right:

- **Filtering must not be optional.** A route that forgets the filter silently returns deleted rows. Make the omission hard to write: add a query helper in `backend/app/utils/pagination.py` or a new `backend/app/utils/soft_delete.py` that wraps the Supabase builder, and route the soft-deletable tables through it. A convention that depends on everyone remembering fails silently in the one place it matters most.
- **Unique constraints will now collide.** Soft-deleted rows still occupy their unique keys. This is a real, immediate break, not a theoretical one:

| Constraint | Break |
|---|---|
| `users.email UNIQUE` (`initial_schema.sql:56`) | Re-offboarding and re-inviting the same person fails. |
| `caregiver_enrollments UNIQUE (course_id, caregiver_id)` (`:412`) | Re-enrolling after a soft delete fails. |
| `documents UNIQUE (owner_id, document_type_id)` | Re-uploading a rejected document fails. |

Fix with partial unique indexes: `CREATE UNIQUE INDEX ... ON users(email) WHERE deleted_at IS NULL`. Postgres supports this and it is the correct tool. Confirm the exact existing constraint list in `initial_schema.sql` before writing the migration, because a missed constraint becomes a runtime failure rather than a migration failure.

### C. RLS

Every SELECT policy on a soft-deletable table needs `AND deleted_at IS NULL` appended to its `USING` clause. 34 policies exist; roughly 20 touch a soft-deletable table.

Policies must be changed with `DROP POLICY` then `CREATE`, because `CREATE POLICY IF NOT EXISTS` does not exist in Postgres. RLS is defense in depth behind the backend guard, so a missing filter here is a second failure, not the first — but it is the one that would let a client read another client's soft-deleted care plan if the backend filter were ever dropped.

### D. Stop the three hard deletes

- **`admin.py:547`** — replace the delete-and-reinsert with a soft delete of the removed activities plus an insert of the new ones, so the plan's prior state is retained. Better still, diff on `care_plan_activities.id` and update changed rows rather than replacing, which avoids churn. Either way the previous version survives.
- **`admin.py:642`** — soft delete the schedule row, keeping the record that a visit was scheduled and then cancelled.
- **`admin.py:991`** — soft delete the announcement rather than removing it.
- **`client_agreements`** — never soft delete. It is the record of a signature. Plan 007 adds versioning; between them, a signed agreement accumulates versions and is not removed.

### E. Restore path

`POST /admin/{resource}/{id}/restore`, `super_admin` only, audited, available for the tables in section A. Restoring a user does **not** restore their auth account if it was never deleted — it sets `users.status` back to active, which is the whole design.

Restoring a client must not silently revive a cascade. If a client was soft-deleted, their care plans, schedules, and authorizations stay soft-deleted until an administrator restores them deliberately. A restore that silently brought back two years of clinical records would be a surprise in the worst direction.

### F. Retention, not forever

Soft deletion means records are never destroyed, which is a storage cost and a privacy question rather than a free win. Two follow-ups, deliberately not in this plan's scope but recorded here so they are not lost:

- Define per-table retention periods and a purge job for records past them. Home care records are usually subject to a multi-year minimum, not a permanent one.
- Give clients a path to erasure of data that is not subject to retention, which is the other half of a data subject access request. Plan 002 provides deletion; this plan provides retention. Both are needed and they are not the same thing.

## Database

- **Migration:** `supabase/migrations/20260928090000_soft_deletion.sql`
- **Seed data:** none.
- **Rollback path:** forward-only, additive columns. Reverting the code leaves the columns inert. **Dropping the columns is genuinely destructive and must not be done as a rollback** — that is precisely the hard delete this plan exists to prevent, applied to a table that now contains soft-deleted rows. If the columns must go, the soft-deleted rows must be exported first.
- **Production verification:** after push, confirm a soft-deleted row is invisible to every read path, then confirm it is still present in the table, then confirm the RLS policy blocks a direct read. A soft delete that is only enforced in application code is not enforced at all.

## Tests

New `backend/tests/test_soft_deletion.py`.

- A soft-deleted row is absent from its list endpoint.
- A soft-deleted row returns 404 by id, not 403 and not an empty object.
- A soft-deleted client is absent from the admin client list, the reports, and the dashboard counts.
- A soft-deleted caregiver's documents are absent from every list and every signed-URL check.
- A soft-deleted client is invisible to a caregiver assigned under plan 005.
- Re-uploading a document that already has a soft-deleted row succeeds.
- Re-enrolling a caregiver in a course they soft-deleted from succeeds.
- Re-inviting a soft-deleted user by the same email succeeds.
- Editing a care plan preserves the previous activity wording and does not destroy any row.
- Deleting a schedule leaves the row present with `deleted_at` set.
- A soft-deleted announcement is no longer returned to caregivers.
- `audit_logs` and `client_agreements` cannot be soft-deleted through any route.
- Restore returns a row to visibility and writes an audit entry.
- Restore does **not** cascade — a restored client returns with no visible care plans until those are restored too.
- A `super_admin` can restore; a state administrator cannot.
- RLS: a client cannot read a soft-deleted care plan belonging to another client.

## Note on ordering

This plan is first because it is a precondition for plan 002. Plan 002 as originally written performs `auth.admin.delete_user()`, which cascades and destroys clinical history. That must be rewritten to suspend and soft-delete instead, and this plan is what makes that possible.

## Deliverable tracker

- [x] A. Existing unique constraints inventoried before the migration is written
- [x] B. Migration adds `deleted_at` and `deleted_by`; partial indexes where filtered
- [x] C. Partial unique indexes replace the colliding constraints
- [x] D. Query helper so the filter cannot be forgotten
- [x] E. All 89 select sites filtered
- [x] F. RLS policies dropped and recreated with the filter, ~20 policies
- [x] G. `admin.py:547` no longer destroys activity history
- [x] H. `admin.py:642` and `admin.py:991` soft delete
- [x] I. `client_agreements` and `audit_logs` excluded from soft delete entirely
- [x] J. Restore endpoints, `super_admin` only, audited, non-cascading
- [x] K. `tests/test_soft_deletion.py`
- [x] L. Verify: `pytest -q`, `compileall`, `npm.cmd run lint`, `npm.cmd run build`
- [x] M. Retention periods and purge job written up as a follow-up plan
