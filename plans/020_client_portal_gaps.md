# Plan 020 — Client Portal SOW Gap Closure

**Source spec:** `Scope of work.md` §3 (Client Portal)
**Audit reference:** `TODO.MD` §3
**Status:** Approved — split into two iterations

## Approach (decided)

Build in **two iterations**, delivered in that order:

- **Iteration 1 (THIS plan's main round):** self-contained, additive-only work — admission packet, e-signatures, authorization self-service + review + reminders, Forms page. No risky refactors; new columns/endpoints/pages only.
- **Iteration 2 (follow-up phase, marked below):** DB-backed care plan & schedule as one **atomic chunk** (tables + seed + admin `ClientDetailPage` + endpoint rewire together). Never wire the endpoints to new tables without the admin editing UI + seed in the same change, or the pages regress from mock data to empty.

## Scope

- **Iteration 1:**
  - A. Admission packet download (placeholder PDFs, mirrors caregiver employment packets from Plan 018)
  - B. Drawn-canvas e-signature (reuses `SignaturePad`): intake consent + care agreement / client-rights signing
  - D. Authorization self-service: client upload → `pending` auth record → admin approve/reject → in-app notification; authorization **history** view; **expiry reminders**
  - E. Client Forms page — replace the `<p>TODO</p>` stub (`FormsPage.jsx:5`)
- **Iteration 2 (follow-up):**
  - C. DB-backed care plan & schedule — new `care_plans` / `care_plan_activities` / `care_schedules` tables, seed test clients, rewrite `/clients/me/care-plan` and `/clients/me/schedule` to drop the hardcoded mocks (`clients.py:148-185`), build admin `ClientDetailPage.jsx` for entry.
- **Out of scope (both rounds):** email/SMS (in-app only, like Plan 018), secure messaging (optional in SOW), OCR/auto-expiry extraction.

## Decisions locked

1. **E-signature:** drawn canvas pad (`SignaturePad`, moved to `components/common/`). Intake consent stored on `clients`; agreements in a new `client_agreements` table.
2. **Intake re-save:** every `POST /clients/intake` requires a fresh signature (mirrors caregiver apply/resubmit in Plan 018). Confirmed acceptable.
3. **Authorization self-service:** upload creates a `pending` authorization with `document_id` + `source='client'`; admin approve → `active` (+ approve linked doc) / reject; client notified. No schema change to `status` (`pending`/`rejected` already allowed) — add `source`, `reviewed_at`, `reviewed_by`.
4. **Empty-state policy:** authorization/history endpoints return real (possibly empty) data — no mocks.

---

# ITERATION 1

## Deliverables

### A. Admission packet download
1. `frontend/public/packets/FL-Admission-Packet.pdf` (+ `IN-`, `GA-`) — minimal placeholders.
2. `frontend/src/utils/packets.js` += `admissionPacketUrl(code)` (mirrors `packetUrl`, different filename).
3. "Download Admission Packet" buttons on `client/DashboardPage.jsx`, `client/IntakePage.jsx`, and the new `client/FormsPage.jsx`. Swapping real PDFs = overwrite files only.

### B. Drawn canvas e-signature
1. Move `frontend/src/components/caregiver/SignaturePad.jsx` → `components/common/SignaturePad.jsx`; update caregiver imports.
2. Migration: `clients` += `signature_data TEXT`, `signed_name VARCHAR(200)`, `signed_at TIMESTAMPTZ`. New `client_agreements` table (`client_id`, `state_id`, `agreement_key`, `title`, `version`, `body`, `signature_data`, `signed_name`, `signed_at`, `UNIQUE(client_id, agreement_key)`).
3. Backend (`clients.py` + `schemas/clients.py`): copy `_validate_signature` from `caregivers.py:12-35`; `POST /clients/intake` requires `signature_data` + `signed_name` (400 if missing), stores them, audit `client_intake_signed`; `GET /clients/me/agreements` (templates + signed status); `POST /clients/me/agreements/{key}/sign` (upsert row, audit `client_agreement_signed`, notify `agreement_signed`).
4. Frontend: `IntakePage.jsx` SignaturePad (required on submit); `FormsPage.jsx` "Sign Forms" section.

### D. Authorization self-service + history + reminders
1. Migration: `authorizations` += `source VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (source IN ('admin','client'))`, `reviewed_at TIMESTAMPTZ`, `reviewed_by UUID`.
2. `clients.py` `POST /clients/me/authorizations` (multipart: file, start_date, end_date, notes optional): store document via `document_service.upload_document` (enforce document type = "Authorization Document"), insert `authorizations` row `status='pending'`, `source='client'`, `document_id`; notify `authorization_uploaded`.
3. `admin.py` `POST /admin/authorizations/{id}/review` (`approved|rejected`): flip auth status (+`reviewed_at/by`), approve/reject linked document, audit, notify client. `admin/AuthorizationsPage.jsx` += pending badge + Approve/Reject row actions.
4. **History:** `GET /clients/me/authorizations` augments records with `source`; client `AuthorizationsPage.jsx` adds an "Authorization History" section (source, review dates, document View File via `/documents/{id}/download-url`, grouped by status).
5. **Reminders:** new `jobs/authorization_reminders.py` — `scan_due_authorizations(supabase)` for ending ≤30 days or ended, idempotent via `reference_id` (copy of `credential_reminders.py`); second daily task wired in `main.py` lifespan.

### E. Client Forms page
1. Rewrite `FormsPage.jsx`: (1) admission packet download, (2) state forms via `/states/{slug}/forms`, (3) sign agreements via SignaturePad + signed-status list.
2. `ClientLayout.jsx` nav += "Forms"; `AppRoutes.jsx` += `/client/forms`.

## Migration files (Iteration 1)
- `database/migrations/11_client_portal_gaps_iter1.sql`

## Tests (Iteration 1)
- E-sign: intake missing signature → 400; present → persisted + audit; agreement sign → row upserted + audit + notify.
- Authorization: self-upload → pending auth + doc; admin approve → active + notification; reject path; history payload includes `source`.
- Authorization reminder idempotency (run twice → 1 notification).
- Regression: all existing tests stay green.
- `conftest.py`: patch `clients` route module (`get_supabase`, `notify`), add collections to `make_db()` (`authorizations`, `client_agreements`), mock `document_service.upload_document` for the upload test.

## Verification (Iteration 1)
`pytest -q` → `compileall` → `npm.cmd run lint` → `npm.cmd run build` → manual smoke per `TESTING_CHECKLIST.md` Group 3.

---

# ITERATION 2 (follow-up phase)

## Deliverables — one atomic chunk (do NOT ship pieces separately)

1. Migration: `care_plans` (`client_id`, `state_id`, `status`, `effective_date`, `primary_nurse`, `emergency_protocol`, `created_by`), `care_plan_activities` (`care_plan_id` FK cascade, `task`, `frequency`, `notes`, `sort_order`), `care_schedules` (`client_id`, `state_id`, `day_of_week`, `start_time`, `end_time`, `service`, `status CHECK ('scheduled','confirmed','completed','cancelled')`, `notes`, `sort_order`). RLS enabled (staff-only per migration `10` pattern). Seed `client.fl@caregiver.com` + `client.in@caregiver.com`.
2. Rewrite `GET /clients/me/care-plan` + `GET /clients/me/schedule` (drop mocks, keep response shapes, empty states).
3. New real admin `ClientDetailPage.jsx` + `admin.py` endpoints `GET /admin/clients/{id}`, `GET/PUT /admin/clients/{id}/care-plan`, `GET/POST/DELETE /admin/clients/{id}/schedule`. Link from `ClientsPage.jsx` rows.

## Tests (Iteration 2)
Empty client → empty payload (no mock); seeded → rows returned; admin care plan/schedule CRUD; regression.

## File map (Iteration 2)
**Backend:** `api/routes/clients.py`, `api/routes/admin.py`, `migrations/12_*.sql`, `tests/*`
**Frontend:** `pages/admin/ClientDetailPage.jsx` (rewrite), `pages/admin/ClientsPage.jsx`, `pages/client/CarePlanPage.jsx` (+empty state), `pages/client/SchedulePage.jsx` (+empty state)

---

## File map (Iteration 1)
**Backend:** `api/routes/clients.py`, `api/routes/admin.py`, `schemas/clients.py`, `jobs/authorization_reminders.py` (new), `main.py`, `migrations/11_client_portal_gaps_iter1.sql`, `tests/conftest.py`, `tests/test_client_portal_gaps.py` (new), `tests/test_authorization_reminders.py` (new)
**Frontend:** `components/common/SignaturePad.jsx` (moved), `components/caregiver/SignaturePad.jsx` (removed), `pages/client/FormsPage.jsx` (rewrite), `IntakePage.jsx`, `DashboardPage.jsx`, `AuthorizationsPage.jsx`, `pages/admin/AuthorizationsPage.jsx`, `utils/packets.js`, `layouts/ClientLayout.jsx`, `routes/AppRoutes.jsx`, `public/packets/*-Admission-Packet.pdf`

## Sequential build order (Iteration 1)
1. Migration file
2. Backend (schemas → clients.py → admin.py → job → main.py)
3. conftest + tests → `pytest -q` green
4. Frontend (SignaturePad move → packets → intake/forms → authorizations → admin review)
5. `compileall` → `lint` → `build` → manual smoke