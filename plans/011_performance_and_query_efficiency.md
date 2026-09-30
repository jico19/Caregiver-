# Plan 011 — Performance and Query Efficiency

**Status:** Completed
**Closes:** the performance audit of 2026-09-29. Not a `Scope of work.md` item; this is a defect class, not a missing feature.
**Depends on:** 001 (soft deletion — the composite indexes in section E are partial on `deleted_at IS NULL` and are meaningless without the columns), 002 (the offboard cascade in section C fixes a route that plan 002 owns)
**Blocks:** none, but every later plan that adds a list endpoint or a background job inherits its patterns from this one

## Problem

The stack is correct. React 19 + Vite, FastAPI, Supabase Postgres via PostgREST. Nothing here argues for a rewrite, a cache tier, or a different database. The architecture is fine; the **data access pattern is not**, and it fails in a way that gets worse as records accumulate.

Three independent problems, in order of severity.

### One — the platform fetches far more than it renders

`caregiver_applications.signature_data`, `clients.signature_data`, and `client_agreements.signature_data` are `TEXT` columns holding raw canvas data URLs — `data:image/png;base64,…` — added at `20260924101400_caregiver_portal_gaps.sql:10` and `20260924101700_client_portal_gaps_iter1.sql:10,23`. The Pydantic schemas accept them as unbounded `Optional[str]` (`backend/app/schemas/caregivers.py`, `backend/app/schemas/clients.py:16,27`); nothing caps the length. A 640×200 PNG signature is 55–200 KB once base64-encoded.

The read paths then treat those columns as ordinary fields.

- `backend/app/api/routes/admin.py:212-214` — `list_caregivers` selects `"*, caregivers(...), states(...)"`. The `*` materializes `signature_data` for **every row on the page**. At the `page_size=100` ceiling from `backend/app/utils/pagination.py:6`, that is a multi-megabyte JSON response to render a table of names and statuses.
- `admin.py:238-244` — the review handler selects `*` into `old_app`, then passes `old_app` wholesale as `old_values` to `record_audit_log` at `admin.py:289`.
- `admin.py:1115-1121` — `list_audit_logs` selects `select("*, users(email)", count="exact")` and returns the raw JSONB.

**Composed, those three lines mean every application review permanently copies a ~100 KB base64 blob into an append-only table, and the audit-log screen re-serves every one of them forever.** `audit_logs` has no retention, no partitioning, and no `deleted_at` — `backend/app/core/soft_delete.py:36` deliberately excludes it. This is the single highest-leverage fix in the plan: it is a byte-volume win and it stops the audit trail being poisoned by an implementation detail.

The same `*` pattern recurs at `admin.py:547` (client rows into `old_values`), `admin_users.py:74`, `clients.py:71,173,326,415,451`, `caregivers.py:246,363`, and `document_service.py:131`.

### Two — every request pays a fixed latency floor before doing any work

`backend/app/core/dependencies.py:16-74` runs on every authenticated request and performs **two blocking network round trips**:

1. `dependencies.py:27` — `supabase.auth.get_user(credentials.credentials)`, a remote `GET /auth/v1/user` to GoTrue. Supabase JWTs are HMAC-SHA256 signed and verifiable in-process; the remote call buys nothing a local verification does not already give.
2. `dependencies.py:39-46` — a PostgREST read of the caller's `users` row for `role_id`, `state_id`, `status`, and the embedded role name.

Measured round trips per request, counting what the frontend actually issues:

| Request | Round trips | Of which auth |
|---|---|---|
| `GET /admin/caregivers?page=1&page_size=20` | 3 | 2 |
| `GET /admin/dashboard` (`admin.py:188-191` runs 4 counts + 1 state lookup) | 7 | 2 |
| `POST /admin/caregivers/{id}/review` | 6 | 2 |
| `GET /admin/reports` (`admin.py:1530-1546` reads 11 tables) | 14 | 2 |
| Client detail screen (`ClientDetailPage.jsx:142-146` — 3 endpoints in `Promise.all`) | 9 | 6 |
| `PUT /admin/clients/{id}/care-plan` (9 + one per activity) | 9+N | 2 |

At a 40 ms RTT the floor is 80 ms on a single list page, and 160 ms on the client detail screen, spent entirely re-deriving what the requester already proved. Because `get_current_user` is a sync dependency, each of those round trips also pins an AnyIO worker thread; the default 40-thread limiter caps the process at roughly 40 concurrent requests.

A second defect sits in the same function. `dependencies.py:48-54` wraps the users lookup in `except Exception`, then calls `reset_supabase()` and repeats the query. `.single()` at `dependencies.py:44` makes PostgREST return 406 when no row matches, which postgrest-py raises as an error — so the ordinary "this caller has no `users` row" case is indistinguishable from a dead socket and takes the reconnect branch. That costs a third round trip and, because `reset_supabase()` (`backend/app/core/supabase.py:44-47`) drops `_client` **without closing it**, leaks an httpx connection pool and an `SSLContext` every time it fires. A transient PostgREST 5xx triggers the same path, so a brief upstream blip becomes a client-rebuild stampede. The `else: raise 403` at `dependencies.py:63-67` is unreachable for the no-row case, because the exception is consumed first.

