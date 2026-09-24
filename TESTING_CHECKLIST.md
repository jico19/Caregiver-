# Caregiver Platform MVP — Feature Testing Checklist

Run local servers before testing:
```powershell
# Terminal 1: Backend API (port 8000)
cd C:\Users\user\Documents\Caregiver\backend
.\venv\Scripts\uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend Web App (port 5173)
cd C:\Users\user\Documents\Caregiver\frontend
npm.cmd run dev
```

---

## Pre-Seeded Test Accounts
**Note**: Test-account passwords are not stored in this repository for security reasons. When seeding, set them via `SEED_TEST_PASSWORD` (or `app.seed_pwd` for `database/seed.sql`) — see the seed files.

| Role | Email | State | Context |
|---|---|---|---|
| **Administrator** | `admin@caregiver.com` | FL / All | Admin Operations, Verification, Logs |
| **Caregiver** | `caregiver.fl@caregiver.com` | FL | Florida Caregiver Portal & Training |
| **Caregiver** | `caregiver.in@caregiver.com` | IN | Indiana Caregiver Scoped Actions |
| **Caregiver** | `caregiver.ga@caregiver.com` | GA | Georgia Caregiver Scoped Actions |
| **Client** | `client.fl@caregiver.com` | FL | Florida Client Portal & Intake |
| **Client** | `client.in@caregiver.com` | IN | Indiana Client Portal & Authorizations |

---

## Group 1: Public State Website & Navigation
*Estimated time: 5 minutes | Base URL: `http://localhost:5173`*

- [ ] **State Redirection & Landing**: Open `http://localhost:5173/`. Verify redirect to `/florida`. Verify Florida services and statistics load.
- [ ] **State Switcher Preservation**: Navigate to `/florida/services`. Switch state to **Indiana** via header dropdown. Verify URL updates to `/indiana/services` with Indiana data.
- [ ] **Careers & Job Openings**: Visit `/:state/careers`. Verify job cards show compensation, requirements, and an "Apply Now" button redirecting to caregiver registration.
- [ ] **Forms & Licensing**: Visit `/:state/forms` and `/:state/licensing`. Verify regulatory disclosures display (AHCA for FL, FSSA for IN, DCH for GA).
- [ ] **Contact & Referral Inquiries**: Visit `/:state/contact`. Submit inquiry form and verify success message appears.

---

## Group 2: Caregiver Portal & Onboarding
*Estimated time: 7 minutes | Base URL: `http://localhost:5173/caregiver/login`*

- [ ] **Registration & Auth**: Register new caregiver account at `/caregiver/login`. Verify redirect to `/caregiver/dashboard`.
- [ ] **Application Submission**: Go to `/caregiver/application`. Complete personal info and submit. Verify status displays `Under Review`.
- [ ] **Document Upload**: Go to `/caregiver/documents`. Upload file for "Driver License" with expiration date. Verify status is `Pending Review`.
- [ ] **In-Service Training**: Open `/caregiver/training`. Complete course module and verify progress reaches 100%.
- [ ] **Notifications & Profile**: Visit `/caregiver/notifications` and `/caregiver/profile`. Verify system notifications and profile details update.

---

## Group 3: Client Portal & Care Coordination
*Estimated time: 7 minutes | Base URL: `http://localhost:5173/client/login`*

- [ ] **Login & Dashboard**: Sign in at `/client/login`. Verify dashboard shows assigned care team and active status.
- [ ] **Client Intake**: Navigate to `/client/intake`. Fill medical background, emergency contacts, and submit. Verify confirmation state.
- [ ] **Document Submission**: Go to `/client/documents`. Upload "Insurance Card" or "Physician Orders". Verify private upload record.
- [ ] **Authorization Tracking**: Visit `/client/authorizations`. Verify authorization hours, Medicaid/insurance ID, and expiry date indicators display.
- [ ] **Care Plan & Schedule**: Check `/client/care-plan` and `/client/schedule`. Verify assigned care tasks and weekly visit slots load.

---

## Group 4: Admin Operations & Compliance
*Estimated time: 10 minutes | Base URL: `http://localhost:5173/admin/dashboard`*

- [ ] **Admin Metrics**: Open `/admin/dashboard`. Verify total caregivers, clients, pending documents, and expiring authorizations load.
- [ ] **Caregiver Applicant Review**: Go to `/admin/caregivers`. Open an applicant, review details, and click `Approve` or `Reject`.
- [ ] **Document Verification**: Open `/admin/documents`. Review pending uploads and click `Approve` or `Reject` with review note.
- [ ] **Client & Authorization Management**: Visit `/admin/clients` and `/admin/authorizations`. Create or edit authorization record with valid date range.
- [ ] **Audit Trail & System Reports**: Open `/admin/audit-logs` and `/admin/reports`. Verify recent administrative actions and logins are chronologically logged.

---

## Group 5: Backend API & Security Verification
*Estimated time: 5 minutes | Base URL: `http://localhost:8000`*

- [ ] **Health Check**: Open `http://localhost:8000/health`. Verify JSON response: `{"status":"ok","version":"1.0.0"}`.
- [ ] **API Documentation**: Open `http://localhost:8000/docs`. Verify all `/api/v1/*` interactive endpoints render.
- [ ] **Invalid State Validation**: Call `GET /api/v1/states/invalidstate/services`. Verify API returns `404 Not Found`.
- [ ] **RBAC Protection**: Call `GET /api/v1/admin/caregivers` without Bearer token. Verify backend returns `401 Unauthorized`.
- [ ] **State Scoping Boundary**: Call Florida caregiver endpoints using an Indiana-scoped token. Verify backend returns `403 Forbidden`.
