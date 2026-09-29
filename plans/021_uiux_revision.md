# Plan 021 — Frontend UI/UX Revision (audit-driven)

**Status:** Approved — phased; Phase 0 in progress
**Color rule:** the #2563eb blue / emerald success / amber warning / red danger palette is **kept**. Work codifies it into tokens (per-iteration token class count is measured), never changes the brand feel.

## Source

Read-only UI/UX audit of the full `frontend/src` tree (admin, client, caregiver, public pages + layouts + shared components + `index.css`), evidence-backed with file:line refs. Full findings catalogued in the audit; this doc is the **revision plan**.

## Root causes (the real problems, not symptoms)

| ID | Root cause | Where | User impact |
|----|-----------|-------|-------------|
| A1 | Caregiver-application autosave hits `watch()` object identity → effect + 500ms localStorage write loop forever | `caregiver/ApplicationPage.jsx:153-178` | CPU/storage churn; debounce never fires; renders thrash while idle |
| A2 | Client authorizations "expiring soon" countdown **inverted** — warning hidden exactly when ≤30 days remain | `client/AuthorizationsPage.jsx:268-281` | The record that needs urgent attention shows no countdown |
| U1 | Undefined classes: `.print-hidden` (certificate print includes nav+buttons), `.stat-card-error` (expired credential looks normal) | `index.css` / `TrainingCertificatePage.jsx:50,98` / `DashboardPage.jsx:142` | Broken print output; missing danger signal on health-critical state |
| A3 | Popup-blocker: `await` then `window.open()` in 4 document flows → silently blocked tab | `client/DocumentsPage.jsx:82-86` + `AuthorizationsPage.jsx:89-95`, `caregiver/DocumentsPage.jsx:90-98`, `admin/AuthorizationsPage.jsx` | "View/download" click appears to do nothing on slow connections |
| A4 | Stale file input keeps its filename after upload; success + refresh share one try/catch → contradictory alerts | `client/DocumentsPage.jsx:75-84`, `caregiver/DocumentsPage.jsx:75-88` | Duplicate uploads; "uploaded" + "failed" shown together |
| A5 | Admin authorizations API caps at `page_size=100`, no pagination — records silently vanish | `admin/AuthorizationsPage.jsx:152` | Any real agency loses rows 101+ from every filter/KPI |
| S1 | Errors swallowed with bare `catch {}` (mark-read) or discarded (dashboards) — pages lie on failure | `client/NotificationsPage.jsx:41-53`, caregiver `DashboardPage.jsx:10-15`, client `DashboardPage.jsx` | "Marked as read" that didn't persist; intake/KPI silently blank |
| X1 | Tap targets below 44px across tables/actions | many (`.btn-* pager/approve/copy/stat`, row actions) | Slip-taps on touch devices; WCAG 2.5.8 fail |
| X2 | `--color-muted` (#94a3b8) ≈ 2.5:1 contrast — legal text, timestamps, email rendered in it | `index.css:21`, dozens of pages | WCAG AA fails on meaningful content |
| T1 | Three competing card surfaces + hardcoded hex + non-token palette classes (emerald/green/yellow/red-xxx) | many pages + `index.css` | Visual drift; theme can't be re-tinted; no single source of truth |

## Phasing

Deliberately ordered so each phase ships + verifies independently, lowest-risk/highest-value first)Skip nothing that shows up in Phase 0 as the same root cause.

### Phase 0 — Correctness & data honesty (this round)
Smallest concrete corrections for the defects that actively **mislead the user** or **lose data**:

1. **Kill the autosave loop** — `ApplicationPage.jsx`: replace the unbounded `watch()` dependency with `useWatch` on the specific fields + a stable serialized key; skip save when the serialized draft equals the last-saved draft (prevents no-op writes and re-renders).
2. **Fix inverted countdown** — `client/AuthorizationsPage.jsx`: the `!isExpiringSoon &&` guard (line 281) becomes `isExpiringSoon &&`, styled `text-warning`; distant dates suppress instead.
3. **Define missing utilities** in `index.css`: `.print-hidden` + `@media print` rules for certificate/doc pages; `.stat-card-error` (danger variant mirroring success/warning); also add the missing `.stat-card-*` tokens for `submitted` state.
4. **Popup-safe downloads** across all 4 flows: synchronous `window.open('', '_blank')` in the click handler, then set `location` after fetch; fallback to an on-page link if blocked.
5. **Reset file input + split try/catch** in client + caregiver DocumentsPage: clear the input via ref after success; wrap list-refresh in its own try/catch so a failed refresh never shows a spurious "upload failed".
6. **Pagination on admin AuthorizationsPage**: switch to `usePaginatedFetch` + `Pagination` (already used by sibling pages); compute metrics from the fetched page; remove the hardcoded `page_size=100`.
7. **Surface swallowed errors + pending/disabled states**: NotificationsPage mark-read/mark-all (busy flag, disabled, error into banner); Dashboard pages read `error` from `useFetch`, render an error panel with Retry, and never fabricate a "pending intake" from a failed fetch.