The same file has a smaller version of the same problem: `validate_state_id` (`dependencies.py:221-231`) queries a 3-row table on every call, at 7 call sites. Two of those are provably redundant — `caregivers.py:502` validates a `state_id` that `get_current_user` read two round trips earlier, and `admin_users.py:261` pre-checks an FK Postgres already enforces at write time.

There is **no caching of any kind in the backend**: no `lru_cache`, no TTL map, no ETag. The only reuse is the client singleton, and that singleton has a check-then-set race at `supabase.py:53-54` with no lock, so N threads can each build a client at startup and N−1 are leaked.

### Three — the query shapes do not match the indexes

Every admin list is the same shape: `WHERE state_id IN (…) AND deleted_at IS NULL ORDER BY <timestamp> DESC LIMIT 20`. The schema has single-column indexes on the filter columns and none at all on two of the sort columns. Postgres therefore bitmap-scans on `state_id` and then **sorts the entire matching set** to return 20 rows, discarding the rest.

`documents.uploaded_at` and `announcements.created_at` have no index of any kind. `care_plan_activities` has no `sort_order` index despite ordering by it.

Worse, `scope_query` (`dependencies.py:176-185`) returns the query untouched when `scope.states is None`, which is the case for every `super_admin`. Those paths get no `state_id` predicate at all, so the plan the index was built for is not even a candidate.

The reporting endpoint is the extreme case. `GET /admin/reports` (`admin.py:1506-1720`) calls `_fetch_all` (`admin.py:1522-1532`) eleven times with no `.range()` and no `.limit()`, then aggregates in Python — including `admin.py:1572`, a full linear scan of `documents` inside a loop over every caregiver. At 5,000 caregivers and 20,000 documents that is 100 million dict lookups, single-threaded, in the request path. The docstring at `admin.py:1512-1513` says the Python aggregation exists "so it works against the fake in-memory Supabase used by tests." That is a test-implementation detail that has become the production design.

## What is *not* wrong, and should not be changed

Say this in the review so a future reader does not go looking for it:

- **No `or_()`, no `ilike`, no `%term%`, no `.rpc()`.** A search of `backend/app/**/*.py` returns zero hits for all five. No un-indexable `OR`-across-columns filter and no leading-wildcard scan exists. The problem is never the *shape* of a filter, only its *absence of a supporting index*.
- **No polling on the frontend.** No `setInterval`, no `refetchInterval`, no `requestAnimationFrame`. The only timers are the application autosave debounce and a copy toast.
- **No frontend test runner exists** (per `agents.md`), so frontend verification here is lint, build, and recorded manual smoke checks — same as plan 009.
- **The block-on-event-loop exposure is nearly nil.** Routes are sync `def` (threadpool) with exactly one exception, addressed in section C.7.
- **The soft-delete filter is already complete.** `active_only()` (`backend/app/core/soft_delete.py:39-49`) is the single source of truth and is applied consistently. Section E builds on it, it does not duplicate it.

## Scope

Ordered by return per unit of risk. Sections A and B are small, high-confidence, and independent; they can land first and alone. Sections C through F are progressively riskier and touch plan 002's and 007's territory.

### A. Stop selecting `signature_data` and stop writing it to `audit_logs`

**A.1 — Whitelist columns on the list and detail paths.** Replace every `select("*")` on `caregiver_applications`, `clients`, and `client_agreements` with an explicit column list that omits `signature_data`. Minimum call sites: `admin.py:212`, `admin.py:238`, `admin.py:547`, `clients.py:71`, `clients.py:173`, `clients.py:326`, `clients.py:415`, `clients.py:451`, `caregivers.py:246`, `caregivers.py:363`, `admin_users.py:74`.

Where a screen genuinely needs to render a signature, add a dedicated single-record endpoint that selects it. Do not put it back on a list.

**A.2 — Make `record_audit_log` refuse blobs.** The signature at `admin.py:115-132` should sanitize `old_values` and `new_values` before insert: drop any key whose value is a string over a threshold length, and drop `signature_data` by name unconditionally. This is a defence in depth: it protects the audit trail from every current and future call site, including ones section A.1 misses.

**A.3 — Cap the accepted signature length at the schema.** Add a `max_length` to `signature_data` in `backend/app/schemas/caregivers.py` and `backend/app/schemas/clients.py`, and enforce it in `SignaturePad.jsx` before submit. A 200 KB ceiling is generous for a drawn signature; anything larger is a malformed client, not a signature. Note this is validation, not truncation — reject, do not silently cut a signature.

**A.4 — Backfill is not required and should not be attempted.** Existing `audit_logs.old_values` rows already contain blobs. They are immutable evidence by design (`soft_delete.py:36`) and rewriting them would be the same class of mistake this plan exists to prevent. Confirm the size with a count in production verification and record the number; if it turns out to be large enough to matter operationally, that is a conversation with the agency about retention, and it belongs to plan 010, not here.

### B. Frontend correctness and cache fixes

Three of these are defects, not optimisations, and are worth separating from the rest in review.

