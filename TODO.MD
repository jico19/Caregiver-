# TODO

What is being built next, in delivery order. Plans live in `plans/`; this file is the short version.

Last updated 2026-09-29. Commit `80cff0f`.

## What this system is

A multi-state home care agency platform. Caregivers are credentialed and placed in client homes under Medicaid authorization. One codebase serves Florida, Indiana, and Georgia, with state as both data and an authorization boundary.

Today the platform is a **credentialing and intake system with an admin review console attached**. Caregiver onboarding is complete. The middle of the business — referral becomes client, client gets approved, caregiver gets attached — is what these plans build.

## The plan set

| # | Plan | Why | Status |
|---|---|---|---|
| 001 | [Soft deletion](plans/001_soft_deletion.md) | Editing a care plan destroys the previous version of every activity. Nothing is retained. | Planned |
| 002 | [Offboarding and user lifecycle](plans/002_offboarding_user_lifecycle.md) | A terminated caregiver keeps a working login. There is no way to remove anyone. | Planned |
| 003 | [Client admission lifecycle](plans/003_client_admission_lifecycle.md) | A client is fully active the instant they submit a form. No approval, no start date. | Planned |
| 004 | [Referral conversion](plans/004_referral_conversion.md) | Marking an enquiry "converted" only changes a label. The office retypes everything. | Planned |
| 005 | [Caregiver to client assignment](plans/005_caregiver_client_assignment.md) | No caregiver can see the clients they serve. The link does not exist in the database. | Planned |
| 006 | [In-app notifications](plans/006_in_app_notifications.md) | Nothing tells staff about training, new enquiries, or what a client owes. | Planned |
| 007 | [Audit and compliance hardening](plans/007_audit_compliance_hardening.md) | Signatures are not defensible. Re-signing destroys the original consent. | Planned |
| 008 | [Admin training and settings](plans/008_admin_stub_screens.md) | Two admin menu items go nowhere. Compliance data is only editable by SQL. | Planned |
| 009 | [Mobile and dashboard content](plans/009_mobile_and_dashboard_content.md) | The application is not laid out for a phone. Client dashboard shows links, not information. | Planned |

## Order

**001 first.** Not a feature — a foundation. Every later plan writes to a table it touches, and plan 002 cannot offboard anyone safely without it.

**002 next.** Removes the ability for a terminated caregiver to keep a working login.

**003 then 004 then 005.** One continuous chain. A client must exist in a waiting state before a referral can convert into one, and both must happen before a caregiver can be attached to a client.

**006 and 007 are independent** of that chain and can run in parallel. 007 carries the highest review weight because it touches protected health information.

**008 and 009** are quality passes with no blocking dependencies.

## Three things that are wrong right now, not merely missing

Worth stating plainly, because none of them shows up as a failing test:

- **Editing a care plan destroys its own history.** `PUT /admin/clients/{id}/care-plan` deletes every activity row and re-inserts the replacement (`admin.py:547`), unaudited. Change one activity in a plan and the previous wording is gone. A care plan is a medical document. Fixed by plan 001.
- **A client is told they have "3 Active" authorizations when the count includes expired and rejected ones** (`client/DashboardPage.jsx:81`, counting everything `clients.py:312-345` returns). A false statement on a healthcare record. Fixed by plan 009.
- **A client who signs an agreement twice loses the first version.** The version column exists at `20260924101700_client_portal_gaps_iter1.sql:21` and is never incremented. Fixed by plan 007.

## Rules this plan set sets

- **Nothing is hard-deleted.** Soft deletion everywhere; `audit_logs` and `client_agreements` are excluded entirely.
- **Auth accounts are never deleted by the application.** Access is revoked through `users.status`. Retaining clinical history is worth more than a tidy auth table.
- **Retention is not erasure.** Soft delete retains by default; destroying data is a separate deliberate action with a narrow guard.
- **Caregivers get read-only access to client clinical records.** Visibility of the care they deliver, not authorship of it.

## Deferred, not gaps

- **Email and SMS notifications.** Blocked on provider accounts and API keys. `Scope of work.md:36,123,124` stay open. Plan 006 delivers everything that does not need an external provider.
- **Deployment configuration.** No server, container, or CI configuration exists anywhere in the repository. Separate infrastructure work with its own decisions. Nothing in the plan set depends on it, but **nothing can be verified in production until it is done.**

## Needs a decision from the agency, not from us

Compliance data should not be guessed:

- Required document set per state, per role — needed by plans 006 and 008 before seeding.
- Whether existing clients should read as `pending` or `active` after the plan 003 migration. Defaulting to `pending` is the honest reading but will report current clients as awaiting approval.
- Whether required-hours validity applies to real training courses, for the plan 006 reminder window.
- Whether an administrator may mark another person's training complete. The compliance record is evidence; the default answer should be no.
- Retention periods per record type, and whether any obligation requires true erasure rather than retention. Follow-up from plan 001.

## Out of reach for code alone

`Scope of work.md:133` claims HIPAA compliance. The code has real controls — audit logging, role-based access, row-level security on nineteen tables, private storage, short-lived signed URLs. The programme around them does not exist and no code change creates it: no business associate agreement, no risk assessment, no retention schedule, no breach procedure, no access-log review, and no separation of administrator privileges. One administrator per state can currently review credentials, approve authorizations, edit clinical care plans, and read every compliance report.

Raise these as programme work. Do not let a green test suite imply they are handled.

## Verification order for any change

From the named subdirectory:

- Backend tests: `.\venv\Scripts\python.exe -m pytest -q`
- Backend compile: `.\venv\Scripts\python.exe -m compileall -q app tests`
- Frontend lint: `npm.cmd run lint`
- Frontend build: `npm.cmd run build`
- Database work: `npx supabase` from the repository root, per `supabase/RUNBOOK.md`, `--dry-run` read before every push, forward-only migrations.

Protected changes need allowed and denied cases for role, owner, state, and `super_admin`. `backend/tests/test_state_scoping.py` is the model.
