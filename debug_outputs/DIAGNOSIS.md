# Diagnosis: PostgREST PGRST116 `Cannot coerce the result to a single JSON object`

## Incident Summary
- **Timestamp**: `2026-10-06 15:00:44 UTC` (11:00:44 PM local)
- **Request**: `GET /api/v1/admin/caregivers/9088ba37-80c6-4b9d-8b01-d8529b7febc1/assignments`
- **Request IDs**: `d6b37607-4ed6-41a0-b6f1-80bfacf24099`, `84e1a443-de37-4a75-8954-5983417a682b`
- **Status**: HTTP 500 (Unhandled exception)
- **Error**: `postgrest.exceptions.APIError: {'message': 'Cannot coerce the result to a single JSON object', 'code': 'PGRST116', 'hint': None, 'details': 'The result contains 0 rows'}`
- **File**: `backend/app/api/routes/admin/assignments.py`
- **Location**: Line 165 in `list_caregiver_assigned_clients`

## Root Cause Analysis
In `backend/app/api/routes/admin/assignments.py`:
1. **Line 161–168 in `list_caregiver_assigned_clients`**:
   ```python
   cg_res = (
       active_only(supabase.table("caregivers").select("id, state_id"), "caregivers")
       .eq("id", caregiver_id)
       .single()
       .execute()
   )
   if not cg_res.data:
       raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found.")
   ```
   PostgREST's `.single()` method sets the HTTP header `Accept: application/vnd.pgrst.object+json`. When a requested `caregiver_id` does not exist or has been soft-deleted (`deleted_at IS NOT NULL`), PostgREST returns HTTP 406 with code `PGRST116` ("The result contains 0 rows").
   In Python `postgrest-py`, this raises `postgrest.exceptions.APIError`. Because it is unhandled, it escapes to middleware as an HTTP 500 server error instead of allowing line 167 to return HTTP 404 (`detail="Caregiver not found."`).

2. **Similar defect on line 61–68 in `assign_caregiver_to_client`**:
   ```python
   cg_res = (
       active_only(supabase.table("caregivers").select("id, state_id, first_name, last_name"), "caregivers")
       .eq("id", payload.caregiver_id)
       .single()
       .execute()
   )
   if not cg_res.data:
       raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found.")
   ```
   Also uses `.single()`, which throws `PGRST116` instead of returning 404 when `caregiver_id` is invalid or soft-deleted.

## Why Mock Tests Passed
In `backend/tests/conftest.py`, `FakeQuery.execute()` returns `FakeResponse(rows[0] if rows else None)` when `self.single_mode` is True. The in-memory test double returns `data = None` rather than raising `APIError(PGRST116)`, masking the production failure.
