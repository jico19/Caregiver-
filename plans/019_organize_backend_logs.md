# Plan 019: Organize backend logs into dedicated streams (access, app, error)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `018_organize_backend_error_logs.md`
- **Category**: dx
- **Planned at**: commit `a6fc079`, 2026-10-06
- **Implementation status**: Completed

## Why this matters

Monolithic logging in `app.log` mixed inbound HTTP requests, chatty `httpx` PostgREST queries, background jobs, and system events into a single file. Outbound `httpx` calls generated over 70% of total log volume. Separating streams (`access.log` for inbound API traffic, `app.log` for application/domain lifecycle and background jobs, and `error.log` for JSON errors) provides clean log separation. Adding `occurred_at` and `timestamp` fields to `error.log` allows immediate human triage without deciphering raw UTC epoch floats or shorthand fields.

## Current state

- `backend/app/core/logging_config.py`: configures `app.log` (INFO), `access.log` (INFO via `app.access` logger, `propagate=False`), and `error.log` (ERROR, JSON format with `occurred_at`, `timestamp`, `ts`, `fingerprint`). Silences `httpx` and `httpcore` to `WARNING`.
- `backend/app/middleware/logging.py`: logs inbound request completion to `app.access` (`access.log`), keeping `app.log` clean of HTTP access noise.
- `backend/tests/test_error_logging.py`: verifies presence and routing to `access.log`, `app.log`, and `error.log`.

## Verification commands

- `.\venv\Scripts\python.exe -m pytest -q tests/test_error_logging.py`
- `.\venv\Scripts\python.exe -m pytest -q`
- `.\venv\Scripts\python.exe -m compileall -q app tests`

## Done criteria

- [x] Inbound HTTP requests routed to `backend/logs/access.log`.
- [x] Application lifecycle and background jobs kept in `backend/logs/app.log`.
- [x] Verbose outbound `httpx` queries suppressed to `WARNING`.
- [x] `backend/logs/error.log` records include `occurred_at` (formatted UTC string) and `timestamp` (ISO 8601).
- [x] All 250 backend tests pass.
- [x] Compile check exits 0.