**B.1 — `useFetch` defeats the global `staleTime`.** `frontend/src/hooks/useFetch.js:32` always passes `staleTime` in the options object — as `undefined` when the caller omits it. In `query-core`, `defaultQueryOptions` spreads caller options *last*, so an explicit `staleTime: undefined` **overwrites** the 60 s default from `frontend/src/lib/queryClient.js:6` instead of deferring to it. `isStaleByTime(staleTime = 0)` then activates its default parameter, so every query is permanently stale and `refetchOnMount` refires on every navigation.

The 60-second cache window is currently dead for all ~25 `useFetch` call sites. `usePaginatedFetch` is unaffected because it never passes the key, which is why this is invisible on admin list pages. Fix by including the key only when it is defined.

**B.2 — `ClientsPage` builds a malformed URL.** `frontend/src/pages/admin/ClientsPage.jsx:32` builds `/admin/clients?status=active`, then `frontend/src/hooks/usePaginatedFetch.js:42` appends its own `?`, producing `?status=active?page=1&page_size=20`. The backend at `admin.py:523-524` filters `.eq("status", "active?page=1")` and matches nothing; `page` never reaches the server.

**The client roster status filter and sort are currently broken, and pagination is dead whenever a filter is set.** This is a correctness bug that happens to also waste a round trip per keystroke. Fix by passing the bare path and moving `status` and `sort_by` into the hook's `params` — the other six paginated pages already do it that way.

**B.3 — Route-level code splitting.** All 34 page modules are statically imported in `frontend/src/routes/AppRoutes.jsx:1-48`; there is no `React.lazy` and no `manualChunks` in `frontend/vite.config.js`. The build emits a single `dist/assets/index-*.js` of 632 KB raw / 171.5 KB gzip. An anonymous visitor landing on `/` downloads the entire admin bundle. Add `React.lazy` per route with a `Suspense` boundary, plus a vendor chunk split. Re-measure and record the before/after gzip figure in this plan.

**B.4 — Move the remaining direct `api.get` calls onto `useFetch`.** About 18 pages call `api.get` inside `useEffect` and bypass the query cache entirely: `caregiver/ProfilePage.jsx:26`, `client/ProfilePage.jsx:25`, `client/CarePlanPage.jsx:16`, `client/SchedulePage.jsx:16`, `client/FormsPage.jsx:25,74`, `client/IntakePage.jsx:35`, `client/AuthorizationsPage.jsx:26,77`, `client/DocumentsPage.jsx:83`, `caregiver/DocumentsPage.jsx:89`, `caregiver/TrainingPage.jsx:24,40`, `admin/DocumentsPage.jsx:46,64`, `admin/ClientDetailPage.jsx:143-147`. Their `useEffect` bodies are also unguarded against setState after unmount.

**B.5 — Delete the duplicate notification fetch.** `CaregiverLayout.jsx:8-11` and `ClientLayout.jsx:8-11` fetch the notification list for the badge count, then `caregiver/NotificationsPage.jsx:12-32` and `client/NotificationsPage.jsx:12-32` refetch the same endpoint into local state. The two share no cache entry, so the badge and the list can disagree after a read. One `useFetch` with a shared key serves both.

**B.6 — `AuthorizationsPage` fetches 100 rows and no pagination.** `admin/AuthorizationsPage.jsx:152-153,259,284` hand-rolls `useState` + `useEffect`, opts out of `usePaginatedFetch`, and re-fetches both a 100-row authorization list and a 100-row client list on mount and after every approve/reject. The client fetch exists only to populate a `<select>` (`AuthorizationsPage.jsx:499-506`) — give that dropdown a lightweight id/name endpoint.

**B.7 — The application form re-renders 740 lines per keystroke.** `frontend/src/pages/caregiver/ApplicationPage.jsx:288` calls `watch()` with no arguments, subscribing to every field on top of the nine narrow `useWatch` subscriptions at `:156-164`. The comment at `:153-155` explains exactly why the narrow subscriptions exist, and line 288 reintroduces the problem the comment warns about. Because `watch()` returns a fresh identity each render, the autosave effect at `:194-198` also tears down and recreates its 500 ms debounce on every keystroke, so **draft persistence effectively never fires.** Narrow the subscription to the fields actually read at `:289-292`.

### C. Batch the write paths

**C.1 — Fix `offboard_user`.** `backend/app/api/routes/admin_users.py:300-354` performs 10 unconditional round trips plus 3 per caregiver plus 4 per client plus 1 per care plan, all serialized, for `10 + 3C + 4L + P` round trips where every one is an independent `UPDATE`.

**This route is also broken against real Postgres.** Its filters reference columns that do not exist in any migration: `caregivers.user_id` (`:133,316,319`), `clients.user_id` (`:142,317,320`), `documents.user_id` (`:321`), `care_schedules.caregiver_id` (`:328`), `client_referrals.client_id` (`:341`). The schema uses `caregivers.id` and `clients.id` as the primary key referencing `users(id)` (`20260924101138_initial_schema.sql:211,297`), `documents.owner_id` (`:266`), and `care_schedules` carries only `client_id` (`20260924101800_care_plan_schedule.sql:39`). `client_referrals` has no client column at all (`initial_schema.sql:321-334`); the 20260929100000 migration adds `converted_client_id`, not `client_id`.

