# TODO — SOW Compliance Backlog

Audit of the codebase against **`Scope of work.md`** (states covered: FL / IN / GA).
**Verdict: ~60% of the SOW is implemented.** Core v1 flows (3-state site → caregiver application → admin review → documents/training) are real and tested. The gaps below are the SOW items that are missing, stubbed, or served with mock data.

Legend: ✅ done · ⚠️ partial · ❌ not built

---

## 1. Public site (3 states) — ✅ MATCHES

- [x] Unified platform, switcher between Florida / Indiana / Georgia
- [x] State-specific services / forms / licensing / careers — served live per state via `/states/{slug}/...` (`frontend/src/pages/public/*`, `backend/app/api/routes/states.py`)
- [x] Contact forms write to `client_referrals` (`states.py:98-109`)

## 2. Caregiver Portal — ⚠️ PARTIAL

Implemented:
- [x] Online application — public apply + authenticated submit / resubmit / review lock (`caregivers.py`, `ApplicationPage.jsx`)
- [x] Document upload — **10** of the 11 SOW document categories seeded (`seed.sql:22-31`); missing the generic **"Other"** catch-all type
- [x] Training courses + completion progress (`training.py`, `TrainingPage.jsx`)
- [x] Onboarding status / dashboard (:not all, see missing items below)

Missing:
- [ ] **Download employment packet** — no feature anywhere
- [ ] **Electronic signatures** — no e-sign code (only mentioned as "advanced" in `Gemini.MD:1148`)
- [ ] **Email / SMS notifications** — `notifications.py` is in-app only (8 lines, insert row only)
- [ ] **Credential expiry reminders** — no job scans `documents.expiration_date`
- [ ] **Dashboard "Expired / Expiring Soon / Missing Documents" panels** — current `DashboardPage.jsx` shows milestone progress + doc count only
- [ ] **Training certificate download** — `TrainingPage.jsx` has Enroll / Mark-Complete only
- [ ] **Company announcements** — dashboard quick-link mentions it; nothing behind it

## 3. Client Portal — ⚠️ PARTIAL

Implemented:
- [x] Online intake (`IntakePage.jsx`)
- [x] Document upload (client doc types seeded in `seed.sql:32-37`)
- [x] Authorization list with days-remaining, expiring_soon/expired computed (`clients.py:102-135`)

Issues:
- [ ] **Forms page is a stub** — `client/FormsPage.jsx:5` = `TODO: implement`
- [ ] **Download admission packet** — no feature
- [ ] **Electronic signatures** — no feature
- [ ] **Upload new authorizations** — client page is read-only; only admin can issue
- [ ] **Authorization history** — partial (list sorted by end date; no dedicated history view)
- [ ] **Care plan is hardcoded mock data** — `clients.py:148-161` returns a fixed dict, not from DB
- [ ] **Schedule is hardcoded mock data** — `clients.py:176-183` returns `sample_schedule`, not from DB
- [ ] **Secure messaging with agency** (optional in SOW — not built)

## 4. Administrator Dashboard — ❌ MOSTLY STUBS

Implemented:
- [x] Dashboard KPIs per state (`admin.py:54-88`)
- [x] Caregiver review queue + detail (approve / under_review / onboarding / reject-with-reason) (`admin.py`)
- [x] Document approval queue (`admin.py`, `DocumentsPage.jsx`)
- [x] Clients roster, authorizations issue + list, audit logs (`admin.py`)

Stubbed — literally `<p>TODO: implement</p>`:
- [ ] **`ReferralsPage.jsx`** — SOW "review online referrals": leads ARE captured to `client_referrals` (`states.py:109`) but there is **no admin endpoint/page to see them**
- [ ] **`ReportsPage.jsx`** — ALL 6 SOW reports: caregiver compliance, expiring credential, in-service completion, client authorization, referral source, website inquiry
- [ ] **`TrainingPage.jsx`** — admin training oversight / reporting
- [ ] **`UsersPage.jsx`** — account management
- [ ] **`SettingsPage.jsx`**
- [ ] **`ClientDetailPage.jsx`**
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
- [ ] **Electronic signatures**
- [ ] **HIPAA enforcement** — "HIPAA-compliant" asserted in copy; no PHI-specific access logging beyond generic audit logs

---

## Suggested priority order

1. **Referrals → admin workflow** (data exists, zero UI) — closes a full SOW section cheaply
2. **Reports page** — all 6 SOW reports; many are simple aggregates already available via existing endpoints
3. **Replace hardcoded client schedule & care plan** with DB-backed records (currently fake data in production-looking UI)
4. **Credential-expiry reminder job** (in-app + baseline for email/SMS)
5. **Client Forms page + employment/admission packet downloads** (static PDF assets)
6. **E-signature workflow** (largest lift; confirmed with client before scoping)
7. Email/SMS provider integration + announcements

## Reference files
- `Scope of work.md` — the source spec
- `backend/app/api/routes/clients.py` — hardcoded care plan (148-161), hardcoded schedule (176-183)
- `backend/app/api/routes/states.py` — contact → `client_referrals` (98-116)
- `backend/app/api/routes/admin.py` — no referrals/reports endpoints
- `backend/app/utils/notifications.py` — in-app only
- `backend/database/seed.sql` — 10 caregiver doc types, no "Other" type
- `frontend/src/pages/*/…` — `TODO: implement` stubs (client Forms; admin Referrals, Reports, Training, Users, Settings, ClientDetail)