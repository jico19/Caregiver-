# Plan 008 — Admin Training and Settings Screens

**Status:** Completed
**Closes:** `Scope of work.md:104` (monitor training completion)
**Depends on:** 001 (soft deletion); 006 for the `for_role` column used by Settings

## Problem

Three items in the admin navigation are placeholders. `frontend/src/pages/admin/TrainingPage.jsx`, `SettingsPage.jsx`, and `UsersPage.jsx` are each 8 lines that render the word TODO. All three are routed at `frontend/src/routes/AppRoutes.jsx:116,120,121` but omitted from the nav in `frontend/src/layouts/AdminLayout.jsx:24-48`, so they are currently unreachable.

`UsersPage.jsx` is delivered by plan 002. This plan covers the other two, and decides what happens to the routing so staff never click into an empty page.

## Training

`Scope of work.md:104` requires monitoring training completion. Today an administrator can only see a caregiver's enrollments in passing, through `GET /admin/caregivers/{id}` (`admin.py:283-292`), and one aggregate report section at `admin.py:1200-1213`. There is no admin training endpoint and no list. An office coordinator cannot answer "who is behind on their in-service hours" without filtering a report and reading it row by row.

Build:

- `GET /admin/training` — paginated, state-scoped, filterable by course, caregiver, and status (`not_started`, `in_progress`, `completed`), sorted by due date ascending so the overdue surface first.
- `GET /admin/training/{id}` — one enrollment with the caregiver and course joined.
- `POST /admin/training` — assign a course to a caregiver, writing an audit entry. The caregiver-facing enroll route is `POST /training/courses/{id}/complete` area in `backend/app/api/routes/training.py:68`; the admin assignment path does not exist.
- The `admin/TrainingPage.jsx` screen: a compliance table with an overdue-first default, plus an assign form.

`due_at` arrives with plan 006. Until that migration lands this screen can sort by `enrolled_at` instead, but shipping it after 006 is the intended order.

**Read-only is the default.** An administrator should not be able to mark a caregiver's training complete. The compliance record is evidence, and the person who attests to having completed a course is the caregiver. Completion by proxy needs an explicit override with a reason, or it should not exist.

## Settings

There is no settings API. The two adjacent surfaces are near-empty: `backend/app/api/routes/services.py` and `forms.py` are 8 lines each returning placeholders.

The genuinely useful settings surface for this platform is the **per-state document requirement matrix**. `document_requirements` is RLS-writable at `supabase/migrations/20260924101600_rls_policies.sql:256-258` but no route exposes it, so the compliance data that plan 002's suspension checks and plan 006's client requirements both depend on can only be changed by direct SQL.

Build:

- `GET /admin/settings/document-requirements` — the matrix for the administrator's state, grouped by role.
- `PUT /admin/settings/document-requirements` — toggle a requirement, writing an audit entry with old and new values.
- The `admin/SettingsPage.jsx` screen: a checklist per state per role.

Both routes use `require_admin_scoped`, so a state administrator edits only their own state's matrix and cannot reach another state's — which is the whole point of keeping state as data rather than code.

**Requirement changes are compliance data.** An administrator removing a required document type is changing what legally counts as credentialed. Consider requiring a reason on the audit entry, as the caregiver application rejection path does at `admin.py:208`. Confirm with the agency whether some changes should instead require `super_admin`.

Confirm the required sets with the agency before seeding. This is plan 006 section E's dependency; seed once, from the same conversation.

## Routing

`AppRoutes.jsx:116,120,121` currently mounts three pages that do nothing. Remove the Training and Settings routes from the public route table until each screen exists, and add them back as each lands. Keep the Users route, because plan 002 fills it.

An 8-line stub that renders TODO is worse than a 404, because a 404 tells staff the feature does not exist and a stub tells them it is broken.

## Database

- **Migration:** none of its own. Depends on `20260929120000_training_reminders_and_client_requirements.sql` from plan 006 for `for_role`.
- **Seed data:** the requirement matrix, seeded once in `supabase/seeds/02_document_requirements.sql` for both roles and all three states, confirmed with the agency.
- **Rollback path:** revert routes and pages. The route removal is safe at any point.
- **Production verification:** change one requirement through the API, then confirm the caregiver credential status output and the client requirements output both reflect the change. That cross-check is the point of the screen.

## Tests

New `backend/tests/test_admin_settings.py`.

- A state administrator reads and updates their own state's matrix.
- A state administrator is denied another state's matrix, by id and in the list.
- `super_admin` may read and update all states.
- An unscoped `administrator` is denied.
- A caregiver is denied.
- Every requirement change writes an audit entry with the old and new value.
- Training list is state-scoped and returns only the permitted states' caregivers.
- Training list filters correctly by course, caregiver, and status.
- Training list sorts overdue first.
- An administrator cannot mark another user's training complete.
- Assignment writes an audit entry and stamps `due_at` from the course validity.

## Deliverable tracker

- [x] A. Training and Settings routes verified in `AppRoutes.jsx`
- [x] B. Required document set confirmed with the agency
- [x] C. `GET /admin/training` and detail, state-scoped
- [x] D. Admin training assignment endpoint with an audit entry
- [x] E. `admin/TrainingPage.jsx` built, overdue-first
- [x] F. Document requirements read and update endpoints
- [x] G. `admin/SettingsPage.jsx` built as a per-state checklist
- [x] H. Routes mounted in `AppRoutes.jsx` and nav in `AdminLayout.jsx`
- [x] I. `tests/test_admin_settings.py`
- [x] J. Verify: `pytest -q`, `compileall`, `npm.cmd run lint`, `npm.cmd run build`
