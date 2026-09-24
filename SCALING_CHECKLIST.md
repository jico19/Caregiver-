# Scaling Checklist — Caregiver Platform

Target scale: **low thousands of portal users** (caregivers/clients/admins) with
moderate public-site traffic. Each item has "why" + "how", keyed to real code
so you don't have to hunt. Ladder: do Tier 1 before traffic grows; Tier 2 when
you feel latency or connection exhaustion; Tier 3 only if public traffic explodes.

---

## Tier 1 — Cheap, high-leverage, do soon

- [ ] **Cache public content (states/services/forms/licensing/careers).**
  Why: these are static but hit Postgres on every page load — the #1 latency
  cost of public traffic.
  How: short-TTL in-memory cache (e.g. `functools.lru_cache`/`cachetools` TTL)
  keyed by state in `app/api/routes/states.py`; invalidate on seed changes. No
  new framework needed.

- [ ] **Paginate unbounded admin lists.**
  Why: `list_caregivers`, `list_admin_clients`, `list_admin_documents` return
  the entire table — response size and query time grow linearly with records.
  How: `limit`/`offset` (or keyset on `created_at`) query params in
  `app/api/routes/admin.py`; return `{data, total, next_offset}`.

- [ ] **Add composite indexes for the pending-growth ORDER BYs.**
  Why: `caregiver_applications` orders by `created_at desc` with no index, so
  sorts escalate as rows grow.
  How: migration adding `CREATE INDEX ... ON caregiver_applications(created_at)`
  and `ON caregiver_applications(status, created_at)`; same for
  `documents(status, uploaded_at)`.

- [ ] **Add rate limiting on public POST endpoints.**
  Why: `contact`, `apply-public`, `register` are unauthenticated DB-write paths
  with no abuse control.
  How: simple per-IP+route limiter (in-memory or
  `slowapi`) on `states.py` contact + `caregivers.apply-public` +
  `auth.register`.

- [ ] **Decide uvicorn worker count consciously.**
  Why: default run is 1 worker / ~40 threadpool threads; each worker holds its
  own Supabase client + connection pool.
  How: start at 2–4 `--workers`; keep total connections under Supabase's plan
  limit or point the service client at the connection pooler. Test with
  `--workers 4` before trusting it.

---

## Tier 2 — Portal latency & auth path

- [ ] **Shorten the per-request auth round trips.**
  Why: every authenticated call does `auth.get_user(token)` (remote) AND a
  `users` DB lookup (`app/core/dependencies.py:19-28`) before business logic —
  ~2 extra round trips per request.
  How: verify the JWT locally (cached signing key) for the auth step, keep the
  `users` lookup but add a short-TTL cache (30–60s) on `{user_id}` so role/state
  lookups don't hit Postgres every call. Do **not** move role/state into the
  JWT (stale-claims trap); cache server-side only.

- [ ] **Stream file uploads instead of buffering.**
  Why: `documents.py` reads a whole (≤10 MB) file into memory per upload;
  concurrent upload spikes pressure RAM.
  How: chunked read + Supabase storage upload from a stream when the SDK allows;
  keep the existing size guard.

- [ ] **Bound the credential-reminder scan.**
  Why: `app/jobs/credential_reminders.py` scans every `documents` row daily.
  How: partial index on `(status, expiration_date)` where status in
  (`approved`) — or filter the query to non-expired rows. Low urgency at this
  scale, cheap to do.

- [ ] **Prune/archive old notifications + audit logs.**
  Why: both grow unbounded and are ordered `created_at desc`; they'll slow
  over years.
  How: scheduled cleanup job (e.g. delete read notifications > 90d,
  archive audit_logs > 1y to a bucket/warehouse).

---

## Tier 3 — Only if public traffic explodes

- [ ] **Move the public site to a CDN / static generation.**
  The public `/florida/*` pages are the only high-QPS surface; serve them from
  a CDN with the API as origin, or prerender them in the build.

- [ ] **Add an APM/observability layer.**
  Request logging middleware already exists (`app/middleware/logging.py`);
  extend it to emit metrics (latency, DB call counts, cache hit rate) — you
  can't tune what you can't see.

- [ ] **Consider a separate read replica / PostgREST for public reads** if
  Postgres write load ever becomes the constraint. (Not before.)

---

## Explicit non-goals (avoid these)

- ❌ Splitting into microservices — the single service-role funnel is correct
  for a compliance-heavy app; the ceiling is query efficiency, not the pattern.
- ❌ Async Supabase client rewrite — threadpool `def` handlers already cover it.
- ❌ Putting role/state into the JWT for "fast authz" — stale-claims + replay
  risk; keep server-side checks.