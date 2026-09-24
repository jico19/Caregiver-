# AGENTS.md

Caregiver Platform: **one** unified platform (not per-state apps) — React 19 + Vite frontend, FastAPI backend, Supabase (Postgres + Auth + Storage). FL / IN / GA are data-driven contexts in a single codebase.

## Layout
- `backend/` — FastAPI. Python venv at `backend/venv`. Routes in `backend/app/api/routes/`, business logic in `app/services|repositories`.
- `frontend/` — plain JS/JSX (no TypeScript). React Router (public routes are `/:state/...`), Tailwind v4.
- `database/` — SQL for Supabase Postgres. Applied **manually** via Supabase SQL Editor: `schema.sql` → `seed.sql` → `seed_careers.sql`. `migrations/` (`06_`, `07_`, `08_caregiver_portal_gaps.sql`) are run the same way — there is no migration runner.
- `Gemini.MD` — authoritative architecture + AI-agent rules (state-as-data, backend-enforced RBAC + state scoping, no new frameworks). Read before backend work.
- `TODO.MD` — SOW gap audit. Some listed gaps are already shipped (e-sign, announcements, credential reminders); re-verify before assuming a gap still exists.
- `plans/`, `specs/` — feature plans + implementation specs. `specs/README.md`: verify API contracts before building UI.

## Commands (PowerShell, run from the subdir)
- Backend dev server: `.\venv\Scripts\uvicorn app.main:app --reload --port 8000`
- Backend tests: `.\venv\Scripts\python.exe -m pytest -q` — 24 pass; the primary backend verification.
- Frontend dev: `npm.cmd run dev` (port 5173); lint `npm.cmd run lint` (oxlint); build `npm.cmd run build`. **No frontend test runner exists.**
- Seed test accounts: `$env:SEED_TEST_PASSWORD='…'; python seed_accounts.py` — aborts without it (database/seed.sql likewise needs `set_config('app.seed_pwd', …)`). Passwords are never committed.

## Non-obvious constraints
- Backend tests use an in-memory `FakeSupabase` (`backend/tests/conftest.py`) — no live DB/credentials needed. Route modules must reference `get_supabase()`/`get_supabase_anon()` at **call time** (module-level import, call inside functions) so conftest's monkeypatch works. A new route module using Supabase must also be patched in `conftest.py` or it hits placeholder config.
- Only `.env.example` files are committed; `backend/.env` and `frontend/.env` exist locally with real values and are gitignored. `.env` → `VITE_API_URL=http://localhost:8000/api/v1`.
- Security is backend-only: every protected endpoint enforces role RBAC + state scoping server-side; frontend guards are not security. Never trust client-supplied user/role/state IDs.
- Don't hardcode per-state business logic (`if state == "florida"`); represent state differences as DB config unless rules genuinely differ.
- `backend/app/core/config.py` uses Pydantic v2 class-based `Config` style — match it.
- Several admin pages (`Reports`, `Referrals`, `Training`, `Users`, `Settings`, `ClientDetail`) and client `Forms` are literal `<p>TODO: implement</p>` stubs — don't assume they exist.
- Don't add frameworks/infra beyond Vite/FastAPI/Supabase (entry-level MVP; per Gemini.MD Rule 2).

## Verification order
`pytest -q` (backend) → `compileall` if desired → `npm.cmd run lint` → `npm.cmd run build` → manual smoke per `TESTING_CHECKLIST.md`.