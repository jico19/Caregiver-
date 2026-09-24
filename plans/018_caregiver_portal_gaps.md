# Plan 018 — Caregiver Portal SOW Gap Closure (Iteration 1)

**Source spec:** `Scope of work.md` §2 (Caregiver Portal)
**Audit reference:** `TODO.md` §2
**Status:** Approved — implementation ready to start

## Scope

- **In this round:** employment packet download (button + placeholder), drawn canvas e-signature on caregiver application, credential expiry dashboard panels, in-app credential expiry reminders, printable training certificate, company announcements (admin CRUD + caregiver dashboard).
- **In-app only:** no email, no SMS. Manual expiry-date entry stays (no OCR — no sample documents yet).

## Decisions locked (from clarifications)

1. **E-signature method:** drawn canvas signature pad (self-built, no DocuSign).
2. **E-signature location:** caregiver application attestation at submit/resubmit (drawn image + typed name). Client-intake consent = follow-up, not this round.
3. **Employment packet:** build buttons + placeholder PDFs now; real PDFs dropped in later (file replace only, no code change).
4. **Training certificate:** include — simple printable certificate page (browser Print → PDF), no new PDF library.
5. **Announcements:** admin CRUD + latest-3 feed on caregiver dashboard.

## Deliverables

### A. Employment packet download
1. `frontend/public/packets/FL-Employment-Packet.pdf` (+ `IN-`, `GA-`) — minimal placeholder PDFs.
2. "Download Employment Packet" buttons on `ApplicationPage.jsx` + public `CareersPage.jsx` → `/packets/<STATE>-Employment-Packet.pdf` (slug → FL/IN/GA map).
3. Swapping real PDFs = overwrite files only.

### B. Drawn canvas e-signature
1. New `frontend/src/components/common/SignaturePad.jsx` — canvas, mouse/touch draw, Clear/Redo, exports PNG data-URL.
2. `ApplicationPage.jsx` — signature section, required on submit/resubmit (image + typed name).
3. Migration: `caregiver_applications` += `signature_data TEXT`, `signed_at TIMESTAMPTZ`, `signed_name VARCHAR(200)`.
4. Backend (`caregivers.py` + schemas): `apply-public`, `applications`, `applications/resubmit` accept `signature_data` + `signed_name`; 400 if missing; write `audit_logs` entry `caregiver_application_signed`.
5. Tests: missing signature → 400; present → persisted + audit logged.

### C. Credential expiry panels + in-app reminders
1. Migration: seed `document_requirements` per state from the 10 caregiver doc types (table exists, currently empty); add `notifications.reference_id TEXT` for idempotent reminders.
2. Backend `GET /caregivers/me/credential-status` → `{ expired[], expiring_soon[], missing[], uploaded_count, required_count }`.
   - expired = `status='expired'` OR `expiration_date < today`
   - soon = `expiration_date` within 30 days
   - missing = required-for-state doc types with no uploaded row
3. Reminder engine `backend/app/jobs/credential_reminders.py` — `scan_due_credentials()` inserts in-app notifications (`credential_expiring` / `credential_expired`), deduped by `reference_id`. Started as a daily asyncio task in `main.py` `lifespan`. Note: runs while uvicorn is up.
4. `DashboardPage.jsx` — "Credential Compliance" card: Expired (red) / Expiring Soon (amber) / Missing (gray) panels with counts + names, link to `/caregiver/documents`.
5. Tests: status edge cases; reminder idempotency (run twice → 1 notification).

### D. Printable training certificate
1. Route `/caregiver/training/:courseId/certificate` → new `TrainingCertificatePage.jsx` — styled certificate (caregiver name, course name, completion date, issued-by), Print button (`window.print()`).
2. Guard: only for `enrollment_status === 'completed'`.
3. `TrainingPage.jsx` completed cards: "Download Certificate (PDF) →" link.
4. Data from existing `GET /training/my-enrollments` + `GET /training/courses` — no backend change.

### E. Company announcements
1. Migration: `announcements` table (`title`, `body`, `audience CHECK IN ('caregiver','client','all')`, `state_id` nullable, `is_active`, `created_by`, `created_at`, `updated_at`).
2. Backend: admin `GET/POST /admin/announcements`, `PATCH/DELETE /admin/announcements/{id}`; caregiver `GET /caregivers/me/announcements` (active; audience caregiver/all; state = own or null).
3. Frontend: `pages/admin/AnnouncementsPage.jsx` (list/create/edit/activate) + AdminLayout link; `DashboardPage.jsx` latest-3 card.

## Migration files
- `database/migrations/08_caregiver_signatures.sql` — signature columns
- `database/migrations/09_notifications_reference.sql` — `notifications.reference_id`
- `database/migrations/10_announcements.sql` — announcements table
- `database/migrations/11_document_requirements_seed.sql` — per-state requirement seed

## Tests (extend existing pytest baseline, fake Supabase in `conftest.py`)
- E-sign required/recorded (3 submit paths) + audit log
- `credential-status` (expired / soon / missing edge cases)
- Reminder idempotency
- Announcements CRUD + audience/state/active filtering
- Regression: all 15 existing tests stay green

## Verification
- `python -m pytest -q` (backend venv)
- `python -m compileall -q app tests`
- `npm.cmd run lint` + `npm.cmd run build`
- Manual smoke: apply → sign → submit → upload doc with near-expiry date → dashboard panels + reminder notification → admin creates announcement → caregiver dashboard shows it

## File map
**Backend:** `app/api/routes/caregivers.py`, `app/api/routes/admin.py`, `app/schemas/caregivers.py`, `app/jobs/credential_reminders.py` (new), `app/main.py`, migration files above, `tests/*`
**Frontend:** `components/common/SignaturePad.jsx` (new), `pages/caregiver/ApplicationPage.jsx`, `pages/caregiver/DashboardPage.jsx`, `pages/caregiver/TrainingPage.jsx`, `pages/caregiver/TrainingCertificatePage.jsx` (new), `pages/admin/AnnouncementsPage.jsx` (new), `layouts/AdminLayout.jsx`, `routes/AppRoutes.jsx`, `pages/public/CareersPage.jsx`, `public/packets/*.pdf`

## Resolved decisions
1. Include the `Other` catch-all document type (not required, `requires_expiration=false`).
2. Employment packet button on BOTH the public careers page and inside the caregiver portal.