# Plan 010 — Data Retention and Purge Policy

**Status:** Planned
**Closes:** Follow-up requirement from Plan 001 Section F (soft-deletion retention management and compliance purge)
**Depends on:** 001 (Soft deletion), 007 (Audit compliance hardening)
**Blocks:** None

## Problem

Plan 001 establishes soft deletion across all transactional and clinical tables in the platform. Rows marked with `deleted_at` are filtered out of all normal application read paths and preserved for legal hold, clinical audit, and regulatory inspection.

However, indefinite retention is both a compliance vulnerability and an unnecessary storage cost. Home health agency regulations across our active states establish statutory retention floors:
- **Florida** (F.A.C. 59A-8.022 / F.S. 408.810): Clinical records must be retained for at least 5 years following discharge.
- **Georgia** (Rules and Regulations 290-5-54-.12): Home health clinical records must be retained for at least 6 years.
- **Indiana** (410 IAC 17-15-1): Clinical records must be retained for at least 7 years.
- **HIPAA Privacy Rule** (45 CFR § 164.530(j)(2)): Required compliance documentation and audit logs must be maintained for 6 years.

After statutory retention obligations expire and absent any active litigation hold, records containing Protected Health Information (PHI) and Personally Identifiable Information (PII) must be purged to minimize liability.

## Retention Schedule

| Record Category | Tables | Minimum Retention Window | Purge Trigger |
|---|---|---|---|
| **Clinical Records** | `care_plans`, `care_plan_activities`, `care_schedules` | 7 years | `deleted_at + 7 years` |
| **Financial & Billing** | `authorizations`, `client_referrals` | 6 years | `deleted_at + 6 years` |
| **Workforce & Credentialing** | `caregivers`, `caregiver_applications`, `documents`, `training_enrollments` | 5 years | `deleted_at + 5 years` |
| **Operational & Messaging** | `announcements`, `notifications` | 2 years | `deleted_at + 2 years` |
| **User Identity** | `users` | Governed by dependent clinical retention | Purged only after all child profile records purged |
| **Audit & Legal Evidence** | `audit_logs`, `client_agreements` | Permanent / Immutable | **Never purged** |

## Purge Architecture

### 1. Legal Hold Flag
To prevent automated destruction during active audits, legal proceedings, or dispute resolution:
- Add `legal_hold BOOLEAN NOT NULL DEFAULT FALSE` to `clients`, `caregivers`, and `documents`.
- Records with `legal_hold = TRUE` are skipped by automated purge jobs regardless of age.
- Only `super_admin` can toggle legal hold, and toggles are audited in `audit_logs`.

### 2. Scheduled Purge Job
- Daily background task in `backend/app/jobs/retention_purge.py`.
- Evaluates soft-deleted rows where `deleted_at < NOW() - retention_interval` and `legal_hold IS NOT TRUE`.
- Storage purge: for purged `documents`, deletes the physical file in Supabase Storage (`documents` bucket).
- Hard delete executed with transactional verification.
- Every purge batch records a structured event in `audit_logs` specifying `purged_table`, `record_count`, and `cutoff_timestamp`.

### 3. Data Subject Erasure Requests (DSAR)
- Formal endpoint `POST /admin/clients/{id}/erasure-request` (super_admin only).
- Evaluates whether statutory retention has elapsed.
- If statutory retention applies, returns refusal explanation citing state retention rule.
- If eligible, immediately queues non-statutory records for purge.

## Verification & Rollback

- **Tests:** `backend/tests/test_retention_purge.py` asserting retention window boundaries, legal hold immunity, storage cleanup, and immutable table protection.
- **Rollback:** Forward-only migration; retention purge job disabled via environment toggle `ENABLE_RETENTION_PURGE=false`.
