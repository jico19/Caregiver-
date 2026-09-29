# Plan 002 — Offboarding and User Lifecycle

**Status:** Planned
**Closes:** `Scope of work.md:135` (role-based user access), and the audit finding that a terminated caregiver retains a live login.
**Depends on:** 001 (soft deletion — this plan must not hard-delete)

## Problem

There is no way to take a user out of the system.

The `users` table has carried a `status` column with an `active` / `inactive` / `suspended` check constraint since the baseline migration (`supabase/migrations/20260924101138_initial_schema.sql:59-60`), and the backend enforces it — `backend/app/core/dependencies.py:47-48` rejects a suspended user. But no route anywhere writes the column. Suspension is therefore unreachable from the application and would require direct SQL against production.

Three consequences follow:

1. **A terminated caregiver keeps a working login.** Nothing calls `auth.admin.delete_user()`. `backend/app/api/routes/auth.py:56` and `backend/app/api/routes/caregivers.py:87` only ever *create* auth users.
2. **There is no admin view of users at all.** `frontend/src/pages/admin/UsersPage.jsx` is an 8-line placeholder that renders the word TODO. It is routed at `frontend/src/routes/AppRoutes.jsx:120` but omitted from the nav in `frontend/src/layouts/AdminLayout.jsx:24-48`, so it is unreachable in practice.
3. **Offboarding a client has no path either.** No `DELETE` route exists for `users`, `caregivers`, `clients`, `documents`, `client_agreements`, or `authorizations`. The only `.delete()` calls in the backend are three unrelated ones: care-plan activity replacement (`admin.py:547`), a single schedule row (`admin.py:642`), and a single announcement (`admin.py:991`).

The schema cascades correctly and that is now a problem rather than a convenience. `users.id` cascades from `auth.users` (`initial_schema.sql:55`), and `caregivers` and `clients` cascade from `users` (`:211`, `:297`), which then cascades documents, agreements, care plans, schedules, and authorizations.

A single deleted client row would therefore take twelve months of care history with it. Plan 001 adds soft deletion so the cascade is never the mechanism, and this plan uses it.

## Scope

### A. Admin user management API

New router `backend/app/api/routes/admin_users.py`, registered in `backend/app/main.py`.

| Endpoint | Guard | Purpose |
|---|---|---|
| `GET /admin/users` | `require_admin_scoped` | Paginated user list, filter by role, status, and state. |
| `GET /admin/users/{id}` | `require_admin_scoped` | Single user with caregiver or client profile. |
| `POST /admin/users/{id}/status` | `require_admin_scoped` | Suspend, reactivate, or mark inactive. |
| `POST /admin/users/{id}/role` | `require_admin` only | Change role. Restricted to `super_admin`, because it alters the authorization boundary itself. |
| `POST /admin/users/{id}/state` | `require_admin` only | Reassign state. `super_admin` only, for the same reason. |
| `DELETE /admin/users/{id}` | `require_admin` only | **Offboard**, a soft delete. `super_admin` only, and blocked for the caller themself. |

Every state-scoped route uses the existing `AdminScope` dependency and `scope_query` helper from `backend/app/core/dependencies.py` so the state boundary is enforced by the same mechanism as the rest of the admin surface. An unscoped `administrator` is denied, exactly as `agents.md` requires.

Status and role changes write to `audit_logs` through the existing `record_audit_log` helper.

### B. Suspension enforcement

Write `users.status` from the new routes. The read path already exists at `dependencies.py:47-48`; confirm it covers every authenticated entry point rather than only some.

### C. Offboarding is a soft delete, not a cascade

**This section was rewritten after plan 001.** The original version called `auth.admin.delete_user()`, which cascades `users` → `caregivers` / `clients` → documents, agreements, care plans, schedules, authorizations. That destroys clinical history. A client who received twelve months of care cannot have that record removed because someone pressed delete in a user screen.

`DELETE /admin/users/{id}` now does this, in order:

