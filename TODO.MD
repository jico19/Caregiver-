# TODO — SOW Compliance Backlog

Audit of the codebase against **`Scope of work.md`** (states covered: FL / IN / GA).
**Verdict: ~75% of the SOW is implemented.** Core v1 flows (3-state site → caregiver application → admin review → documents/training) are real and tested, plus caregiver & client portal gaps (packets, e-sign, reminders, announcements, client care plan/schedule). The gaps below are the SOW items that remain missing or stubbed.

Legend: ✅ done · ⚠️ partial · ❌ not built

---

## 1. Public site (3 states) — ✅ MATCHES

- [x] Unified platform, switcher between Florida / Indiana / Georgia
- [x] State-specific services / forms / licensing / careers — served live per state via `/states/{slug}/...` (`frontend/src/pages/public/*`, `backend/app/api/routes/states.py`)
- [x] Contact forms write to `client_referrals` (`states.py:98-109`)

## 2. Caregiver Portal — ✅ IMPLEMENTED

- [x] Online application — public apply + authenticated submit / resubmit / review lock (`caregivers.py`, `ApplicationPage.jsx`)
- [x] Document upload — **10** of the 11 SOW document categories seeded (`seed.sql:22-31`); missing the generic **"Other"** catch-all type (only remaining gap in this section)
- [x] Training courses + completion progress (`training.py`, `TrainingPage.jsx`)
- [x] **Employment packet download** — `packetUrl()` in `utils/packets.js`; buttons on `ApplicationPage.jsx` + `DashboardPage.jsx`; placeholder PDFs in `public/packets/*-Employment-Packet.pdf`
- [x] **Electronic signatures** — drawn canvas e-signature (`SignaturePad.jsx`) on the caregiver application
- [x] **Credential expiry reminders** — `jobs/credential_reminders.py` (in-app, idempotent) wired into lifespan
- [x] **Dashboard "Expired / Expiring Soon / Missing Documents" panels** — `DashboardPage.jsx` Credential Compliance card with counts + names
- [x] **Training certificate download** — printable `TrainingCertificatePage.jsx` via `/training/courses/{id}/certificate`
- [x] **Company announcements** — admin CRUD (`AnnouncementsPage.jsx`, `admin.py`) + latest-3 feed on caregiver dashboard (`/caregivers/me/announcements`)

## 3. Client Portal — ✅ IMPLEMENTED

Implemented:
- [x] Online intake (`IntakePage.jsx`) — e-signed (drawn signature stored on `clients`)
- [x] Document upload (client doc types seeded in `seed.sql:32-37`)
- [x] Authorization list with days-remaining, expiring_soon/expired computed (`clients.py`)
- [x] **Forms page** — `client/FormsPage.jsx`: admission packet download + state-forms link + e-sign agreements (`/clients/me/agreements`)
- [x] **Download admission packet** — FL/IN/GA placeholder PDFs in `frontend/public/packets/*-Admission-Packet.pdf`
- [x] **Electronic signatures** — intake consent + care agreement / client rights (`client_agreements` table)
- [x] **Upload new authorizations** — client self-service `POST /clients/me/authorizations` → `pending` → admin Approve/Reject flow
- [x] **Authorization history** — `GET /clients/me/authorizations` includes `source` + review dates; client page shows Source / View document
- [x] **Expiry reminders** — `jobs/authorization_reminders.py` (in-app, idempotent) wired into lifespan
- [x] **Care plan** — DB-backed `care_plans` + `care_plan_activities`; admin edit via real `ClientDetailPage.jsx`
- [x] **Schedule** — DB-backed `care_schedules`; admin add/delete via `ClientDetailPage.jsx`
- [ ] **Secure messaging with agency** (optional in SOW — not built)

## 4. Administrator Dashboard — ❌ MOSTLY STUBS

