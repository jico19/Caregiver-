# Plan 005 — Caregiver to Client Assignment

**Status:** Planned
**Closes:** the audit finding that an approved caregiver cannot see the clients they serve. This is the largest structural gap in the platform.
**Depends on:** 001 (soft deletion), 003, 004
**Blocks:** nothing, but the platform is not operational without it

## Problem

An approved caregiver logs in and sees only their own onboarding paperwork. They cannot see who they serve, what care a client needs, or when they are due to visit.

This is not a missing feature. **There is no link between a caregiver and a client anywhere in the database.** Every client-owned table keys on `client_id` and has no `caregiver_id` column:

| Table | Client key | Caregiver column | Reference |
|---|---|---|---|
| `care_plans` | `client_id` | none | `20260924101800_care_plan_schedule.sql:10` |
| `care_plan_activities` | `care_plan_id` | none | same file |
| `care_schedules` | `client_id` | none | same file:39 |
| `authorizations` | `client_id` | none | `20260924101138_initial_schema.sql:351` |
| `client_agreements` | `client_id` | none | `20260924101700_client_portal_gaps_iter1.sql:17` |

`caregiver_id` appears on `caregiver_applications` and `training_enrollments` only — application and training, never service delivery.

The consequence is total. A caregiver is credentialed, approved, and then has no way to receive the work they were hired for. The only place care plans and schedules are visible at all is the admin console, so the person actually providing the care cannot read the plan they are meant to follow.

**This is a rostering gap, not a viewing gap.** The agency cannot assign a client to a caregiver in the first place. Client demand and caregiver supply exist in the system and cannot be joined.

## Scope

Deliberately phased so the schema and access rules land and verify before any UI is built. Phase A is the part that matters; Phase B is the part people notice.

### Phase A — schema and authorization

**Migration** `supabase/migrations/20260929110000_caregiver_client_assignment.sql`:

```sql
ALTER TABLE care_plans
  ADD COLUMN caregiver_id UUID REFERENCES caregivers(id);
ALTER TABLE care_schedules
  ADD COLUMN caregiver_id UUID REFERENCES caregivers(id);
ALTER TABLE authorizations
  ADD COLUMN caregiver_id UUID REFERENCES caregivers(id);

CREATE TABLE caregiver_client_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES clients(id)   ON DELETE CASCADE,
  role         VARCHAR(40) NOT NULL DEFAULT 'primary',
  assigned_by  UUID NOT NULL REFERENCES users(id),
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  UNIQUE (caregiver_id, client_id)
);

CREATE INDEX idx_assignments_caregiver ON caregiver_client_assignments(caregiver_id) WHERE ended_at IS NULL;
CREATE INDEX idx_assignments_client    ON caregiver_client_assignments(client_id)    WHERE ended_at IS NULL;
```

A separate assignment table rather than a bare `caregiver_id` on each client-owned table, because a client can have several caregivers — a primary, a backup, a relief — and because assignment history has to survive a caregiver leaving. `ON DELETE CASCADE` from `caregivers` means the retention work in 001 cleans up assignments automatically.

The `caregiver_id` columns on the three tables are the *scheduled* caregiver for that specific record, distinct from the overall relationship.

**New backend access.** `AdminScope` and `scope_query` in `backend/app/core/dependencies.py` cover state. Caregiver ownership is a second, orthogonal boundary, so it needs a separate dependency that resolves the caller's own caregiver row and restricts queries to assigned `client_id` values. Add it beside the existing guards rather than extending them, so the state rules stay readable.

Endpoints:

| Endpoint | Guard | Purpose |
|---|---|---|
| `GET /caregivers/me/clients` | `require_caregiver` | The caregiver's own assigned clients. |
| `GET /caregivers/me/clients/{id}/care-plan` | `require_caregiver` | Read-only care plan for an assigned client. |
| `GET /caregivers/me/clients/{id}/schedule` | `require_caregiver` | Read-only visit schedule. |
| `POST /admin/clients/{id}/assignments` | `require_admin_scoped` | Assign a caregiver, with a role. |
| `DELETE /admin/clients/{id}/assignments/{cid}` | `require_admin_scoped` | End an assignment. Sets `ended_at`; never hard-deletes. |

