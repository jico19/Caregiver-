# Caregiver Platform Agent Guide

## Hard stops (ask the user first, every time)

- Never run `npx supabase db push` or any command that touches production without explicit approval in this session.
- Never edit a migration that has already been applied. Add a new forward-only migration.
- Never read, print, or echo `.env` files, passwords, or service keys. Only `.env.example` files are committed.
- No commit, push, force-push, `reset --hard`, or branch deletion unless asked.
- Never trust client-supplied user, role, or state identifiers.
- If a request conflicts with this guide, stop and ask. Do not silently deviate.

## Product and architecture

One platform serves Florida, Indiana, and Georgia. State is data and an authorization boundary. Do not build per-state applications or hardcode state-specific behavior unless a rule cannot be configured.

Stack: React 19 + Vite frontend, FastAPI backend, Supabase Postgres/Auth/Storage. Keep the MVP monolithic. Do not add frameworks or infrastructure without an approved need.

### Authorization

Protected access is enforced in the backend.

- `administrator`: access only to their assigned state.
- `super_admin`: access to all states.
- Unscoped `administrator`: denied.

### Supabase clients

- `get_supabase()` and `get_supabase_anon()` are singletons. Resolve them at call time. Never hold a client across requests.
- TODO(confirm): `get_supabase()` uses the service key and bypasses RLS. Use it only after the backend has checked role, owner, and state. State when `get_supabase_anon()` is allowed.
- New tables enable RLS as defense in depth, even though the backend enforces access.

## Repository map

- `backend/`: FastAPI routes, schemas, services, tests, and jobs.
- `frontend/`: JavaScript/JSX React application.
- `supabase/`: Schema, migrations, seeds, and CLI config. Read `supabase/RUNBOOK.md` before changing or applying SQL.
- `plans/`: Active and historical plans. Read `plans/README.md` before acting on a plan.

## Agent style and skills

- Caveman mode is on at session start, level `lite`: terse replies, no filler, technical terms and exact strings preserved. The user ends it with `stop caveman` or `normal mode`.
- Exception: the pre-implementation explanation (see workflow step 5) uses simple non-technical words, not caveman style.
- Load the skill that matches the task before working. Skills cover planning, review, safe refactor, migration, and verification. Do not work inline when a skill fits.
- Feature work starts with the `grill-me` skill to sharpen scope and acceptance conditions before any code is written.
- TODO(confirm): skills live in `.agents/skills/`. If a named skill is missing, say so instead of improvising.

## Required workflow

1. Read this guide and the task-relevant source, tests, plan, and runbook.
2. Run `git status --short`. Preserve unrelated existing edits.
3. Classify scope: frontend, backend, database, protected access, or cross-layer.
4. Map callers, routes, schemas, SQL, and tests affected by the change.
5. State the bounded change contract: files, API or schema changes, authorization/state behavior, verification, and rollback for operational changes. Briefly explain in simple non-technical words what will change.
   - For protected-access or database changes, **wait for user approval** before implementing.
   - For other changes, proceed unless the user asked to review first.
6. Implement the smallest complete change. Do not jump from a request directly to UI when an API, authorization, or data contract is affected.
7. Add or update focused tests. Protected changes need allowed and denied cases for role, owner, state, and `super_admin` where applicable.
8. Run relevant verification, then full gates for cross-layer work.
9. Update the applicable plan or checklist when its status changes. Do not create duplicate plan numbers.

### Definition of done

- [ ] Tests added or updated, including denied cases for protected changes
- [ ] Verification commands run, with results reported
- [ ] Plan or checklist updated if status changed
- [ ] Manual checks and remaining risks reported

## Database changes

- Schema changes go through the Supabase CLI. `supabase/migrations/` is the single source of truth for schema, `supabase/seeds/` for demo data. The SQL Editor is not the apply path.
- A database change must name its migration file, seed data if any, rollback path, and production verification. Follow `supabase/RUNBOOK.md`.
- Invoke the CLI as `npx supabase <command>` from the repository root.
- There is no local database: `db start`, `db reset`, and `db diff` are unavailable. A migration is verified against production or not at all.
- Read the `--dry-run` output before every push, and show it to the user. Write forward-only migrations.
- New list queries need a composite partial index: `(state_id, <sort_col>) WHERE deleted_at IS NULL`.

## Data access

Every Supabase call is a network round trip (~40 ms). Count them. A list page that spends three on auth has one left for the list.

### Most violated (check these first)

1. **Name columns. Never `select("*")`.** Avoid multi-megabyte responses from base64 blobs like `signature_data`.
2. **No query inside a loop.** Collect keys and issue one `in_()`. Batch multi-row writes into one request.
3. **Filter in the database, never after `paginate()`.** Apply `active_only()` and `scope_query()` before pagination so pages and totals are correct.
4. **Never pass a fetched row as `old_values` or `new_values`.** Whitelist audited fields. `audit_logs` is append-only and unexpired.
5. **Validate column names against migrations.** PostgREST returns 400 on unknown columns; `FakeSupabase` does not validate.

### Pagination and aggregation

- Paginate list endpoints with `PaginationParams` and `paginate()`.
- Use `count="exact"` only when a precise total is shown to the user. Otherwise use `count="planned"`.
- Aggregate in Postgres with `count="exact"`, embeds, or `.rpc()`. Avoid Python joins over full-table reads in request paths.
- Memoize reference data (`states`, `roles`, `document_types`). Use `validate_state_id()` instead of re-querying.

### Execution

- Handlers are sync `def`; FastAPI runs them in a threadpool. If you use `async def`, wrap blocking calls in `run_in_threadpool`.
- Audit and notification logging must not fail the primary write.

## Frontend data reads

- Every read goes through `useFetch` or `usePaginatedFetch`. A raw `api.get` in a `useEffect` is uncached, undeduped, and refetches on every mount.
- Pass filters through `params`. Do not build a query string into `url`; `usePaginatedFetch` appends its own `?`.
- Do not hand `useQuery` an option key that may be `undefined`; it overrides client defaults. Spread `staleTime` conditionally inside `useFetch`.
- One endpoint, one cache key. Components sharing data share a query.
- `plans/011_performance_and_query_efficiency.md` remediates existing violations. These rules apply to new code.

## Test and implementation constraints

- Backend tests use in-memory `FakeSupabase` in `backend/tests/conftest.py`. Routes must resolve `get_supabase()` or `get_supabase_anon()` at call time so tests can patch them. Patch a new route module in `conftest.py` before testing it.
- Use Pydantic v2 class-based `Config` style in `backend/app/core/config.py`.
- Match existing JavaScript/JSX conventions. No frontend test runner exists yet; use lint, production build, and targeted manual smoke checks.
- Before running an expensive or broad test command, briefly state:

  ```
  TEST SCOPE:
  - Changed:
  - Potentially affected:
  - Tests selected:
  - Why broader tests are/are not necessary:
  ```

  Do not ask permission for normal targeted tests. Keep it short.

## Commands

Windows PowerShell. Run from the named subdirectory.

- Backend tests (`backend/`): `.\venv\Scripts\python.exe -m pytest -q`
- Backend compile check (`backend/`): `.\venv\Scripts\python.exe -m compileall -q app tests`
- Frontend lint (`frontend/`): `npm.cmd run lint`
- Frontend build (`frontend/`): `npm.cmd run build`
- Backend dev server (`backend/`): `.\venv\Scripts\uvicorn app.main:app --reload --port 8000`
- Frontend dev server (`frontend/`): `npm.cmd run dev`

Cross-layer verification order: backend tests, backend compile check, frontend lint, frontend build, then targeted manual smoke checks.