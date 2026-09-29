# Plan 007 — Audit and Compliance Hardening

**Status:** Planned
**Closes:** `Scope of work.md:136-137` (audit logs, electronic signatures)
**Depends on:** 001 (soft deletion — an audit entry must never reference a hard-deleted row)
**Review weight:** highest in the set — this plan touches protected health information

## Context

`Scope of work.md:133` claims a HIPAA-compliant client portal. The code has real technical controls: audit logging, role-based access, row-level security on nineteen tables, a private storage bucket, and 60-second signed URLs. The programme *around* those controls does not exist, and the audit trail itself has defects that undermine the claim. This plan fixes the audit trail. It does not make the platform HIPAA compliant — no code change does that. A business associate agreement, a documented risk assessment, and a written retention and breach procedure remain outside the software entirely, and that distinction should be stated to the agency rather than implied away.

## Defect one — the audit trail records almost nothing about where an action came from

`audit_logs` has an `ip_address VARCHAR(45)` column at `initial_schema.sql:455`. It is never written. `record_audit_log` (`backend/app/api/routes/admin.py:93-112`) has no parameter for it, and a search across the whole backend for `request.client`, `ip_address`, or `user_agent` returns nothing. Every audit row in production has a null IP.

There is no `user_agent` column, no session identifier, and no request or correlation identifier. When a compliance question arises — who signed this, from where — the answer does not exist.

## Defect two — the audit trail can fail silently while an action still succeeds

`admin.py:111-112` catches the audit insert failure, logs a warning, and lets the operation return 200.

For most actions that is a defensible availability trade-off. For a signature it is not. A client can execute a legally binding electronic signature, and if the audit insert throws, the platform returns success and retains no evidence of it at all. Same for a caregiver application signature at `caregivers.py:150-157,271-278,304-311,408-415` and a client agreement signature at `clients.py:136-143,217-224`.

Signatures are the one write in the system that must be all-or-nothing with its audit entry.

## Defect three — re-signing destroys the original consent

`client_agreements` has a `version INTEGER NOT NULL DEFAULT 1` column (`20260924101700_client_portal_gaps_iter1.sql:21`). It is never incremented and never set by application code.

`POST /clients/me/agreements/{key}/sign` (`clients.py:201-210`) upserts on `(client_id, agreement_key)`, writing a fresh `body` snapshot from the Python constant `AGREEMENT_TEMPLATES` at `clients.py:43-54`.

So if an administrator edits an agreement template and a client signs again, the second write overwrites the first. The text the client originally consented to is gone. The version column exists to prevent exactly this and is doing nothing.

The same weakness applies to the caregiver application, which is a long multi-section form (`frontend/src/pages/caregiver/ApplicationPage.jsx:719-803`) with no version, no hash, and no frozen text at signing time. The signature is bound to a mutable row rather than to a document.

## Defect four — several sensitive writes leave no trace

Audited today: application review (`admin.py:236`), application signature, document review (`admin.py:389`), authorization create and review (`admin.py:717,788`), announcements (`admin.py:910,965,998`), referral status (`admin.py:1058`), client intake signature, client agreement signature.

Not audited, in rough order of exposure:

| Action | Location | Why it matters |
|---|---|---|
| Care plan update, including a full delete-and-replace of activities | `admin.py:498-557`, delete at `:547` | A clinical record. A replaced activity leaves no history of what it was. |
| Schedule create and delete | `admin.py:586-653` | Changes when a client is visited. |
| Training completion | `training.py:102-148` | Mints the certificate that compliance evidence is built from. |
| Training enrollment | `training.py:68-99` | |
| Document upload | `document_service.py:40-101` | The file lands in storage; only the later review is logged. |
| Client profile update | `clients.py:81-101` | Phone, address, Medicaid number. |
| Caregiver profile update | `caregivers.py:448-489` | Date of birth, address, SSN last four. |
| Client authorization upload | `clients.py:237-309` | Creates a document and an authorization row. |
| Public contact and referral submission | `states.py:85-113` | Unauthenticated, collects name, phone, email, and free-text notes. |
| Login, logout, failed login | `auth.py:9-36,101-103` | Absent entirely. `POST /auth/logout` is a no-op that returns a message and never revokes the token. |

## Defect five — the audit log is readable across state boundaries

`GET /admin/audit-logs` (`admin.py:829-848`) guards with `require_admin`, not `require_admin_scoped`, and the docstring explains why: `audit_logs` has no `state_id` column, so it cannot be scoped without a schema change.

A Florida administrator therefore reads audit entries for Georgia clients and caregivers, including the joined user email at `admin.py:843`. Every other admin route in the file is state-scoped. This one is not, and it is the endpoint most likely to contain sensitive detail.

## Scope

### A. Migration

`supabase/migrations/20260929130000_audit_hardening.sql`

```sql
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS user_agent     TEXT,
  ADD COLUMN IF NOT EXISTS request_id     UUID,
  ADD COLUMN IF NOT EXISTS entity_state_id INTEGER REFERENCES states(id);

CREATE INDEX idx_audit_state ON audit_logs(entity_state_id) WHERE entity_state_id IS NOT NULL;
```

`entity_state_id` is denormalised on purpose. Resolving state by joining through `users` at read time would break the moment a user is reassigned, and an audit entry must reflect the state boundary **at the time of the action**. Backfill it for existing rows where resolvable and leave the rest null, then exclude nulls from the scoped read rather than treating them as visible to everyone.