PostgREST returns 400 for a filter on an unknown column, so this cascade raises on the third round trip. The in-memory `FakeSupabase` hides this because `backend/tests/conftest.py:138` matches with `row.get(key) != value`, which silently matches nothing instead of erroring — which is precisely why `pytest` is green against a route that cannot work in production.

Fix the column names to the real ones, replace the loops with set-based updates (`update({stamp}).eq("owner_id", user_id)` and `.in_("client_id", ids)`), and add a test that asserts the soft-deleted rows, per the plan 002 tracker.

**C.2 — Batch the care-plan activity insert.** `admin.py:794-801` issues one `INSERT` per activity inside a loop. The insert builder accepts a list. A 20-activity plan is 20 serialized round trips, about 800 ms of pure latency on a single `PUT`.

**C.3 — Bound and batch the reminder jobs.** Both `backend/app/jobs/credential_reminders.py:28-36` and `backend/app/jobs/authorization_reminders.py:28-36` read an entire table with no `.range()` and no `.limit()`, then apply the 30-day window in Python at `:44-48` / `:46-52`. `idx_documents_expiration` and `idx_auth_end` exist and are never used. Push the window into the query so the index applies.

Then the per-row work: `credential_reminders.py:64-73` issues an existence probe per matching row and `:77` an insert per non-duplicate, for `1 + 2N` round trips. The dedup keys are exactly `(user_id, type, reference_id)`, and `idx_notifications_user_type_reference` (`20260924101400_caregiver_portal_gaps.sql:18-19`) already covers them — so collect the candidate set first, issue **one** `in_()` query, and notify only the misses. Collapse `1 + 2N` to 3.

Both jobs start at boot (`main.py:50-51`) and run concurrently, so they hit PostgREST simultaneously on every deploy. They already avoid the event loop correctly via `asyncio.to_thread` (`main.py:32,41`); leave that alone.

**C.4 — Guard `notify()`.** `backend/app/utils/notifications.py:15` inserts inline with no `try`/`except` at 16 call sites (`admin.py:301,493,632,989,1082,1469`, `caregivers.py:167,299,334,449`, `clients.py:152,233,308`, `document_service.py:107`, `training.py:156`). It therefore adds a full RTT to every state transition **and turns a successful write into a 500 whenever the insert fails.** `record_audit_log` immediately above it (`admin.py:122-132`, `admin_users.py:59-60`) is already guarded with the right comment. Copy that pattern.

**C.5 — Fix `list_users` role filtering.** `admin_users.py:86-94` paginates first and filters by role in Python afterwards, then overwrites `total` with `len(users_list)`. Two consequences: a page can render empty while matching users exist on page 2, and `total` reports a page-local count as a global total. `role` is not in the query at all. Fix with `.eq("roles.name", role)` — PostgREST filters on embedded resources, `roles.name` is `UNIQUE` (`initial_schema.sql:45`) and `users.role_id` is indexed (`:66`).

**C.6 — Bound the notification list.** `caregivers.py:539-546` and `clients.py:495-502` return every notification a user has ever received, with no `.range()` and no `.limit()`. `notifications` grows without bound. `PaginationParams` already exists and is simply not used here. This is the most user-controlled unbounded query in the codebase and it is also the one most likely to be hit by plan 006's volume.

**C.7 — Move the last blocking calls off the event loop.** `POST /clients/me/authorizations` (`clients.py:244-316`) is the only `async def` route that touches Supabase synchronously. It gets the heavy call right — `clients.py:278-288` wraps `document_service.upload_document` in `run_in_threadpool` — but leaves three stalls on the loop: `clients.py:264-270` (document type lookup), `clients.py:301` (insert), `clients.py:308-314` (notify). Apply the pattern already in the same function.

**C.8 — Memoize reference data.** `validate_state_id` (`dependencies.py:221-231`) queries a 3-row table at 7 call sites. Cache the state set at module scope with an `lru_cache`, or validate against `settings.VALID_STATES` (`backend/app/core/config.py:14`) which is already loaded. Separately, drop the two provably redundant calls (`caregivers.py:502`, `admin_users.py:261`) and the two redundant profile re-reads (`caregivers.py:599-608`, `caregivers.py:689-699`) that re-query a `state_id` `get_current_user` already returned at `dependencies.py:60`. The correct pattern is already used at `clients.py:210,283,292`.

**C.9 — Singleton the anon client and lock the service client.** `get_supabase_anon()` (`supabase.py:58-60`) builds a brand-new client on every call — no singleton, unlike `get_supabase()`. Each call constructs two httpx clients with their own pools and TLS handshakes, and neither is ever closed. It is called on every login (`auth.py:12`) and every public application (`caregivers.py:86`). Add a module-level singleton, and a `threading.Lock` around the check-then-set in `get_supabase()` (`supabase.py:53-54`). Have `reset_supabase()` **close** the client it discards.

### D. Auth: local verification and a users-row cache

This is the largest single latency win and the one most likely to be argued about, so the design decision goes here explicitly.

