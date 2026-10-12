# Plan 013 — Client Intake Pipeline (SharePoint Parity Phase 2)

**Status:** Completed  
**Specification:** `docs/specs/001_sharepoint_admin_dashboards_spec.md`  
**Reference Image:** `pics/3.jpeg`  
**Depends on:** 004 (Referral conversion), 012 (Administrative Overview Hub)

---

## 1. Objective

Upgrade the Client Intake & Referrals screen (`/admin/referrals`) to achieve functional and layout parity with the reference Microsoft SharePoint Client Intake Dashboard (`pics/3.jpeg`). Provide intake KPI metrics (Total Referrals, Contacted/In Progress, Converted/Active Clients, Conversion Rate), a visual 4-stage Kanban pipeline, and source distribution analytics alongside the tabular roster.

---

## 2. Scope & Bounded Changes

### A. Backend Route (`backend/app/api/routes/admin/referrals.py`)
- Add endpoint `GET /api/v1/admin/referrals/analytics`
- Returns:
  - `total_referrals`: count of all active referrals in scope
  - `by_status`: counts for `new`, `contacted`, `converted`, `closed`
  - `by_source`: breakdown by `referral_source` (Hospital, MCO, Physician, Website, Direct, etc.)
  - `conversion_rate_pct`: percentage of referrals successfully converted
- Enforce strict state scoping (`require_admin_scoped`, `scope_query`, `assert_permitted_filter`).

### B. Frontend Redesign (`frontend/src/features/admin/pages/ReferralsPage.jsx`)
- Match the visual layout and capabilities of `pics/3.jpeg`:
  - Intake KPI metric strip (Total Referrals, In Progress, Converted, Closed, Conversion Rate %).
  - View switcher: **Pipeline (Kanban)** vs **Table (Roster)**.
  - Kanban Pipeline with 4 columns:
    - 1. *New Referral*
    - 2. *In Progress / Contacted*
    - 3. *Ready for Conversion*
    - 4. *Converted to Active Client*
  - Direct quick-action buttons on cards to transition status or trigger client profile conversion.
  - Source distribution breakdown cards.

---

## 3. Verification Plan

1. Backend Unit Tests: `tests/test_admin_referrals.py`
   - Test analytics calculation and status grouping.
   - Test state isolation between FL and GA.
   - Test permission denial for non-admins.
2. Backend Compile Check: `python -m compileall -q app tests`
3. Frontend Lint & Build: `npm.cmd run lint`, `npm.cmd run build`
