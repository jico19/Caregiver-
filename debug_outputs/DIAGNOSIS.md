# Diagnosis: PostgREST 42703 `caregivers.user_id does not exist`

## Incident Summary
- **Timestamp**: `2026-10-06 14:35:45 UTC`
- **Request**: `DELETE /api/v1/admin/users/3ae89f6b-d18f-4378-91ec-2187a55c9522`
- **Request ID**: `4fea9784-1b22-44cb-ad27-b379bd012cd3`
- **Status**: HTTP 500 (Unhandled exception)
- **Error**: `postgrest.exceptions.APIError: {'message': 'column caregivers.user_id does not exist', 'code': '42703'}`

## Root Cause Analysis
In `backend/app/api/routes/admin_users.py`:
1. **Line 299 in `offboard_user`**:
   ```python
   supabase.table("caregivers").update(stamp).eq("user_id", user_id).execute()
   ```
   Postgres schema (`supabase/migrations/20260924101138_initial_schema.sql` line 211) defines:
   ```sql
   CREATE TABLE IF NOT EXISTS caregivers (
     id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     ...
   );
   ```
   The `caregivers` table has `id` (which is the user's UUID), not `user_id`. Querying or updating `.eq("user_id", ...)` causes PostgREST to return HTTP 400 with Postgres error code 42703 (undefined column).

2. **Additional instances of invalid column assumption in `admin_users.py`**:
   - Line 111: `supabase.table("caregivers").select("*").eq("user_id", user_id)` (should be `.eq("id", user_id)`)
   - Line 119: `supabase.table("clients").select("*").eq("user_id", user_id)` (should be `.eq("id", user_id)`)
   - Line 301: `supabase.table("clients").update(stamp).eq("user_id", user_id)` (should be removed; line 300 already updates `.eq("id", user_id)`)
   - Line 303: `supabase.table("documents").update(stamp).eq("user_id", user_id)` (should be removed; `documents` uses `owner_id`, already updated at line 302)
   - Line 309: `supabase.table("clients").select("id").eq("user_id", user_id)` (clients are keyed by `id = user_id`)

## Why Tests Passed
`backend/tests/conftest.py` uses in-memory `FakeSupabase`, which filters dictionary objects in Python memory and does not validate column names against the SQL schema.
