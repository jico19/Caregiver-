# Codebase Architecture & Technical Guide

System architecture, technology stack, directory structure, and engineering conventions for the Caregiver Platform.

---

## 1. Executive Summary

The **Caregiver Platform** is a multi-state healthcare and caregiver management platform operating in three states: **Florida (FL)**, **Indiana (IN)**, and **Georgia (GA)**.
State is treated as data and an **authorization boundary** — a single monolithic backend and frontend serve all jurisdictions without regional forks or isolated deployments.

### Technology Stack
- **Frontend**: React 19, Vite, Tailwind CSS, daisyUI, React Router v6, TanStack Query (`@tanstack/react-query`), Lucide React.
- **Backend**: Python 3.12, FastAPI, Pydantic v2, PyJWT, HTTPX, ReportLab (PDF certificate generation).
- **Database & Auth**: Supabase Postgres (PostgreSQL 15+), Supabase Auth (GoTrue), Supabase Storage (`documents` S3 bucket), Row Level Security (RLS).
- **Testing & Tooling**: Pytest (in-memory mock via `FakeSupabase`), Python `compileall`, ESLint.

---

## 2. Repository Structure

```
Caregiver/
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── admin/    # Admin portal endpoints (18 modules)
│   │   │   │   ├── caregivers/# Caregiver portal & application endpoints
│   │   │   │   ├── clients/  # Client portal & intake endpoints
│   │   │   │   ├── auth.py   # JWT & user authentication
│   │   │   │   ├── documents.py # Document upload/download
│   │   │   │   ├── states.py # Public state CMS/services
│   │   │   │   └── training.py # Public/general training courses
│   │   │   └── deps.py       # Route dependencies
│   │   ├── core/             # Config, security, logging, soft delete, supabase client
│   │   │   ├── config.py     # Pydantic Settings
│   │   │   ├── dependencies.py # Role & State Scoping Auth dependencies
│   │   │   ├── logging_config.py # Structured logger
│   │   │   ├── security.py   # Password & hash helpers
│   │   │   ├── soft_delete.py# active_only() query filtering
│   │   │   └── supabase.py   # Supabase client singleton
│   │   ├── jobs/             # Periodic background tasks (24h loop)
│   │   │   ├── authorization_reminders.py # Expiring authorizations
│   │   │   ├── credential_reminders.py    # Expiring caregiver licenses
│   │   │   ├── retention_purge.py         # Legal hold aware soft-delete purge
│   │   │   └── training_reminders.py      # Overdue training notifications
│   │   ├── middleware/       # HTTP request logging & request ID
│   │   ├── models/           # Shared domain models & Enums
│   │   ├── schemas/          # Pydantic request & response schemas
│   │   ├── services/         # Business logic (Audit, Caregiver, Client, Document, etc.)
│   │   ├── utils/            # Pagination & notification formatting
│   │   └── main.py           # FastAPI app entry point & lifespan
│   └── tests/                # Automated pytest suite (Admin, Auth, Caregivers, Clients, etc.)
├── frontend/                 # React 19 Single Page App (SPA)
│   ├── src/
│   │   ├── features/
│   │   │   ├── admin/        # Admin portal dashboards, caregivers, clients, reports
│   │   │   ├── auth/         # Login pages (caregiver, client, admin)
│   │   │   ├── caregiver/    # Caregiver portal, onboarding, documents, clients
│   │   │   ├── client/       # Client portal, intake, care plan, authorizations
│   │   │   └── public/       # Public landing pages per state (FL, GA, IN)
│   │   ├── shared/
│   │   │   ├── components/   # Common UI (Navbar, Sidebar, Modals, Buttons)
│   │   │   ├── contexts/     # AuthContext, StateContext
│   │   │   ├── hooks/        # useFetch, usePaginatedFetch, useAuth
│   │   │   ├── layouts/      # AdminLayout, CaregiverLayout, ClientLayout, PublicLayout
│   │   │   └── lib/          # api client (Axios-based), supabase browser client, queryClient
│   │   ├── routes/           # AppRoutes.jsx router definitions
│   │   ├── App.jsx           # Root providers
│   │   └── main.jsx          # Vite React mounting
├── supabase/                 # Supabase configuration & SQL migrations
│   ├── migrations/           # 19 SQL migrations (Single source of truth)
│   └── seeds/                # Demo and reference data
└── docs/                     # Technical specifications and deployment guides
    └── heads-up/             # Modular system documentation
```