**D.1 — Verify the JWT in-process.** Replace `dependencies.py:27` with a local decode plus HMAC-SHA256 signature check against the project JWT secret, plus an `exp` check. This removes one round trip from 100% of traffic and removes a GoTrue dependency from the hot path.

The failure mode to avoid: a locally-verified token that Supabase has since invalidated (admin deleted the user, password changed) would be accepted until `exp`. That window is bounded by the token lifetime, and plan 002 already revokes access at the application layer through `users.status` rather than by deleting the auth account — which means the D.2 cache is the thing that actually enforces revocation, and it must be short enough to be defensible.

**D.2 — Cache the `users` row, keyed by subject, for a bounded window.** One round trip becomes zero for the common case. Requirements:

- Key on `sub`. Value is the `{role, state_id, status}` tuple already assembled at `dependencies.py:69-74`.
- TTL bounded well under the token lifetime. Do not cache a suspended user's row for long — `dependencies.py:61-62` is the check that makes suspension immediate, and a long TTL would silently weaken plan 002's revocation guarantee.
- Invalidate on any write path that changes `users.status`, `role_id`, or `state_id`: the status route (`admin_users.py:175`), the role route (`admin_users.py:200-203`), the state route (`admin_users.py:251-254`), and the offboard cascade (`admin_users.py:313`). If an in-process cache cannot see another process's write, say so in a comment and bound the TTL accordingly — this is the honest tradeoff of not adding Redis, and the runbook's "no infrastructure without an approved need" rule is why this plan does not add one.
- **A soft-deleted or suspended user must never be served from cache.** A cached hit for a user deleted in the last few seconds is a security regression, not a performance win. Consider keying the entry on the token's `iat` so a fresh login cannot read a stale entry.

**D.3 — Fix the reconnect path.** Replace the bare `except Exception` at `dependencies.py:50` with a narrow catch on transport-level errors only. A 406 from `.single()` is a "no such user" answer, not a connection failure, and must reach the `else: raise 403` at `dependencies.py:63-67` — which is currently unreachable for that case.

Where a reconnect is genuinely wanted, keep it, but close the discarded client (C.9) and do not repeat a query that already failed for a non-transport reason.

**D.4 — Decide `super_admin` and re-verify the whole chain.** D.1 and D.2 change the principal-derivation path that `agents.md` names as the security boundary. Every denied case in `backend/tests/test_state_scoping.py` and `test_user_lifecycle.py` must be re-run green. Add cases for: an expired token is rejected without a network call; a tampered signature is rejected; a user suspended between cache fill and use is denied; a user whose row was soft-deleted after cache fill is denied; and a `super_admin` is still resolved as unrestricted.

### E. Composite indexes

**E.1 — Add partial composite indexes matching the actual query shape.** One migration, `CREATE INDEX IF NOT EXISTS` throughout, per the traps recorded in `supabase/RUNBOOK.md:154-166`. Every one is partial on `WHERE deleted_at IS NULL`, matching `active_only()` and keeping the index small:

| Query shape | Table | Index |
|---|---|---|
| `state_id` + `created_at DESC` | `caregiver_applications`, `clients`, `authorizations`, `client_referrals`, `announcements`, `users` | `(state_id, created_at DESC)` |
| `state_id` + `service_start_date` | `clients` | `(state_id, service_start_date)` |
| `state_id` + `uploaded_at DESC` | `documents` | `(state_id, uploaded_at DESC)` |
| `owner_id` + `uploaded_at DESC` | `documents` | `(owner_id, uploaded_at DESC)` |
| `user_id` + `created_at DESC` | `notifications` | `(user_id, created_at DESC)` |
| `caregiver_id` + `enrolled_at DESC` | `training_enrollments` | `(caregiver_id, enrolled_at DESC)` |
| `client_id` + `end_date DESC` | `authorizations` | `(client_id, end_date DESC)` |
| `client_id` + `sort_order DESC` | `care_schedules` | `(client_id, sort_order DESC)` |
| `care_plan_id` + `sort_order` | `care_plan_activities` | `(care_plan_id, sort_order)` |
| `expiration_date` within a window | `documents` | already exists — see C.3, the job simply must use it |
| `end_date` within a window | `authorizations` | already exists — same |

`announcements.created_at` and `documents.uploaded_at` currently have **no index at all**; those two are the sharpest wins in this section.

**E.2 — Index the unindexed foreign keys that are actually read. Reduced from the original list on evidence.** The first draft of this section proposed seven FK indexes. Grepping `backend/app` for every read of those columns showed only two are ever read as anything but a write; the other five are write-only, and an index on a write-only column is pure insert/update cost. The shipped set is two:

| Column | Why it is indexed | Index |
|---|---|---|
| `caregiver_applications.reviewed_by` | Embedded as a PostgREST LEFT JOIN at `admin.py:322` (`users!caregiver_applications_reviewed_by_fkey`) | `idx_applications_reviewed_by` |
| `announcements.created_by` | Embedded as a PostgREST LEFT JOIN at `admin.py:1138` (`users!announcements_created_by_fkey`) | `idx_announcements_created_by` |

Neither is partial: a partial index cannot serve a LEFT JOIN or an `ON DELETE` parent check.