**Verification (Phase 0):** `npm.cmd run lint` → `npm.cmd run build` → backend `pytest -q` (unchanged) → manual smoke.

### Phase 1 — Design-system codification (same palette)
Contract the visual system onto tokens. Net effect: same colors, one source of truth.
- Collapse `.card` / `.admin-card` / `.table-card` / `.kpi-card` border/padding drift → one `.card` + `.-tight`/`.-loose` sizes.
- Strip hardcoded hex (`#0f172a`, `#bfdbfe`, `#f1f5f9`, `#2563eb`, `#94a3b8`, `#fef2f2`, …) → `var(--…)` tokens.
- Replace non-token palette utilities (`emerald-*`, `green-*`, `amber-*`, `red-*`, `gray-*`, `slate-*`, `border-red-200`, `text-red-600`) on meaningful content with `primary/success/warning/danger/muted/ink` token classes.
- One button hierarchy: `.btn-primary` / `.btn-primary-cta` (task), `.btn-success` (approve/submit), `.btn-outline-secondary` (navigate/download), `.btn-ghost` (secondary). Download actions are never success-green.
- Fix `--color-muted` contrast: bump to ~#64748b or reserve for decoration only; re-audit AA on legal text.
- Normalize `stat-*` / `badge-*` / `metric-*` vocabularies (drop competing `.stat-label-warning` vs `.metric-label-amber`).

### Phase 2 — Feedback primitives (shared)
- `LoadingState` everywhere (`role="status"`), respect `count` on `page` variant, `aria-hidden` skeletons, reduced-motion guard.
- `ErrorPanel` with Retry across load errors; empty-state components with next steps.
- Async buttons: pending/disabled on mark-read, approve/reject, review, upload, delete; confirm + pending on one-click-only actions (training complete, auth reject).
- Inline field validation: `aria-invalid`, `aria-describedby`, focus first invalid, clear on change; replace detached top-of-page banners and native `alert()`.
- Success focus/scroll-to-top after long-form submits.

### Phase 3 — Navigation & a11y
- Mobile drawer → modal (`role="dialog" aria-modal`, focus trap + return, click-outside, `aria-expanded`, scrollable drawer on short screens).
- Portal nav active state via `.nav-link` classes + accent token (not inline styles); keyboard focus-visible preserved.
- Drop fake `role="menu"` keyboard semantics; valid-state slug whitelist → redirect; single `DEFAULT_STATE` source; remove numeric state-id → code fallback in favicon.
- Pagination aria-labels, `<a>`-styled-buttons → real buttons, 44px min targets, label `htmlFor` matches.

### Phase 4 — Task clarity & form flow
- Page-header hierarchy: obvious single primary CTA per screen; demote secondary actions.
- Multi-step progress (caregiver application, client intake): step counter/roadmap, distinct submitted state, focus via signatures.
- Fix hardcoded "Active Certification", "Under Review" pre-review labels, per-state label drift ("Operating State" / "Licensing State Branch").
- Keyboard-accessible signature (typed-name fallback + keyboard canvas).

### Phase 5 — Layout & responsiveness
- Early-collapse grids (`max-xl`) on authorizations/forms; balanced caregiver quick-actions; admin nav overflow menu; `.grid-cols-3` → token grid.

## Deliverable tracker (Phase 0)

- [ ] 1. ApplicationPage autosave loop (useWatch + skip no-op)
- [ ] 2. client/AuthorizationsPage countdown inversion + token colors
- [ ] 3. index.css: `.print-hidden`, `@media print`, `.stat-card-error`
- [ ] 4. Popup-safe downloads (4 flows)
- [ ] 5. File-input reset + split try/catch (client + caregiver DocumentsPage)
- [ ] 6. admin/AuthorizationsPage pagination
- [ ] 7. Swallowed-error surfacing + pending/disabled (Notifications + 2 Dashboards)
- [ ] Verify: lint → build → pytest → smoke