Implemented:
- [x] Dashboard KPIs per state (`admin.py:54-88`)
- [x] Caregiver review queue + detail (approve / under_review / onboarding / reject-with-reason) (`admin.py`)
- [x] Document approval queue (`admin.py`, `DocumentsPage.jsx`)
- [x] Clients roster, authorizations issue + list, audit logs (`admin.py`)
- [x] **Referrals inbox** — `GET/PATCH /admin/referrals` (paginated, status/state filters, status workflow w/ audit) + real `ReferralsPage.jsx` (nav-linked)

Stubbed — literally `<p>TODO: implement</p>`:
- [ ] **`ReportsPage.jsx`** — ALL 6 SOW reports: caregiver compliance, expiring credential, in-service completion, client authorization, referral source, website inquiry
- [ ] **`TrainingPage.jsx`** — admin training oversight / reporting
- [ ] **`UsersPage.jsx`** — account management
- [ ] **`SettingsPage.jsx`**
- [ ] **`ClientDetailPage.jsx`** ⚠️ _shipped_ — see next line
- [x] **Client detail** — real `ClientDetailPage.jsx` (client info, care-plan editor, schedule add/delete), linked from ClientsPage rows
- [ ] Admin "Send reminders" action — no feature (caregiver management, SOW §4)
- [ ] Track missing documents per caregiver (no aggregate view)
- [ ] Monitor service start dates

## 5. Automation — ❌ NOT BUILT

Nothing here exists; everything relies on in-app `notify()`.
- [ ] Email notifications
- [ ] SMS reminders
- [ ] Expiring-credential alerts
- [ ] Authorization-expiration alerts
- [ ] Training reminders / overdue-training alerts
- [ ] New-referral notifications
- [ ] Document-upload confirmations
- [ ] Electronic signature workflow

## 6. Security & Compliance — ⚠️ PARTIAL

- [x] Role-based access control (`dependencies.py:51-67`)
- [x] Audit logs (`admin.py:407-418`)
- [x] Secure document storage — Supabase Storage with signed download URLs (`documents.py`)
- [x] Electronic signatures — drawn signatures on caregiver application, client intake consent, care agreement & client rights (`client_agreements`)
- [x] HIPAA enforcement — "HIPAA-compliant" asserted in copy; PHI access relies on generic audit logs (no PHI-field-specific logging)

---

## Suggested priority order

1. ~~Reports page~~ — **DONE** (`GET /admin/reports` in `admin.py` returns all 6 SOW reports + `ReportsPage.jsx`)
2. **Remaining admin stubs** — `TrainingPage.jsx` (oversight/reporting), `UsersPage.jsx`, `SettingsPage.jsx`, "Send reminders" action, missing-documents aggregate, service start-date monitor
3. ~~Referrals → admin workflow~~ — **DONE** (`GET/PATCH /admin/referrals` + `ReferralsPage.jsx`)
4. ~~Replace hardcoded client schedule & care plan with DB-backed records~~ — **DONE** (`care_plans`, `care_plan_activities`, `care_schedules`, admin `ClientDetailPage.jsx`)
5. ~~Client Forms page + admission packet downloads~~ — **DONE**
6. ~~E-signature workflow~~ — **DONE** (caregiver application + client intake consent/care agreement/client rights)
7. ~~Credential-expiry + authorization-expiry reminder jobs + announcements~~ — **DONE** (`credential_reminders.py`, `authorization_reminders.py`, `AnnouncementsPage.jsx`)
8. Add **"Other" document type** to `seed.sql` (caregiver catch-all, trivial)
9. Email/SMS provider integration (post-MVP; requires outbound provider)

## Reference files
- `Scope of work.md` — the source spec
- `backend/app/api/routes/admin.py` — referrals inbox + aggregate reports endpoint
- `backend/app/utils/notifications.py` — in-app only
- `backend/database/seed.sql` — 10 caregiver doc types, no "Other" type
- `frontend/src/pages/admin/*` — `TODO: implement` stubs (Training, Users, Settings)