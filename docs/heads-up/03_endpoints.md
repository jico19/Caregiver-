# API Endpoints Reference

Comprehensive reference of all FastAPI endpoints exposed under `/api/v1`.

---

## 1. Authentication & Session (`/api/v1/auth`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public | Validates user credentials with Supabase Auth; returns JWT and user profile. |
| `POST` | `/api/v1/auth/register` | Public | Creates a new user account. |
| `POST` | `/api/v1/auth/logout` | Authenticated | Invalidates session and clears cached user credentials. |
| `GET` | `/api/v1/auth/me` | Authenticated | Returns current authenticated profile, role, and assigned state ID. |

---

## 2. Public CMS & State Portals (`/api/v1/states`)

*All endpoints in this group are public (unauthenticated) for regional landing pages.*

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/states/` | List all active supported states. |
| `GET` | `/api/v1/states/{state}` | State overview and CMS content by slug (`florida`, `indiana`, `georgia`). |
| `GET` | `/api/v1/states/{state}/services` | Healthcare services offered in the specified state. |
| `GET` | `/api/v1/states/{state}/forms` | Downloadable public and client forms for the state. |
| `GET` | `/api/v1/states/{state}/licensing` | Regulatory and licensing disclosures for the state. |
| `GET` | `/api/v1/states/{state}/careers` | Public job openings for caregivers in the state. |
| `POST` | `/api/v1/states/{state}/contact` | Submits public inquiry; creates a `client_referrals` record. |

---

## 3. Caregiver Portal (`/api/v1/caregivers`)

*Requires role: `caregiver`, `administrator`, or `super_admin`.*

| Method | Path | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/caregivers/me` | caregiver | Retrieves personal profile data for the logged-in caregiver. |
| `PATCH` | `/api/v1/caregivers/me/profile` | caregiver | Updates contact details (phone, address). |
| `POST` | `/api/v1/caregivers/apply-public` | Public | Initial applicant registration using atomic transaction procedure. |
| `POST` | `/api/v1/caregivers/applications` | caregiver | Creates or updates draft caregiver application. |
| `GET` | `/api/v1/caregivers/me/application` | caregiver | Current status of application (`submitted`, `under_review`, `approved`, etc.). |
| `POST` | `/api/v1/caregivers/applications/resubmit` | caregiver | Resubmits rejected application with updated corrections and e-signature. |
| `GET` | `/api/v1/caregivers/me/documents` | caregiver | Lists all documents uploaded by this caregiver. |
| `GET` | `/api/v1/caregivers/me/credential-status` | caregiver | Evaluates compliance matrix against state requirements (CPR, License, TB). |
| `GET` | `/api/v1/caregivers/me/clients` | caregiver | Lists active clients assigned to this caregiver via `caregiver_client_assignments`. |
| `GET` | `/api/v1/caregivers/me/clients/{client_id}/care-plan` | caregiver | Reads approved care plan and activities for an assigned client. |
| `GET` | `/api/v1/caregivers/me/clients/{client_id}/schedule` | caregiver | Reads weekly service schedule for an assigned client. |
| `GET` | `/api/v1/caregivers/me/announcements` | caregiver | Regional announcements broadcast to caregivers in the assigned state. |
| `GET` | `/api/v1/caregivers/me/notifications` | caregiver | Personal alerts and reminders for the caregiver. |
| `PATCH` | `/api/v1/caregivers/me/notifications/{id}/read` | caregiver | Marks a specific notification as read. |
| `PATCH` | `/api/v1/caregivers/me/notifications/read-all` | caregiver | Marks all unread notifications as read. |

---

## 4. Client Portal (`/api/v1/clients`)

*Requires role: `client`, `administrator`, or `super_admin`.*