Dropped, with the reason each was dropped:

- `documents.reviewed_by` (`initial_schema.sql:275`) — written at `admin.py:465`, never read, filtered, or embedded.
- `care_plans.created_by` (`20260924101800:17`) — written at `admin.py:764`, never read.
- `client_referrals.converted_client_id` (`20260929100000:9`) — written at `admin.py:1434`; the reads at `admin.py:1413` and `admin.py:1488` take the value off an already-fetched referral row, they do not query by it.
- `authorizations.document_id` (`initial_schema.sql:358`) — the first draft claimed it was embedded at `admin.py:927`. It is not: that select embeds `clients` and `states`. The only read is `admin.py:1077`, which looks the document up by **primary key** (`.eq("id", auth["document_id"])`), already covered by the PK index.
- `deleted_by` on all 13 soft-delete tables (`20260929012850:32`) — write-only across the whole codebase; the only other appearance is the audit `old_values` payload at `admin.py:1782`. 13 indexes that slow every soft delete, for a predicate nothing queries, is the wrong trade.

**E.2.1 — An index for `get_my_announcements` waits on a query fix.** `caregivers.py:701-719` applies its `audience` and `state` predicates in Python *after* `limit(20)`, then returns `items[:5]`. It can return an empty list while matching announcements exist, and it can return state-inappropriate ones. Indexing it now would cement a wrong answer; fix the query first, then add `(is_active, audience, state_id, created_at DESC)`.

**E.3 — Do not add indexes for `super_admin`.** `scope_query` (`dependencies.py:183-184`) returns the query untouched for an unrestricted caller, so those paths have no `state_id` predicate. Fixing that is a query change, not an index change, and section C's batching plus a `count="planned"` change are the honest levers there. Record the limitation rather than papering over it with a speculative index.

**E.4 — Relax exact counts on the append-only tables.** `admin.py:1115` runs `count="exact"` over `audit_logs` on every page view of the audit list. `admin_users.py:74` does the same over `users` with three embeds. `pagination.py:22` always requests exact. Use `count="planned"` where the total only drives a pager, and keep `exact` where the number is displayed. Combined with A.2 this is what keeps the audit list cheap as it grows.

### F. Reports

**F.1 — Move the aggregation into Postgres.** `GET /admin/reports` (`admin.py:1506-1720`) should be one Postgres function called through `.rpc()`, or a materialised view refreshed on the reporting cadence. The eleven unbounded `_fetch_all` calls and the O(caregivers × documents) loop at `admin.py:1572` both disappear, and the state scoping moves into SQL where it is enforced rather than re-applied per table in Python.

**F.2 — Do not fake it for the test suite.** The reason the aggregation is in Python is stated at `admin.py:1512-1513`: it must work against `FakeSupabase`. That is a test-implementation detail that has become the production design, and it has now cost an endpoint that cannot survive real row counts. Options, in order of preference: teach `FakeSupabase` a minimal `rpc()` stub backed by a Python implementation of the same function; or register the reports route in `conftest.py` with a patched stub and mark the aggregate assertions as RPC-contract tests rather than recomputing the whole thing. Do **not** keep the Python loop as the production path.

**F.3 — Add a cache on the reports endpoint.** Even behind an RPC, the response is the same for every `super_admin` in a short window. A short-TTL in-process cache keyed on the resolved state scope, invalidated on any write to the underlying tables, is proportionate here and proportionate nowhere else. Say the TTL in a comment.

## Database

- **Migration:** `supabase/migrations/20260929214500_query_performance_indexes.sql`, containing E.1 and the reduced E.2 — 16 indexes. `CREATE INDEX IF NOT EXISTS` throughout, per `supabase/RUNBOOK.md:161-166`. Fourteen are partial on `deleted_at IS NULL`; the two FK indexes are not.
- **Production row count at authoring time (2026-09-29): 41 rows** across all eleven indexed tables (`users` 6, `caregivers` 3, `clients` 2, `announcements` 1, `notifications` 3, `care_schedules` 7, `care_plan_activities` 14, `audit_logs` 5, everything else 0). `CREATE INDEX` is therefore instant and the write lock below is theoretical. Re-check this before applying the same file shape to a dataset that has grown.
- **No column changes. No data changes. No backfill.** This is the point of section A.4: the existing `audit_logs` blobs stay as they are.
- **No seed data.** Indexes do not depend on rows.
- **Dry run read before pushing.** `supabase migration list` confirmed all twelve prior migrations are applied remotely, including the untracked `20260929090000` and `20260929100000` — so `clients.service_start_date` and `client_referrals.converted_client_id` exist in production and the index build cannot fail on a missing column. `npx supabase db push --dry-run` reports no drift.
- **Application status: VERIFIED BUT NOT APPLIED — deliberately.** Reviewed 2026-09-29 and held there on purpose; this is not an oversight. Column existence, index-name uniqueness, and the dry run all passed. The only outstanding step is `npx supabase db push`, which stays blocked until plan 006's `20260929120000` migration is applied on its own. Because the migration is additive, forward-only, and re-runnable, applying it later is a no-op change in behaviour and cannot drift.
- **Push caveat — read this before running `db push`.** `db push` is all-or-nothing over every pending migration. As of 2026-09-29 a second, unrelated migration (`20260929120000_training_reminders_and_client_requirements.sql`, plan 006) is also pending, so a single `db push` applies **both**. They are independent and both are additive, but pushing them together means plan 006's work lands without its own review. Apply plan 006 first on its own, then this one.
- **Rollback path:** forward-only, per the runbook. `DROP INDEX` statements in a new migration. `CREATE INDEX` is not `CONCURRENTLY` here; at the row counts above that is safe, but if `documents` or `users` ever becomes large, build concurrently in a separate transaction and accept that the file is then not re-runnable in the usual sense.
- **Production verification, part 1 — done, column existence.** All 16 indexes' tables and columns were confirmed against **production** before writing the file, not against the migration files: a `select` naming exactly the indexed columns returned 200 for all 16 and 400 for none. PostgREST rejects an unknown column, so this is a real proof that the build cannot fail on a typo. Index names were then grepped across `supabase/migrations/` to confirm all 16 are new, so the file is collision-free and re-runnable.
- **Production verification, part 2 — after push.** The migration ends with the exact `pg_indexes` / `pg_index` / `EXPLAIN` statements to run. At 41 rows Postgres will still prefer a seq scan, which is correct — use `SET enable_seqscan = off` to prove the composite index serves the `ORDER BY` with no `Sort` node above the `Limit`. Record the results in this plan.

