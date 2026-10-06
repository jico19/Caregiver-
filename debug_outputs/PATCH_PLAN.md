# Patch Plan: Remove Unsafe `.single()` in `assignments.py`

## Target File
`backend/app/api/routes/admin/assignments.py`

## Proposed Changes
1. **Lines 61–71 (`assign_caregiver_to_client`)**:
   Query without `.single()`, checking `cg_res.data` as a list:
   ```python
   cg_res = (
       active_only(supabase.table("caregivers").select("id, state_id, first_name, last_name"), "caregivers")
       .eq("id", payload.caregiver_id)
       .execute()
   )
   if not cg_res.data:
       raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found.")

   cg = cg_res.data[0]
   assert_state_allowed(scope, cg.get("state_id"))
   ```

2. **Lines 161–171 (`list_caregiver_assigned_clients`)**:
   Query without `.single()`, checking `cg_res.data` as a list:
   ```python
   cg_res = (
       active_only(supabase.table("caregivers").select("id, state_id"), "caregivers")
       .eq("id", caregiver_id)
       .execute()
   )
   if not cg_res.data:
       raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found.")

   cg = cg_res.data[0]
   assert_state_allowed(scope, cg.get("state_id"))
   ```

## Risk Assessment
- **Risk Level**: LOW
- **Blast Radius**: `admin/assignments.py` routes only.
- **Backwards Compatibility**: Returns standard `404 Not Found` with `{"detail": "Caregiver not found."}` instead of HTTP 500 when caregiver record is not found.
- **Verification**:
  - `.\venv\Scripts\python.exe -m pytest -q tests/test_assignments.py`
  - `.\venv\Scripts\python.exe -m pytest -q`
  - `.\venv\Scripts\python.exe -m compileall -q app tests`
