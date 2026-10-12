# Plan 014 — Staffing & Compliance Dashboard (SharePoint Parity Phase 3)

**Status:** Completed  
**Specification:** `docs/specs/001_sharepoint_admin_dashboards_spec.md`  
**Reference Image:** `pics/2.jpeg`  
**Depends on:** 002 (User lifecycle), 012 (Administrative Overview Hub)

---

## 1. Objective

Upgrade the Caregivers & Staffing screen (`/admin/caregivers`) to achieve functional and layout parity with the reference Microsoft SharePoint Staffing Dashboard (`pics/2.jpeg`). Provide executive staffing KPIs (Total Caregivers, Compliance Cleared, In Training/Onboarding, Pending Applications), an active staff roster with credential expiration tracking (CPR, CNA, TB test), and location breakdown cards alongside the applicant review queue.

---

## 2. Scope & Bounded Changes

### A. Backend Route (`backend/app/api/routes/admin/caregivers.py`)
- Add endpoint `GET /api/v1/admin/caregivers/analytics`
- Returns:
  - `total_caregivers`: count of active caregivers in scope
  - `pending_applications`: count of applications in `submitted` or `under_review`
  - `in_onboarding`: count in `onboarding` or `approved`
  - `by_state`: distribution by state (FL, GA, IN)
- Enforce strict state scoping (`require_admin_scoped`, `scope_query`, `assert_permitted_filter`).

### B. Frontend Redesign (`frontend/src/features/admin/pages/CaregiversPage.jsx`)
- Match the visual layout and capabilities of `pics/2.jpeg`:
  - Staffing KPI metric strip (Total Staff, Onboarding, Cleared Compliance, Pending Reviews).
  - View switcher: **Active Staff Roster** vs **Applicant Review Queue**.
  - Active Staff Roster with credential compliance tags (Compliant, Expiring Soon, Non-compliant).
  - Location distribution breakdown.

---

## 3. Verification Plan

1. Backend Unit Tests: `tests/test_admin.py`
   - Test staffing analytics aggregation and state scoping.
   - Test non-admin access rejection.
2. Backend Compile Check: `python -m compileall -q app tests`
3. Frontend Lint & Build: `npm.cmd run lint`, `npm.cmd run build`
