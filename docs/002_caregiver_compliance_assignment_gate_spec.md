# Specification 002 — Caregiver Compliance Assignment Gate

**Status:** Ready for Implementation  
**Closes Scope:** `Scope of work.md:102-103` (track onboarding progress, monitor document compliance)  
**Priority:** High (Regulatory safety & legal liability protection)  

---

## 1. Problem Statement

Currently, `POST /admin/clients/{client_id}/assignments` ([`assignments.py:61-71`](file:///C:/Users/user/Documents/Caregiver/backend/app/api/routes/admin/assignments.py#L61-L71)) only validates that:
1. The caregiver exists.
2. The caregiver belongs to the same state as the client.

It does **not** check whether the caregiver is legally compliant to work. An administrator can assign a caregiver who has:
* Expired CPR or TB test results.
* Missing or rejected background check clearance.
* Incomplete mandatory state onboarding requirements.

In Florida (AHCA), Georgia (DCH), and Indiana (IDOH), deploying a caregiver with expired credentials to a Medicaid patient is a regulatory violation.

---

## 2. Proposed Changes

### A. Backend Compliance Evaluator
Create a reusable compliance validator utility: `backend/app/services/compliance.py`:

```python
def check_caregiver_assignment_compliance(supabase, caregiver_id: str, state_id: int) -> tuple[bool, list[str]]:
    """
    Evaluates whether a caregiver meets all mandatory credential requirements for their state.
    Returns (is_compliant, list_of_blocking_reasons).
    """
    # 1. Fetch mandatory document requirements for the state
    # 2. Fetch caregiver's uploaded documents with statuses and expiration dates
    # 3. Check for missing required documents
    # 4. Check for documents with status == 'expired' or expiration_date < today
    # 5. Return blocking reasons if any fail
```

### B. Assignment Route Gate
Update `POST /admin/clients/{client_id}/assignments` in `backend/app/api/routes/admin/assignments.py`:
* Call `check_caregiver_assignment_compliance()`.
* If non-compliant:
  * By default, reject with HTTP 422 Unprocessable Entity and list of missing/expired credentials.
  * Allow optional `override_compliance: bool = False` flag strictly for `super_admin` users, requiring an `override_reason` that is permanently stamped in `audit_logs`.

### C. Frontend Assignment UI
Update `frontend/src/features/admin/pages/ClientDetailPage.jsx`:
* In the caregiver assignment picker, display live compliance status badges beside caregiver names (`Compliant`, `Credentials Expired`, `Missing Documents`).
* Disable the "Assign" button for non-compliant caregivers, showing a tooltip detailing which documents are blocking assignment.

---

## 3. Verification Plan

* **Backend Tests:**
  * Test assignment succeeds for fully compliant caregiver.
  * Test assignment fails with HTTP 422 if caregiver's CPR certificate is expired.
  * Test super admin override succeeds and writes detailed audit log.