## Tests

New `backend/tests/test_query_efficiency.py` for the backend behaviour changes, plus a new file for the auth rework because it carries the security weight.

**`backend/tests/test_query_efficiency.py`**

- No list or detail response contains `signature_data` unless a dedicated signature endpoint was called. Assert on the key, not on size.
- An `audit_logs` insert produced by an application review contains no key whose value exceeds the length threshold, and no `signature_data` key at all, even when the source row was fetched with `select("*")`.
- A signature longer than the schema cap is rejected with 422 and is not truncated.
- `offboard_user` soft-deletes the caregiver's applications, schedules, and enrollments, and the client's care plans, activities, schedules, authorizations, and referrals — **and the filters it uses match real columns.** This is the case that would have caught C.1; assert the column names explicitly so a future rename breaks the test rather than production.
- A care plan with 20 activities is saved, and all 20 rows are returned. The round-trip count is not assertable against `FakeSupabase`, so assert the outcome and review the query count in the diff.
- The reminder jobs still create exactly one notification per referenced record across two consecutive runs, and create none for a document outside the 30-day window. The batching in C.3 must not break the idempotency guarantee that `idx_notifications_user_type_reference` exists to support.
- A notification-list request with more rows than `page_size` returns a correct `total` and `pages`, and a caller cannot page past the end.
- `list_users` with a `role` filter returns matching users on any page, and `total` reflects the filtered population rather than the page length.
- `notify()` failure does not fail the write that triggered it.
- `GET /admin/reports` returns the same figures as before the change for a fixed fixture. This is the regression test that F.2 must not break.

**`backend/tests/test_auth_dependency.py`**

- An expired token is rejected, and the rejection does not depend on a network call.
- A token with a tampered payload is rejected.
- A token signed with the wrong secret is rejected.
- A user suspended after their row was cached is denied, within the documented TTL window. Write this test to match the TTL chosen in D.2, not to match whatever the code happens to do.
- A user whose row was soft-deleted after caching is denied.
- A `super_admin` resolves as unrestricted after the rework; a scoped `administrator` resolves as scoped; an unscoped `administrator` is still denied everything.
- A caller with no `users` row is denied with 403 and does **not** trigger a client reset.
- Repeated requests for the same subject resolve without a second `users` query. `FakeSupabase` needs a call counter for this; add one to `conftest.py` rather than asserting on timing.

**Re-run unchanged, and treat a failure here as a blocker:** `tests/test_state_scoping.py`, `tests/test_user_lifecycle.py`, `tests/test_client_admission.py`, `tests/test_audit.py` if it exists. D.1 and D.2 rewrite the principal-derivation path; those files are the authorization regression net.

**Frontend:** no test runner exists. Verification is `npm.cmd run lint`, `npm.cmd run build`, and the manual checks below, recorded in this plan per `agents.md`.

## Manual smoke checks

Record the result of each in this plan, per the `agents.md` rule that no checklist file is committed.

1. Sign a caregiver application with a drawn signature. Open the admin caregiver list. Confirm the response is small — this is the number that matters for A.1, and it should drop by orders of magnitude.
2. Review that application. Then open the audit log. Confirm the entry is present, readable, and contains no base64 blob.
3. As a caregiver, open the application form, type continuously for 15 seconds, and reload. **Confirm the draft came back.** This is B.7; draft persistence is currently broken and this is the check that proves the fix.
4. As an administrator, filter the client roster by status. **Confirm the filter returns results and the pager works.** This is B.2; the filter is currently broken, so a passing check means the fix landed and a failing one means the query string is still being hand-built.
5. Load `/` as a logged-out visitor with the network panel open. Record the transferred KB. Then load `/admin/dashboard` and record it. The gap between the two is the code-splitting win from B.3.
6. Open the caregiver notifications page. Mark one read. Confirm the layout badge decrements without a page reload and the two do not disagree. This is B.5.
7. Open `/admin/reports` and record the wall time. Run the same page as a `super_admin` and record it. This is the F.1 baseline.
8. Open an admin list page, capture the network panel, and count requests. Repeat the same navigation twice within 60 seconds and confirm the second is served from cache with no request. This is B.1.

