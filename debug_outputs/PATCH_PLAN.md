# Patch Plan: Correct Invalid `user_id` Columns in `admin_users.py`

## Target File
`backend/app/api/routes/admin_users.py`

## Proposed Changes
1. **Lines 108–123 (`get_user` endpoint)**:
   Change `.eq("user_id", user_id)` to `.eq("id", user_id)` for `caregivers` and `clients`:
   ```python
   if role_name == "caregiver":
       cg_res = (
           active_only(supabase.table("caregivers").select("*"), "caregivers")
           .eq("id", user_id)
           .execute()
       )
       if cg_res.data:
           profile = cg_res.data[0]
   elif role_name == "client":
       cl_res = (
           active_only(supabase.table("clients").select("*"), "clients")
           .eq("id", user_id)
           .execute()
       )
       if cl_res.data:
           profile = cl_res.data[0]
   ```

2. **Lines 297–313 (`offboard_user` endpoint)**:
   Remove redundant updates with non-existent `user_id` columns:
   - Remove `supabase.table("caregivers").update(stamp).eq("user_id", user_id).execute()` (already covered by `eq("id", user_id)`).
   - Remove `supabase.table("clients").update(stamp).eq("user_id", user_id).execute()` (already covered by `eq("id", user_id)`).
   - Remove `supabase.table("documents").update(stamp).eq("user_id", user_id).execute()` (already covered by `eq("owner_id", user_id)`).
   - Change `cl_rows = supabase.table("clients").select("id").eq("user_id", user_id).execute()` to `.eq("id", user_id)`.

## Risk Assessment
- **Risk Level**: LOW
- **Blast Radius**: `admin_users` routes only.
- **Verification**: Run `.\venv\Scripts\python.exe -m pytest -q` and `compileall`.
