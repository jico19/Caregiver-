# Specification 001 — Authorization Units & Balance Burn-Down

**Status:** Ready for Implementation  
**Closes Scope:** `Scope of work.md:82-86` (authorization management, balance tracking)  
**Priority:** High (Largest functional gap in clinical/payer flow)  

---

## 1. Problem Statement

The platform currently stores authorizations with `start_date`, `end_date`, `authorization_number`, and `status`.

In canonical home care (Medicaid waivers in FL, GA, and IN), an authorization is **not just a date span**. It is a payer allowance of:
1. **HCPCS procedure code:** e.g., `T1019` (Personal Care), `S5125` (Attendant Care), `S5130` (Homemaker).
2. **Billing Units:** 1 unit = 15 minutes (4 units = 1 hour).
3. **Authorized Volume & Weekly Cap:** Total units for the authorization period and max hours per week.
4. **Balance Burn-Down:** As visits/shifts occur, units are deducted from the authorized pool to prevent unbillable care.

Without this, agencies risk providing unauthorized care that Medicaid or insurance will not reimburse.

---

## 2. Proposed Changes

### A. Database Migration
Forward-only migration adding unit tracking fields to `authorizations`:

```sql
ALTER TABLE authorizations
    ADD COLUMN hcpcs_code VARCHAR(20) NOT NULL DEFAULT 'T1019',
    ADD COLUMN service_description VARCHAR(150) NOT NULL DEFAULT 'Personal Care Services',
    ADD COLUMN total_units_authorized INT NOT NULL DEFAULT 0,
    ADD COLUMN units_used INT NOT NULL DEFAULT 0,
    ADD COLUMN max_weekly_hours NUMERIC(4,2),
    ADD COLUMN unit_type VARCHAR(20) NOT NULL DEFAULT '15_min' CHECK (unit_type IN ('15_min', 'hourly', 'visit'));

-- Helper expression for remaining units:
-- total_units_authorized - units_used
```

### B. Backend Updates
1. **Schema Update (`backend/app/schemas/authorizations.py`):**
   * Extend `AuthorizationCreateRequest` and `AuthorizationResponse` with `hcpcs_code`, `total_units_authorized`, `units_used`, `units_remaining`, and `max_weekly_hours`.
2. **Admin Route (`backend/app/api/routes/admin/authorizations.py`):**
   * Allow staff to record total units and procedure code during authorization creation/review.
3. **Client Route (`backend/app/api/routes/clients/authorizations.py`):**
   * Return `total_units_authorized`, `units_used`, and `remaining_hours` so clients can track remaining care allowance.

### C. Frontend Updates
1. **Admin Authorizations (`frontend/src/features/admin/pages/AuthorizationsPage.jsx`):**
   * Add Unit / Hour fields in Create & Edit modals.
   * Add progress bar showing unit consumption in authorization table rows.
2. **Client Portal (`frontend/src/features/client/pages/AuthorizationsPage.jsx`):**
   * Display visual progress ring/bar showing "Hours Used" vs "Hours Remaining" for active authorizations.

---

## 3. Verification Plan

* **Backend Tests:**
  * Test creating an authorization with procedure code and 120 units (30 hours).
  * Verify `GET /clients/me/authorizations` calculates correct `units_remaining`.
* **Compile & Build:**
  * Run backend compile check and frontend build.