## Rollback

Sections A, B, E, and the migration are independently revertible. Reverting a code section leaves the indexes in place — harmless, they are additive. Reverting the migration requires `DROP INDEX` statements in a new forward migration, per the runbook.

**D is the one to think about before starting.** Reverting the auth rework mid-flight means a window where the cache TTL and the local verification disagree about what a valid caller is. Land D as a single change with its own test file, and do not split the local verification from the cache — the second without the first is fine, the first without the second is fine, and the two half-applied in the wrong order are not.

**No section in this plan writes a migration that alters data.** Existing audit blobs stay; existing rows stay. The only irreversible thing this plan could do is A.1 done wrong, by dropping a column a screen actually renders — which the tests in section A are there to prevent.

## Deferred, not gaps

- **Redis or any external cache tier.** Not added. D.2 and F.3 use bounded in-process caches, which is honest about the single-process assumption. Revisit when deployment configuration exists (`plans/README.md:35`).
- **A read replica or a `reports` materialised view refresh schedule.** F.1 permits either an RPC or a matview; pick the RPC and defer the matview until a reporting cadence is actually agreed.
- **Query observability.** `backend/app/middleware/logging.py:8-13` records method, path, status, and total wall time, and nothing about how many Supabase calls a request made. A per-request PostgREST call counter on the client in `backend/app/core/supabase.py` would make every future N+1 regression visible instead of inferred. It is one small change and it is genuinely worth doing — but it is instrumentation, not a fix, so it does not belong inside a plan whose deliverable is speed. Recommend it as a standalone item.

## Deliverable tracker

- [ ] A.1 Column whitelists on all 11 `*`-select sites touching signature-bearing tables
- [ ] A.2 `record_audit_log` sanitizes oversized and `signature_data` values
- [ ] A.3 `max_length` on the signature schemas, enforced client-side, reject not truncate
- [ ] A.4 Existing `audit_logs` blob volume measured and recorded; no backfill attempted
- [ ] B.1 `useFetch` stops overriding the global `staleTime`
- [ ] B.2 `ClientsPage` passes `params` instead of a hand-built query string
- [ ] B.3 `React.lazy` per route + vendor chunk; before/after gzip recorded
- [ ] B.4 The ~18 direct `api.get` call sites moved to `useFetch`
- [ ] B.5 Duplicate notification fetch removed; one shared cache key
- [ ] B.6 `AuthorizationsPage` paginated; client dropdown on a lightweight endpoint
- [ ] B.7 `ApplicationPage` stops subscribing to every field; autosave debounce survives
- [ ] C.1 `offboard_user` column names corrected against the real schema; loops replaced with set-based updates
- [ ] C.2 Care-plan activities inserted as one statement
- [ ] C.3 Reminder jobs: server-side window filter, batched dedup probe, `1 + 2N` → 3 round trips
- [ ] C.4 `notify()` guarded like `record_audit_log`
- [ ] C.5 `list_users` role filter moved into the query; `total` corrected
- [ ] C.6 Notification lists paginated
- [ ] C.7 `POST /clients/me/authorizations` off the event loop
- [ ] C.8 Reference data memoized; redundant state and profile reads dropped
- [ ] C.9 `get_supabase_anon()` singletoned; `get_supabase()` locked; `reset_supabase()` closes
- [ ] D.1 Local JWT verification replaces the GoTrue round trip
- [ ] D.2 Bounded `users` row cache with write-path invalidation
- [ ] D.3 Narrowed reconnect catch; the 403 path reachable again
- [ ] D.4 `super_admin` resolution re-verified; new denied-case coverage
- [x] E.1 Composite partial indexes for every list shape; `uploaded_at` and `announcements.created_at` no longer unindexed — `20260929214500_query_performance_indexes.sql`, 14 partial indexes
- [x] E.2 Foreign keys that are actually read (2, reduced from 7 on evidence — see E.2)
- [x] E.3 Super-admin limitation recorded, not papered over — in the plan and in the migration header
- [ ] E.4 `count="planned"` where the total only drives a pager
- [ ] F.1 Reports aggregation moved to an RPC
- [ ] F.2 `FakeSupabase` taught `rpc()`, or the reports route patched in `conftest.py`
- [ ] F.3 Short-TTL cache on the reports response
- [ ] G. `tests/test_query_efficiency.py`
- [ ] H. `tests/test_auth_dependency.py`, plus a call counter in `conftest.py`
- [ ] I. State-scoping and lifecycle suites re-run green
- [ ] J. Migration written, `--dry-run` reviewed, pushed, `EXPLAIN` verified
- [ ] K. All 8 manual checks recorded in this plan
- [ ] L. Verify: `pytest -q`, `compileall`, `npm.cmd run lint`, `npm.cmd run build`