---

## 3. Frontend Architecture

### Portals & Routing
1. **Public State Pages (`/:state`)**:
   - Routes: `/:state`, `/:state/services`, `/:state/careers`, `/:state/forms`, `/:state/licensing`, `/:state/contact`.
   - Supported parameters: `florida`, `indiana`, `georgia`.
2. **Caregiver Portal (`/caregiver`)**:
   - Authentication: `/caregiver/login`
   - Registration: `/caregiver/application` (Atomic multi-step onboarding registration form)
   - Authenticated: `/caregiver/dashboard`, `/caregiver/clients`, `/caregiver/documents`, `/caregiver/training`, `/caregiver/profile`, `/caregiver/notifications`.
3. **Client Portal (`/client`)**:
   - Authentication: `/client/login`
   - Intake: `/client/intake` (Consent and intake documentation)
   - Authenticated: `/client/dashboard`, `/client/forms`, `/client/documents`, `/client/authorizations`, `/client/care-plan`, `/client/schedule`, `/client/profile`, `/client/notifications`.
4. **Admin Portal (`/admin`)**:
   - Authentication: `/admin/login`
   - Authenticated: `/admin/dashboard`, `/admin/caregivers`, `/admin/clients`, `/admin/documents`, `/admin/training`, `/admin/authorizations`, `/admin/referrals`, `/admin/reports`, `/admin/users`, `/admin/settings`, `/admin/audit-logs`, `/admin/announcements`, `/admin/notifications`.

### Data Fetching Standards
- All reads go through **`useFetch`** or **`usePaginatedFetch`** hooks wrapping TanStack React Query.
- Raw `api.get` inside `useEffect` is prohibited to prevent duplicate network round-trips and uncached state.
- Query keys are unified per entity endpoint to avoid cache collision.

---

## 4. Backend Architecture

### Design Principles
1. **FastAPI & Async Threadpool**: Handlers use synchronous `def`; FastAPI automatically delegates them to its worker threadpool, avoiding event-loop blocks caused by synchronous Supabase client calls.
2. **Stateless JWT Auth**: Supabase JWT validation in `get_current_user` with a 30-second in-memory cache TTL for user roles and assigned state ID.
3. **Defense in Depth**:
   - Backend Python enforces role permissions, owner boundaries, and multi-tenant state isolation.
   - Database Row Level Security (RLS) restricts any direct database access.
4. **Query Performance Standards**:
   - No `select("*")`: Columns are explicitly projected to prevent multi-megabyte payloads from base64 signatures or blobs.
   - Soft-delete filtering: Queries use `active_only()` before pagination.
5. **Periodic Lifespan Background Jobs**:
   - Four daemon loops execute every 24 hours:
     - `scan_due_credentials`: Warns caregivers about expiring licenses or certificates.
     - `scan_due_authorizations`: Alerts staff to Medicaid prior authorizations nearing expiration.
     - `scan_due_training`: Flags overdue required training modules.
     - `run_retention_purge`: Purges soft-deleted records older than 7 years unless protected by `legal_hold = TRUE`.

---

## 5. Development & Verification Commands

### Backend Commands (run in `backend/`)
```powershell
# Run test suite:
.\venv\Scripts\python.exe -m pytest -q

# Run compilation check:
.\venv\Scripts\python.exe -m compileall -q app tests

# Start development server:
.\venv\Scripts\uvicorn app.main:app --reload --port 8000
```

### Frontend Commands (run in `frontend/`)
```powershell
# Run linter:
npm.cmd run lint

# Build production assets:
npm.cmd run build

# Start development server:
npm.cmd run dev
```