| Method | Path | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/clients/me` | client | Retrieves medical and insurance profile for the authenticated client. |
| `PATCH` | `/api/v1/clients/me/profile` | client | Updates contact details. |
| `POST` | `/api/v1/clients/intake` | client | Submits digital intake questionnaire with consent e-signature. |
| `GET` | `/api/v1/clients/me/agreements` | client | Lists required agreements (Care Agreement, Client Rights) for signing. |
| `GET` | `/api/v1/clients/me/agreements/{key}/history` | client | Historical signed versions of an agreement. |
| `POST` | `/api/v1/clients/me/agreements/{key}/sign` | client | Submits e-signature and generates cryptographic SHA-256 integrity hash. |
| `GET` | `/api/v1/clients/me/authorizations` | client | Lists prior authorizations on file. |
| `POST` | `/api/v1/clients/me/authorizations` | client | Client self-service upload of insurance approval documents. |
| `GET` | `/api/v1/clients/me/care-plan` | client | View active care plan and daily activities. |
| `GET` | `/api/v1/clients/me/schedule` | client | View scheduled caregiver shifts. |
| `GET` | `/api/v1/clients/me/document-status` | client | Compliance checklist of required intake documentation. |
| `GET` | `/api/v1/clients/me/notifications` | client | Personal client notifications and status updates. |
| `PATCH` | `/api/v1/clients/me/notifications/{id}/read` | client | Marks a client notification as read. |

---

## 5. Documents & Storage (`/api/v1/documents`)

| Method | Path | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/documents/types` | Authenticated | Lists all configured document types (`document_types`). |
| `GET` | `/api/v1/documents/me` | Authenticated | Lists all documents uploaded by the authenticated user. |
| `POST` | `/api/v1/documents/upload` | Authenticated | Uploads file to Supabase Storage bucket (`documents`) with metadata. |
| `GET` | `/api/v1/documents/{id}/download-url` | Authenticated | Generates a signed temporary download URL. Enforces ownership or admin scope. |

---

## 6. Training & Certifications (`/api/v1/training`)