`request_id` gives one identifier that ties a log line, an audit row, and an error together. It also needs to be emitted from the request middleware, which `backend/app/middleware/logging.py` does not currently produce.

### B. Capture the actor properly

Extend `record_audit_log` to accept the request and derive `ip_address`, `user_agent`, and `request_id` from it. Thread a middleware-generated `request_id` through so it appears in both the log line and the audit row.

`ip_address` needs care: it comes from the request, which is client-controlled unless the deployment terminates TLS behind a proxy. Take the socket peer, and only trust `X-Forwarded-For` when an explicit trusted-proxy setting says to. Without that check the recorded address is whatever the caller sent.

### C. Fail closed for signatures only

Add a `required=True` mode to `record_audit_log` used by every signature path. On insert failure the endpoint returns 500 and the signature is not recorded. Keep the existing fail-open behaviour everywhere else, and say so in a comment, because availability versus evidence is a genuine trade-off and only one of them is right for a signature.

### D. Version the agreements

- Increment `client_agreements.version` on re-sign and key the row on `(client_id, agreement_key, version)` so each signature keeps its own snapshot.
- Add a history read route so the original consent text is retrievable.
- Store a SHA-256 hash of the exact text presented at signing, alongside the signature, so later alteration is detectable.
- Add `version` and `content_hash` to `caregiver_applications`, stamped once at signing and never updated, with a read route returning the text as presented.

### E. Audit the missing writes

Add calls for every row in the defect-four table. Training completion and the care plan replace are the two that matter most.

### F. Scope the audit read

Use the new `entity_state_id`. A state administrator sees rows for their state plus null-state rows only if a documented decision allows it. `super_admin` sees all. The `users(email)` join at `admin.py:843` must be removed or restricted for state administrators, because it re-widens the boundary through the join.

### G. Logout revokes

`POST /auth/logout` should revoke the refresh token rather than return a message. Confirm the mechanism available through the Supabase client in `backend/app/core/supabase.py` before designing this.

### H. Logging hygiene

`backend/app/middleware/logging.py:8-13` builds an f-string per request, so the format arguments are evaluated eagerly and the line carries no request id, no user, and no state. Move to lazy `%s` formatting and add the request id. No PII in log lines.

## Database

- **Migration:** `supabase/migrations/20260929130000_audit_hardening.sql`
- **Seed data:** none.
- **Rollback path:** forward-only, additive columns. Reverting the code leaves them inert. **The agreement version change is the one exception that is not freely reversible**: once multiple versions exist, reverting the unique key reverts to a design that overwrites consent on re-sign. If the reversion is required, take a backup of `client_agreements` first and treat the reversion as a data decision, not a code decision.
- **Production verification:** after push, confirm `entity_state_id` is populated for new rows and check how many historical rows backfilled. Then exercise one signature and confirm the audit row carries an IP. Then confirm a state administrator no longer sees another state's entries, which is the check most likely to catch a mistake in the null handling.

## Tests

New `backend/tests/test_audit_hardening.py`.

- `record_audit_log` writes the IP, user agent, and request id when a request is supplied.
- A spoofed `X-Forwarded-For` is ignored unless trusted proxy mode is on.
- A signature whose audit insert fails returns 500 and persists no signature.
- A non-signature write whose audit insert fails still succeeds, preserving the documented trade-off.
- Re-signing an agreement creates a second version and preserves the first `body`, `version`, and hash.
- A caregiver application signature freezes its content hash and the hash does not change on a later profile edit.
- Every action in defect four produces an audit row.
- Login, logout, and failed login each produce an audit row.
- A state administrator sees only their own state's audit rows, including via the list endpoint.
- A `super_admin` sees all states.
- Rows with a null `entity_state_id` behave as the documented decision requires, tested both ways so the choice is explicit rather than incidental.
- The user email join does not leak across states for a state administrator.

## Out of scope, and not fixed by any of this

No business associate agreement. No documented risk assessment. No access-log review procedure. No data retention or deletion schedule. No breach or incident procedure. No minimum-necessary split of administrator privileges — today one administrator per state can review credentials, approve authorizations, edit clinical care plans, and read every compliance report, which is far wider than any single role should hold. A real agency needs at least office staff, a nurse or RN for clinical sign-off, a scheduler, and a caregiver supervisor as distinct roles, and `roles` is already a data table (`initial_schema.sql:42-47`) so this is configuration rather than code.

Raise these with the agency as programme work. Do not let a passing test suite imply they are handled.

## Deliverable tracker

- [ ] A. Migration written and `--dry-run` reviewed
- [ ] B. `record_audit_log` captures IP, user agent, request id
- [ ] C. Trusted-proxy handling for `X-Forwarded-For`
- [ ] D. `required=True` fail-closed mode for signature paths only
- [ ] E. Agreement versioning with preserved history and content hash
- [ ] F. Caregiver application content frozen at signing
- [ ] G. Audit calls for all nine missing write paths
- [ ] H. Login, logout, and failed-login auditing; logout revokes
- [ ] I. `GET /admin/audit-logs` state-scoped; email join restricted
- [ ] J. Middleware request id and lazy logging
- [ ] K. `tests/test_audit_hardening.py`
- [ ] L. Verify: `pytest -q`, `compileall`, `npm.cmd run lint`, `npm.cmd run build`
- [ ] M. Programme gaps written to the agency: BAA, risk assessment, retention, breach procedure, role separation
