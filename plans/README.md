# Implementation Plans

Plans record scoped work and its verification. Their status is not proof that production SQL was applied; confirm database work through `supabase/RUNBOOK.md`.

Numbering restarted at `001` on 2026-09-29. Plans `018` through `021` and their index were retired by decision; the numbering they used is not reused.

| Plan | Status | Purpose |
|---|---|---|
| `001_soft_deletion.md` | Implemented | Soft deletion across record tables. Stop the three hard deletes. |
| `002_offboarding_user_lifecycle.md` | Planned | Admin user management, suspension, and offboarding. |
| `003_client_admission_lifecycle.md` | Planned | Client admission status and service start date. |
| `004_referral_conversion.md` | Planned | Convert a referral into a pending client record. |
| `005_caregiver_client_assignment.md` | Planned | Link caregivers to clients and expose their roster. |
| `006_in_app_notifications.md` | Planned | Training reminders, admin referral alerts, client document requirements. |
| `007_audit_compliance_hardening.md` | Planned | Complete the audit trail and make signatures defensible. |
| `008_admin_stub_screens.md` | Planned | Build the admin Training and Settings screens. |
| `009_mobile_and_dashboard_content.md` | Planned | Mobile layout for the application and real dashboard content. |
| `010_data_retention_and_purge.md` | Planned | Statutory retention schedules, legal hold, and scheduled purge job. |

## Delivery order

`001` first. Soft deletion is a foundation, not a feature: every later plan writes to tables it touches, and plan 002 cannot offboard anyone safely until it exists. It also fixes a live defect — care-plan editing currently destroys clinical history on every save.

`002` next, because it is the smallest change with the largest risk reduction once `001` has landed, and it removes the ability for a terminated caregiver to keep a working login.

`003`, then `004`, then `005` form one continuous chain: a client must exist in a waiting state before a referral can convert into one, and both must happen before a caregiver can be attached to a client.

`006` and `007` are independent of that chain and can run in parallel. `007` carries the highest review weight because it touches protected health information.

`008` and `009` are quality passes with no blocking dependencies.

## Deferred, not gaps

- **Email and SMS notifications.** Deferred pending provider accounts and API keys. `Scope of work.md` lines 36, 123, and 124 remain open. `006` covers every notification that does not require an external provider.
- **Deployment configuration.** No server, container, or CI configuration exists in this repository. Tracked outside this plan set as separate infrastructure work. Nothing here depends on it, but nothing can be verified in production until it is done.

## Cross-cutting decisions made in this set

- **Nothing is hard-deleted.** `audit_logs` and `client_agreements` are excluded from soft delete entirely; a signed agreement accumulates versions and is never removed.
- **Supabase Auth accounts are never deleted by the application.** Access is revoked through `users.status` instead. This looks wrong until you know why, so the reason belongs in a code comment.
- **Retention is not erasure.** Soft deletion retains; a separate, deliberate `super_admin` action destroys. Retention periods and a purge job for records past them are a follow-up, recorded in `001_soft_deletion.md` section F.
- **Caregivers get read-only access to client clinical records** under `005`. An assignment grants visibility of the care they deliver, not authorship of it.

## Conventions

Use the next unused numeric prefix for a new plan. Keep one file per plan and update its status when work completes or is superseded. Every plan names its migration, seed data, tests, rollback path, and production verification.