1. Set `users.status = 'inactive'` and `users.deleted_at = now()`. This alone revokes access, because `backend/app/core/dependencies.py:47-48` already rejects a non-active user.
2. Soft-delete the user's profile row and their document rows, stamping `deleted_by`.
3. Soft-delete their dependent clinical rows — care plans, care plan activities, schedules, agreements, authorizations, enrollments — so nothing resurfaces through an unfiltered query.
4. Write an audit entry.

**Do not call `auth.admin.delete_user()`.** The auth account stays as an inert shell with no profile behind it. It cannot authenticate into anything, because step 1 already revoked it at the application layer.

This looks wrong until you know why, so state the reason in a code comment at the call site. Someone will otherwise read it as an oversight and "fix" it.

**Erasure is a separate, deliberate act.** Where a legal obligation requires data to be destroyed rather than retained, that is a `super_admin` action, it destroys storage objects as well as rows, and it is never triggered by an ordinary offboard. The default path retains. Retention periods and a purge job for records past them belong to plan 001 section F.

**Storage objects are retained too.** A soft-deleted document keeps its file in the private bucket. The row is invisible and signed URLs stop working, but the bytes remain. That is correct for a medical record and it does mean the bucket grows; the retention work covers it.

### D. Frontend

Replace the `frontend/src/pages/admin/UsersPage.jsx` stub with a real screen: search, role and status filters, a suspend/reactivate action, and an offboard action behind a confirmation dialog. Label it **Offboard**, not **Delete**, because nothing is deleted. Add it to the nav in `AdminLayout.jsx`.

## Database

**No migration of its own.** `users.status` and the soft-delete columns both arrive with plan 001.

## Tests

New `backend/tests/test_user_lifecycle.py`. Extend `backend/tests/conftest.py` with seeded users across the three states in each status, following the pattern already used in `backend/tests/test_state_scoping.py`.

Required cases:

- A suspended user is denied on every authenticated role, not only one.
- Reactivation restores access.
- An unscoped `administrator` is denied the user list and every single-user read.
- A state administrator is denied a user in another state, and denied in list results.
- A state administrator cannot suspend, reassign, or offboard a user in another state.
- `super_admin` may act across all states.
- A state administrator cannot change a role or a state; that is `super_admin` only.
- A user cannot offboard themself.
- Offboarding sets `deleted_at` and **retains every row**. The `users`, profile, and document rows are still present after the call.
- Offboarding soft-deletes the user's care plans, schedules, agreements, authorizations, and enrollments, so none resurfaces through an unfiltered query.
- The auth account still exists after offboarding, and the user cannot authenticate with it.
- A signed URL for an offboarded user's document returns 403.
- Re-offboarding a user who is already offboarded returns 409, not a silent success.
- Suspension, offboarding, and restore each write an audit entry.
- Offboarding a nonexistent user returns 404.
- The offboard action does not remove storage objects.

## Rollback

Revert `admin_users.py`, the route registration in `main.py`, and the frontend page. No schema change means nothing to undo in the database. Data written by a rollback is retained, which is the correct behaviour for a compliance record.

## Production verification

- `npx supabase migration list` from the repository root to confirm no new migration is expected beyond plan 001's.
- Manual smoke against a real project: suspend a seeded administrator, confirm the existing token stops working, reactivate, confirm it works again. This is the only way to prove the `dependencies.py:47-48` check is reached from a real login.
- Offboard a seeded test caregiver holding one uploaded document, then confirm all of three: the row is invisible in the UI, the row is still physically present in the table, and the document is still in the private bucket. All three, because a soft delete that is only invisible is not a soft delete, it is a filter.

## Deliverable tracker

- [ ] A. `admin_users.py` router with the six endpoints
- [ ] B. `users.status` write path verified against every entry point
- [ ] C. Offboard implemented as a soft delete; **no `auth.admin.delete_user()` call anywhere**
- [ ] D. Offboard soft-deletes dependent clinical rows; restore does not cascade
- [ ] E. `UsersPage.jsx` replaced, action labelled Offboard; nav entry added
- [ ] F. `tests/test_user_lifecycle.py` with all required cases
- [ ] G. New route module patched in `conftest.py`
- [ ] H. Verify: `pytest -q`, `compileall`, `npm.cmd run lint`, `npm.cmd run build`