**Caregivers get read-only access to client clinical records.** They may not edit a care plan, edit a schedule, or read client intake or agreement signatures. An assignment grants visibility of the care they deliver, not authorship of it. Document that decision here, because it is the kind of boundary that gets quietly widened later.

**RLS.** The `care_plans` and `care_schedules` policies (`20260924101800_care_plan_schedule.sql:64,94`) currently admit `client_id = auth.uid() OR app_has_role('administrator')`. Add a predicate for an active assignment. Follow `supabase/RUNBOOK.md`; this is defense in depth behind the backend guard, not a replacement for it.

### Phase B — caregiver portal

- `frontend/src/layouts/CaregiverLayout.jsx`: a "My Clients" nav entry.
- New `frontend/src/pages/caregiver/ClientsPage.jsx`: the roster.
- New `frontend/src/pages/caregiver/ClientCarePlanPage.jsx`: read-only plan and activities.
- New `frontend/src/pages/caregiver/ClientSchedulePage.jsx`: read-only visit schedule.
- `frontend/src/routes/AppRoutes.jsx`: mount under `/caregiver`.
- Reuse the existing `SignaturePad`-free read-only patterns and the design tokens; no new color vocabulary.

### Phase C — admin assignment UI

- `frontend/src/pages/admin/ClientDetailPage.jsx`: an assignment panel listing current caregivers with a role and an end-assignment action, plus an add form.
- `frontend/src/pages/admin/CaregiverDetailPage.jsx`: show which clients this caregiver serves, so the two sides of the relationship are both visible.

## Database

- **Migration:** `supabase/migrations/20260929110000_caregiver_client_assignment.sql`
- **Seed data:** optionally extend `supabase/seeds/03_care_plan_demo.sql` with demo assignments so the caregiver roster is not empty on a fresh seed.
- **Rollback path:** forward-only. The `caregiver_id` columns are nullable and the assignment table is standalone, so reverting the code leaves both inert and nothing depends on them. `ON DELETE CASCADE` on the assignment table means a caregiver deletion in plan 002 cleans it up either way.
- **Production verification:** after the RLS policy push, verify with a real caregiver token that an assigned client's care plan returns and an unassigned client's returns nothing. A policy that is too narrow fails silently — the query simply returns empty — so this must be checked with a positive case, not only a negative one.

## Tests

New `backend/tests/test_caregiver_assignments.py`, following the style of `backend/tests/test_state_scoping.py`.

- A caregiver sees their own assigned client.
- A caregiver is denied another caregiver's client, by id and in the list.
- A client with no assignment is invisible to every caregiver.
- An ended assignment is not returned.
- A caregiver is denied write access to a care plan and a schedule. This is the important negative case.
- A caregiver is denied client intake data and agreement signatures.
- A state administrator can assign and end assignments in their own state.
- A state administrator is denied assignment changes in another state.
- `super_admin` may assign across states.
- An unscoped `administrator` is denied.
- Assignment and end-assignment both write audit entries.
- An ended assignment retains its history row.

## Rollback

Revert the routes, the frontend pages, and the RLS policy. The additive columns and the assignment table may stay in place; they are inert once nothing reads them.

## Review note

This is the largest plan in the set. It touches four tables, a new authorization boundary, RLS policy changes, new endpoints, and new screens. Phase A is separable from Phase B if a smaller review is wanted — the schema and access rules can ship and verify on their own, with the caregiver UI following.

## Deliverable tracker

- [ ] A. Migration written and `--dry-run` reviewed
- [ ] B. Caregiver ownership dependency added beside `AdminScope`
- [ ] C. Read-only caregiver endpoints, with write access denied
- [ ] D. Admin assignment endpoints
- [ ] E. RLS policies updated, verified with a positive and a negative case
- [ ] F. `tests/test_caregiver_assignments.py`
- [ ] G. Caregiver roster, care plan, and schedule pages
- [ ] H. Admin assignment panel on both detail pages
- [ ] I. Demo assignments in `supabase/seeds/03_care_plan_demo.sql`
- [ ] J. Verify: `pytest -q`, `compileall`, `npm.cmd run lint`, `npm.cmd run build`