| Method | Path | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/training/courses` | Authenticated | Lists available training courses and modules. |
| `GET` | `/api/v1/training/my-enrollments` | caregiver | Lists caregiver course enrollments, progress, and `due_at` deadlines. |
| `POST` | `/api/v1/training/courses/{id}/enroll` | caregiver | Enrolls caregiver in a course. |
| `POST` | `/api/v1/training/courses/{id}/complete` | caregiver | Marks a course as completed and sets `completed_at`. |
| `GET` | `/api/v1/training/courses/{id}/certificate` | caregiver | Generates dynamic PDF completion certificate using ReportLab. |

---

## 7. Admin Portal (`/api/v1/admin`)

*All routes require `require_admin_scoped` (`administrator` or `super_admin`).*
*`administrator` access is strictly scoped to records within their assigned `state_id`.*

### Dashboard & Analytics
- `GET /api/v1/admin/dashboard`: Real-time aggregated metrics (active caregivers, clients, pending reviews, active authorizations, compliance summary).
- `GET /api/v1/admin/reports`: Summary exports for state regulatory audits.

### Caregiver Management
- `GET /api/v1/admin/caregivers`: Paginated list of applicant and active caregivers with state scoping.
- `GET /api/v1/admin/caregivers/analytics`: Application funnel breakdown (draft -> submitted -> approved).
- `GET /api/v1/admin/caregivers/{application_id}`: Detailed view of application, profile, and e-signature.
- `POST /api/v1/admin/caregivers/{application_id}/review`: Approve (`approved`) or reject (`rejected`) application with required reason.
- `GET /api/v1/admin/caregivers/{application_id}/documents`: Associated compliance documents for the applicant.
- `GET /api/v1/admin/caregivers/{caregiver_id}/compliance`: Validates credentials, licenses, and training before assignment.
- `GET /api/v1/admin/caregivers/{caregiver_id}/assignments`: Lists clients currently assigned to this caregiver.

### Client Management & Admission Lifecycle
- `GET /api/v1/admin/clients`: List of clients in the admin's state.
- `GET /api/v1/admin/clients/{client_id}`: Full clinical and demographic profile.
- `POST /api/v1/admin/clients/{client_id}/admission`: Lifecycle transition (`pending` -> `approved` -> `active` / `rejected`).
- `GET /api/v1/admin/clients/{client_id}/care-plan`: Retrieve clinical care plan.
- `PUT /api/v1/admin/clients/{client_id}/care-plan`: Create or update care plan and ADL activities.
- `GET /api/v1/admin/clients/{client_id}/schedule`: Retrieve weekly care schedule.
- `POST /api/v1/admin/clients/{client_id}/schedule`: Add a scheduled shift block.
- `DELETE /api/v1/admin/clients/{client_id}/schedule/{schedule_id}`: Remove a scheduled shift block.
- `GET /api/v1/admin/clients/{client_id}/assignments`: Retrieve active caregiver assignments.
- `POST /api/v1/admin/clients/{client_id}/assignments`: Assign caregiver to client (enforces compliance gate).
- `DELETE /api/v1/admin/clients/{client_id}/assignments/{caregiver_id}`: Terminate caregiver assignment.

### Authorizations & Unit Burndown
- `GET /api/v1/admin/authorizations`: Paginated prior authorizations with status filters (`active`, `expiring_soon`, `expired`).
- `POST /api/v1/admin/authorizations`: Create new authorization (HCPCS code, total units, weekly hour limit).
- `POST /api/v1/admin/authorizations/{id}/review`: Review and approve client-submitted authorization letters.
- `PATCH /api/v1/admin/authorizations/{id}`: Update authorization details or record consumed `units_used`.

### Referral Pipeline
- `GET /api/v1/admin/referrals`: Inbound referrals from public forms or hospital partners.
- `GET /api/v1/admin/referrals/analytics`: Conversion metrics from `new` to `converted`.
- `PATCH /api/v1/admin/referrals/{referral_id}`: Update status (`contacted`, `converted`, `closed`) or convert directly to a `clients` record.

### Documents & Requirements Settings
- `GET /api/v1/admin/documents`: Paginated list of documents awaiting staff review.
- `POST /api/v1/admin/documents/{document_id}/review`: Approve or reject document with recorded rationale.
- `GET /api/v1/admin/settings/document-requirements`: State compliance document rules matrix.
- `PUT /api/v1/admin/settings/document-requirements`: Update required document types per state.

### Retention, Legal Hold & Soft-Delete Restore
- `PATCH /api/v1/admin/clients/{client_id}/legal-hold`: Toggle legal hold protection flag on client.
- `PATCH /api/v1/admin/caregivers/{caregiver_id}/legal-hold`: Toggle legal hold protection flag on caregiver.
- `PATCH /api/v1/admin/documents/{document_id}/legal-hold`: Toggle legal hold protection flag on document.
- `POST /api/v1/admin/{resource}/{id}/restore`: Restore soft-deleted record back to active status (`users`, `caregivers`, `clients`, `authorizations`, etc.).
- `POST /api/v1/admin/clients/{client_id}/erasure-request`: Processes data erasure request subject to legal retention constraints.

### Audit Logs, Broadcasts & User Administration
- `GET /api/v1/admin/audit-logs`: Review system audit trail (IP address, user agent, request ID, action diffs).
- `GET /api/v1/admin/announcements`: List active announcement broadcasts.
- `POST /api/v1/admin/announcements`: Create regional or platform broadcast.
- `PATCH /api/v1/admin/announcements/{id}`: Update or deactivate announcement.
- `DELETE /api/v1/admin/announcements/{id}`: Delete announcement.
- `GET /api/v1/admin/users`: List all platform user accounts.
- `GET /api/v1/admin/users/{user_id}`: Detailed user account inspection.
- `POST /api/v1/admin/users/{user_id}/status`: Change user status (`active`, `suspended`).
- `POST /api/v1/admin/users/{user_id}/role`: Change role tier (Super Admin only).
- `POST /api/v1/admin/users/{user_id}/state`: Reassign administrator to different state (Super Admin only).
- `DELETE /api/v1/admin/users/{user_id}`: Soft-delete user account.
