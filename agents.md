# Caregiver Platform Agent Guide

## Product and architecture

One platform serves Florida, Indiana, and Georgia. State is data and an authorization boundary; do not build per-state applications or hardcode state-specific behavior unless a rule cannot be configured.

Stack: React 19 + Vite frontend, FastAPI backend, Supabase Postgres/Auth/Storage. Keep the MVP monolithic. Do not add frameworks or infrastructure without an approved need.

Protected access is enforced in the backend. Never trust client-supplied user, role, or state identifiers. `administrator` users access only their assigned state. `super_admin` users may access all states. An unscoped `administrator` is denied access.

## Repository map

- `backend/`: FastAPI routes, schemas, services, tests, and jobs.
- `frontend/`: JavaScript/JSX React application.
- `supabase/`: schema, migrations, seeds, and the Supabase CLI config. Read `supabase/RUNBOOK.md` before changing or applying SQL.
- `plans/`: active and historical implementation plans. Read `plans/README.md` before acting on a plan.
- `Scope of work.md`: product scope. No manual checklist files are committed. Record manual smoke checks in the applicable plan and in the change report.

## Agent style and skill use

- Caveman is always on at session start, level `lite`. Terse replies, no filler, technical terms and exact strings preserved. The user ends it with `stop caveman` or `normal mode`.
- Load the skill that matches the task before working. Skills cover planning, review, safe refactor, migration, and verification. Do not work inline when a skill fits.
- Feature work starts with the `grill-me` skill to sharpen scope and acceptance conditions before any code is written.

## Required workflow

1. Read this guide and the task-relevant source, tests, plan, and runbook.
2. Check `git status --short`. Preserve unrelated existing edits.
3. Classify scope: frontend, backend, database, protected access, or cross-layer.
4. Map callers, routes, schemas, SQL, and tests affected by the change.
5. State the bounded change contract: files, API or schema changes, authorization/state behavior, verification, and rollback for operational changes.
6. Implement the smallest complete change. Do not jump from a request directly to UI when an API, authorization, or data contract is affected.
7. Add or update focused tests. Protected changes require allowed and denied cases for role, owner, state, and `super_admin` where applicable.
8. Run relevant verification, then full gates for cross-layer work. Report commands, results, manual checks, and remaining risk.
9. Update the applicable plan or checklist when work changes its status. Do not create duplicate plan numbers.

## Database changes

Schema changes go through the Supabase CLI. `supabase/migrations/` is the single source of truth for schema, `supabase/seeds/` for demo data; the SQL Editor is no longer the apply path. A database change must name its migration file, seed data if any, rollback path, and production verification. Follow `supabase/RUNBOOK.md`.

The CLI is not installed globally; invoke it as `npx supabase <command>` from the repository root. There is no local database: `db start`, `db reset`, and `db diff` are unavailable, so a migration is verified against production or not at all. Read the `--dry-run` output before every push and write forward-only migrations.

## Test and implementation constraints

- Backend tests use in-memory `FakeSupabase` in `backend/tests/conftest.py`. Supabase route calls must resolve `get_supabase()` or `get_supabase_anon()` at call time so tests can patch them. Patch a new route module in `conftest.py` before testing it.
- Only `.env.example` files are committed. Never commit passwords or service keys.
- Use Pydantic v2 class-based `Config` style in `backend/app/core/config.py`.
- Match existing JavaScript/JSX frontend conventions. No frontend test runner exists yet; use lint, production build, and targeted manual smoke checks.

## Commands

Run from the named subdirectory.

- Backend tests: `.\venv\Scripts\python.exe -m pytest -q`
- Backend compile check: `.\venv\Scripts\python.exe -m compileall -q app tests`
- Frontend lint: `npm.cmd run lint`
- Frontend build: `npm.cmd run build`
- Backend dev server: `.\venv\Scripts\uvicorn app.main:app --reload --port 8000`
- Frontend dev server: `npm.cmd run dev`

Cross-layer verification order: backend tests, backend compile check, frontend lint, frontend build, then the targeted manual smoke checks for the area touched.
