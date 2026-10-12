# Implemented Workflows Guide

Detailed architectural diagrams and execution flows for end-to-end operational workflows implemented across the React frontend, FastAPI backend, and PostgreSQL database.

---

## 1. Caregiver Recruitment & Onboarding Workflow

Manages the complete lifecycle from public applicant intake to verified active caregiver.

```
[Public Website / Careers]
           │
           ▼
[Caregiver Application Form] ─── (E-Signature Canvas + Profile)
           │
           ▼
[POST /caregivers/apply-public]
           │
           ▼ (Atomic Transaction: create_caregiver_application_atomic)
    ├── 1. Sync User Record (auth.users & public.users)
    ├── 2. Upsert Profile (public.caregivers)
    └── 3. Create Application (caregiver_applications, status='submitted')
           │
           ▼
[Admin Review Portal]
   ├── Review Profile & Signatures (SHA-256 Hash verified)
   ├── Inspect Uploaded Documents vs State Requirements Matrix
   │
   ├── [APPROVE] ➔ status = 'approved' ➔ Caregiver moves to Active Roster
   │
   └── [REJECT]  ➔ status = 'rejected' + rejection_reason
                       │
                       ▼
         [Caregiver Portal: Resubmit]
         Caregiver amends issues and resubmits (status = 'under_review')
```

