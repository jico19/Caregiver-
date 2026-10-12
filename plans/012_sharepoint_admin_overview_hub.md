# Plan 012 — Administrative Overview Hub (SharePoint Parity Phase 1)

**Status:** Completed  
**Specification:** `docs/specs/001_sharepoint_admin_dashboards_spec.md`  
**Reference Image:** `pics/1.jpeg`  
**Depends on:** 001 (Soft deletion), 003 (Client admission lifecycle), 004 (Referral conversion)

---

## 1. Objective

Upgrade the core Admin Dashboard (`/admin/dashboard`) to achieve functional and layout parity with the reference Microsoft SharePoint intranet overview hub (`pics/1.jpeg`). Replace the existing minimal 4-card stub with a unified operational launchpad that provides executive KPIs, recent intakes, actionable tasks, announcements, and portal navigation.

---

## 2. Scope & Bounded Changes

### A. Backend Route & Schema (`backend/app/api/routes/admin/dashboard.py`)
- Keep existing `metrics` payload backward-compatible.
- Add operational KPI aggregations:
  - `active_clients`: count of clients with status `'active'`
  - `new_referrals`: count of client referrals in `'new'` status
  - `active_caregivers`: count of caregivers with status `'active'`
  - `pending_compliance`: pending caregiver applications + pending document reviews
- Add `recent_intakes`: top 5 most recent referrals/clients with explicit columns (`id, first_name, last_name, status, created_at, state_id, referral_source`).
- Add `open_tasks`: top 5 action items dynamically derived from items needing admin attention (pending caregiver applications and pending document approvals).
- Add `announcements`: top 3 active announcements for admin audience.
- Enforce strict state scoping (`require_admin_scoped`, `scope_query`, `assert_permitted_filter`).

### B. Frontend Redesign (`frontend/src/features/admin/pages/DashboardPage.jsx`)
- Match the visual layout of `pics/1.jpeg`:
  - Welcome banner with agency branding and quick-stat counters.
  - Sub-dashboard navigation cards (Client Intake, Staffing, Authorizations, Training, Reports, Audit).
  - Recent Client Intakes table with status badges and links.
  - Open Tasks & Action Items checklist with direct route navigation.
  - Announcements widget & Quick Links sidebar.
  - State jurisdiction dropdown (`All States` for super_admin, assigned state for admin).

---

## 3. Verification Plan

1. Backend Unit Tests: `tests/test_admin_dashboard.py`
   - Scoped administrator (FL) cannot see GA or IN intakes/tasks.
   - Super administrator can view all states or filter by state.
   - Denied access for unauthenticated or non-admin roles.
2. Backend Compile Check: `python -m compileall -q app tests`
3. Frontend Lint & Build: `npm.cmd run lint`, `npm.cmd run build`
4. Manual verification of UI responsiveness and empty states.
