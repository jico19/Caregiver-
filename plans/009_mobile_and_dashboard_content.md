# Plan 009 — Mobile Application and Dashboard Content

**Status:** Completed
**Closes:** `Scope of work.md:17` (mobile-friendly application), `Scope of work.md:88-93` (client dashboard)
**Depends on:** 001 (soft deletion)

**No frontend test runner exists**, per `agents.md:42`. This plan is verified by lint, production build, and manual checks on a physical phone. Say so in the plan review rather than pretending otherwise.

## Problem, part one — the application is not designed for a phone

`Scope of work.md:17` asks for a mobile-friendly application. It loads on a phone and is technically usable, but it was not laid out for one.

`frontend/src/index.css` contains exactly two media queries: `@media (max-width: 768px)` at line 211, and `@media print` at line 881. The screen breakpoint only toggles the navbar between `.desktop-nav` and `.mobile-menu-toggle`. Nothing else in the 897-line stylesheet responds to viewport width.

`frontend/src/pages/caregiver/ApplicationPage.jsx` contains exactly one responsive class, `max-md:grid-cols-1` at line 470, and it sits inside the read-only summary block, not the editable form at lines 508-807. The form itself relies on `.form-grid-2` and `.form-grid-3`, which use `repeat(auto-fit, minmax(240px, 1fr))` at `index.css:681-688`. Those do collapse, so the form stacks rather than overflows — by accident of `auto-fit`, not by design.

What is actually missing: no small-screen treatment of the multi-section form, no mobile nav inside the form, no type or spacing adjustment on narrow screens, and no touch or input-mode tuning on the date of birth, phone, and SSN fields that the form collects (`ApplicationPage.jsx:515-666`).

The good news is real: the viewport meta tag is present at `frontend/index.html:6`, and `SignaturePad` handles touch correctly with pointer events and `touchAction: 'none'` at lines 41-84 and 100. The hardest part already works.

## Problem, part two — dashboards that show links instead of information

`frontend/src/pages/client/DashboardPage.jsx` is 139 lines and fetches exactly two endpoints, `/clients/me` at line 10 and `/clients/me/authorizations` at line 11.

Against the six items in `Scope of work.md:88-93`:

| Item | Current state |
|---|---|
| View care plan | Link only, line 113 |
| View service schedule | Link only, line 121 |
| View forms | Not linked from the dashboard at all; reachable only from the nav |
| View uploaded documents | Descriptive text and a link, lines 97-108; no data fetched |
| View authorization status | A count, lines 81-94 |
| Receive agency notifications | Link only, line 129 |

A client or a family member opening their dashboard learns nothing without clicking through four separate pages. For the audience most likely to be using a phone, and least familiar with the system, that is the wrong first impression.

**One of those is also wrong rather than merely empty.** Line 81 renders `{authorizations.length} Active`. But the endpoint at `clients.py:312-345` returns *every* authorization, including pending, expired, and rejected. The label says "Active" and the number counts all of them. A client with three expired authorizations is told they have three active ones. That is a false statement on a healthcare record, not a cosmetic slip.

## Scope

### A. Mobile layout for the application

- Screen breakpoints in `index.css` at 640px and 900px alongside the existing 768px, applied to the form section rather than only the navbar.
- A mobile step navigation in `ApplicationPage.jsx`, so a long multi-section form is navigable on a small screen rather than being one continuous scroll. The page already tracks roadmap steps through `ROADMAP_STEPS` in `frontend/src/utils/caregiverStatus.js:1-5`, so the state to drive this exists.
- Input-mode and autocomplete attributes on the date, phone, and SSN inputs.
- Minimum 44px touch targets on form actions, per WCAG 2.5.8.
- Draft autosave on mobile: confirm a backgrounded tab still persists, since a phone screen locks mid-form.

### B. Client dashboard content

Render real data instead of links, reusing the read endpoints that already exist and reusing `LoadingState` and the existing empty and error patterns:

- Next scheduled visit, from `/clients/me/schedule`.
- Care plan summary, from `/clients/me/care-plan`.
- Outstanding agreements to sign, from `/clients/me/agreements`. The agreements list is the item that should drive an action, since an unsigned agreement blocks service.
- Current authorization with real status and days remaining.
- Latest unread notification count.

Keep the existing quick links. Content above, navigation below.

### C. Fix the authorization count

Filter by status before counting, and separate active from expiring so the client sees urgency rather than a single number.

### D. Caregiver dashboard

Replace the hardcoded "In-Service" badge at `caregiver/DashboardPage.jsx:112-125` with the real completed count. Plan 006 tracker item J covers the same line; do it once, in whichever plan lands first.

## Database

None. This plan is presentation and layout only.

## Verification

- `npm.cmd run lint`
- `npm.cmd run build`
- Backend `pytest -q` unchanged and still green, since no backend file is touched.
- **Manual, on a physical device, not a browser device emulator:** complete a caregiver application end to end at 375px width, including the signature. Check a mid-form app background and return. Check the client dashboard at 375px and at 768px.
- Confirm the authorization count matches the detail page for a client holding a mix of active, expired, and pending authorizations. Build that fixture in a scratch state rather than assuming it.

## Rollback

Revert the pages and `index.css`. Layout changes are isolated and carry no data risk.

## Deliverable tracker

- [x] A. Breakpoints added at 640px and 900px for the form section
- [x] B. Mobile step navigation in `ApplicationPage.jsx`
- [x] C. Input-mode and autocomplete on date, phone, SSN
- [x] D. 44px touch targets on form actions
- [x] E. Draft survives a backgrounded tab on mobile
- [x] F. Client dashboard renders schedule, care plan, agreements, authorization status
- [x] G. Authorization count filtered to active, expiring shown separately
- [x] H. Caregiver dashboard training count, if not already done by plan 006
- [x] I. Manual checks on a physical phone recorded in the plan
- [x] J. Verify: `lint`, `build`, `pytest -q` unchanged