### Key Technical Details:
1. **Atomic Application Submission**: Handled by stored procedure `create_caregiver_application_atomic`, guaranteeing user record synchronization, profile insertion, and application logging occur within a single database transaction.
2. **E-Signature & Hash Verification**: Captures signature canvas data, legal name, and timestamp. The backend computes a SHA-256 `content_hash` over the application payload to ensure legal integrity against retroactive modification.
3. **Compliance Checklist**: Validates that mandatory certifications for the jurisdiction (Driver's License, CPR, Level 2 Background Check) are approved before an applicant can be scheduled.

---

## 2. Client Intake, Referral & Admission Workflow

Processes incoming patient leads through referral conversion, digital consent, and formal clinical admission.

```
[Public Contact Form / Hospital Referral]
           │
           ▼
[POST /states/{state}/contact] ➔ Recorded in `client_referrals` (status='new')
           │
           ▼
[Admin Referrals Pipeline]
   ├── Triage & Contact Client ➔ status = 'contacted'
   │
   ▼
[Convert Referral to Client] ➔ (Creates `clients` record, status='pending')
           │
           ▼
[Client Intake & Electronic Agreements]
   ├── Client logs in to Client Portal
   ├── Signs Intake Consent Form (`clients.signature_data`)
   └── Electronically signs Legal Agreements (`client_agreements`):
       ├── Care Agreement
       ├── HIPAA Disclosure
       └── Client Rights & Responsibilities
           │
           ▼
[Admin Admission Review]
   ├── [APPROVE] ➔ status = 'approved' ➔ sets service_start_date & admitted_by
   ├── [ACTIVATE] ➔ status = 'active' (Eligible for staffing & scheduling)
   └── [REJECT] ➔ status = 'rejected' + rejection_reason
```

---

## 3. Prior Authorizations & Unit Burndown Workflow

Enforces payer-authorized service caps and tracks unit consumption to prevent unauthorized care delivery.

```
[Insurance Approval Letter]
           │
     ┌─────┴────────────────────────┐
     │                              │
[Admin Direct Entry]       [Client Portal Upload]
(POST /admin/authorizations) (POST /clients/me/authorizations, source='client')
     │                              │
     │                              ▼
     │                     [Admin Review & Verify]
     │                              │
     └──────────────┬───────────────┘
                    │
                    ▼
          [Active Authorization]
          ├── HCPCS Procedure Code: (e.g., 'T1019')
          ├── Total Units Authorized: (e.g., 480 units)
          ├── Unit Type: '15_min' (1 hour = 4 units)
          ├── Max Weekly Hours: (e.g., 30.00 hours/week)
          └── Start Date & End Date
                    │
                    ▼
          [Burndown Tracking]
          As completed visits are finalized, `units_used` increments.
          Remaining Balance = Total Units Authorized - Units Used
                    │
                    ▼
          [Automated Expiration Alert]
          Daemon job (`scan_due_authorizations`) scans active authorizations
          and notifies staff 30 days prior to expiry.
```

---

## 4. Staffing & Caregiver-Client Assignment Workflow

Connects certified caregivers to active clients while enforcing pre-assignment compliance gates.

```
[Admin Selects Client & Caregiver for Assignment]
                    │
                    ▼
      [Compliance Gate Check] (GET /admin/caregivers/{id}/compliance)
      System verifies:
      ├── Is caregiver active and un-suspended?
      ├── Are all required state documents approved?
      ├── Has any credential expired? (License, CPR, TB)
      └── Are mandatory training courses completed?
                    │
           ┌────────┴────────┐
         [PASSED]          [FAILED]
           │                 │
           ▼                 ▼
[POST /admin/clients/{id}/assignments]   [Assignment Blocked]
Creates active relationship in           Admin receives detailed failure:
`caregiver_client_assignments`:          "Caregiver missing CPR certification"
├── Role: 'primary' or 'relief'
└── Unique active match constraint
           │
           ▼
Caregiver gains access to:
├── Client's Care Plan Activities
└── Weekly Care Schedule
```

---

## 5. Clinical Care Plan & Weekly Scheduling Workflow

Defines clinical instructions and recurring shift allocations.

### Care Plan Execution:
1. **Care Plan Creation**: Nurse or administrator creates plan (`PUT /admin/clients/{id}/care-plan`) specifying `primary_nurse`, `effective_date`, and `emergency_protocol`.
2. **ADL Task Breakdown**: Adds granular Activities of Daily Living (`care_plan_activities`) such as:
   - "Personal hygiene & bathing" (Mon, Wed, Fri)
   - "Meal preparation & dietary management" (Daily)
   - "Mobility assistance" (Daily)
3. **Portal Visibility**: Accessible to both client in Client Portal and assigned caregiver in Caregiver Portal.

### Scheduling Execution:
1. **Shift Allocation**: Admin creates recurring shift blocks (`care_schedules`) with `day_of_week`, `start_time`, `end_time`, `service`, and assigned `caregiver_id`.
2. **Hour Cap Verification**: Validates that cumulative scheduled hours do not exceed the client's `max_weekly_hours` defined in the active authorization.

---

## 6. Training, Certification & Background Reminders

Maintains workforce regulatory qualifications and continuous education.

1. **Course Enrollment**: Caregivers enroll in state-mandated training modules (HIPAA, Infection Control, Dementia Care).
2. **Completion & Dynamic Certificate**: Upon completion (`/training/courses/{id}/complete`), caregivers can download dynamically generated PDF certificates built with ReportLab (`GET /training/courses/{id}/certificate`).
3. **Automated Reminders (Lifespan Jobs)**:
   - Periodic 24-hour daemons (`scan_due_training`, `scan_due_credentials`) check expiration horizons.
   - Generates in-app notifications 30 days before credential expiration.

---

## 7. Data Retention, Legal Hold & Soft-Delete Restore Workflow

Enforces HIPAA 7-year document retention rules while safeguarding records subject to legal disputes.

```
[Record Deletion Request]
           │
           ▼
[Soft Deletion Applied]
Record receives `deleted_at = NOW()` and `deleted_by = user_id`.
Record is immediately invisible in portals and RLS queries.
           │
           ▼
[Retention Window (7 Years)]
Record is preserved in PostgreSQL archive.
           │
     ┌─────┴────────────────────────┐
     │                              │
[Legal Dispute / Audit]     [Retention Exceeded (> 7 Years)]
Admin toggles:                      │
`legal_hold = TRUE`                 ▼
     │                      [Daily Purge Job: run_retention_purge]
     ▼                      System checks:
[PROTECTED]                 Is `deleted_at < NOW() - 7 years`?
Immune to purge.            AND `legal_hold == FALSE`?
Cannot be destroyed.                │
                                    ├── YES ➔ Permanent Hard Delete
                                    └── NO  ➔ Retained (Protected)
```

### Administrative Restoration:
If an active record was deleted inadvertently, administrators can restore it via:
```http
POST /api/v1/admin/{resource}/{id}/restore
```
This resets `deleted_at = NULL` and `deleted_by = NULL`, immediately restoring access across all portals.
