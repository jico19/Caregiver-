# Plan 004 — Referral Conversion

**Status:** Planned
**Closes:** `Scope of work.md:108-109` (review online referrals, approve admissions)
**Depends on:** 001 (soft deletion), 003 (needs `clients.status`)

## Problem

`PATCH /admin/referrals/{id}` (`backend/app/api/routes/admin.py:1030-1065`) accepts a status change and updates the row. That is the whole implementation.

Setting `status='converted'` therefore changes a label and nothing else. No `clients` row is created. No account is created. The office has to copy the person's name, phone, email, and notes from the referral table into the client intake form by hand, and then the two records drift apart permanently, because nothing links them.

The referral table is already carrying everything needed to pre-fill a client. `client_referrals` (`initial_schema.sql:320-332`) holds `first_name`, `last_name`, `phone`, `email`, `referral_source`, `notes`, and `state_id`. Converting is a copy, not an invention.

Two smaller problems sit alongside it:

- **No assignee and no notes from the office.** The status select is the only write available. There is no way to record who is handling the enquiry or what was discussed, so the next person to open it starts from zero.
- **The state filter is hardcoded to numeric IDs.** `frontend/src/pages/admin/ReferralsPage.jsx:21-25` filters on state IDs 1, 2, and 3 directly. Adding a fourth state means editing a component. This is the kind of state-specific hardcoding `agents.md` prohibits, and it is the only place in the codebase that does it.

## Scope

### A. Migration

`supabase/migrations/20260929100000_referral_conversion.sql`

```sql
ALTER TABLE client_referrals
  ADD COLUMN assigned_to  UUID REFERENCES users(id),
  ADD COLUMN handled_notes TEXT,
  ADD COLUMN converted_client_id UUID REFERENCES clients(id);

CREATE INDEX idx_referrals_assigned ON client_referrals(assigned_to);
```

`converted_client_id` is the durable link. Without it the converted client and the originating enquiry can never be reconciled, which is the exact drift this plan exists to remove.

### B. Conversion behaviour

Extend `PATCH /admin/referrals/{id}`. When the new status is `converted`:

1. Reject if `converted_client_id` is already set. Conversion is not repeatable — a second call is a 409, not a silent no-op, because two client records for one enquiry is precisely the failure being fixed.
2. Create a `users` row for the person if one does not already exist, matched on email. Reuse the existing account when the email matches rather than creating a duplicate login.
3. Create the `clients` row in `status='pending'`, carried over from plan 003, copying name, phone, address where present, and `state_id` from the referral. The referral's own `state_id` is authoritative here, because the referral arrived through the public endpoint for that state.
4. Set `converted_client_id` and stamp the conversion.
5. Write an audit entry recording the referral id, the new client id, and the acting administrator.
6. Notify the acting administrator that the client is waiting for admission approval.

**A client is not auto-approved.** Conversion produces a `pending` client, exactly as a manually entered intake would. Plan 003 owns the approval decision; this plan only produces the record for it.

### C. Enquiry handling

- `assigned_to` and `handled_notes` become writable on the same route.
- Add an "unassigned" filter and surface the assignee in the list.

### D. Frontend

- `frontend/src/pages/admin/ReferralsPage.jsx`: a Confirm dialog on `converted` that states plainly what will be created, the assignee column, the notes field, and an unassigned filter.
- Replace the hardcoded state ID array with the state list already available in `frontend/src/contexts/StateContext.jsx`.
- On successful conversion, show a link straight to the new client's detail page so the administrator can continue into admission.

## Database

- **Migration:** `supabase/migrations/20260929100000_referral_conversion.sql`
- **Seed data:** none.
- **Rollback path:** forward-only. The three added columns are nullable. Reverting the code leaves them inert. Already-converted referrals keep their `converted_client_id`, which is a correct record and should not be discarded.
- **Production verification:** convert one seeded referral through the API, confirm exactly one `clients` row appeared with `status='pending'`, confirm the audit row exists, then confirm a second conversion attempt returns 409.

## Tests

New `backend/tests/test_referral_conversion.py`, extending the existing coverage in `backend/tests/test_admin_referrals.py` rather than duplicating it.

- Converting creates exactly one `clients` row in `pending`.
- Converting reuses an existing user account when the email already matches, and creates a client against that account.
- Converting sets `converted_client_id` and writes an audit entry.
- Converting twice returns 409 and creates no second client.
- An invalid status returns 422, matching the existing validator at `admin.py:74`.
- A missing referral returns 404.
- A caregiver is denied.
- A state administrator cannot convert a referral in another state.
- `super_admin` may convert across states.
- An unscoped `administrator` is denied.
- Converting preserves the referral's `state_id` on the new client.
- `assigned_to` and `handled_notes` persist, and the unassigned filter returns the right set.

## Rollback

Revert the admin route and the frontend page. The migration is additive and forward-only.

## Deliverable tracker

- [ ] A. Migration written and `--dry-run` reviewed
- [ ] B. Conversion logic, including the 409 on repeat
- [ ] C. Account reuse on matching email
- [ ] D. `assigned_to` and `handled_notes` writes
- [ ] E. Hardcoded state ID array removed from `ReferralsPage.jsx`
- [ ] F. Confirm dialog on convert
- [ ] G. `tests/test_referral_conversion.py`
- [ ] H. Verify: `pytest -q`, `compileall`, `npm.cmd run lint`, `npm.cmd run build`
- [ ] I. Push to production and confirm one client per referral
