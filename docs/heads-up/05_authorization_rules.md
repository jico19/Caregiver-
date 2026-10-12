# Authorization & Security Rules Guide

Comprehensive reference for the Caregiver Platform multi-tenant security architecture, Role-Based Access Control (RBAC), state scoping, and fail-closed security principles.

---

## 1. Security Core Tenet

> **Never trust client-supplied user, role, or state identifiers.**

A caller's permissions and authorized jurisdictions are **always resolved from the authenticated JWT session and verified database user row** — never from query parameters, request headers, or client request bodies.

---

## 2. Role-Based Access Control (RBAC) Matrix

The platform enforces five distinct access tiers:

| Role | Permitted States | Allowed Operations |
|---|---|---|
| **`super_admin`** | All states (`unrestricted`) | Global administrative authority. Manages user roles, reassigns administrators across jurisdictions, restores archived entities, and reviews cross-state operational reports (FL, IN, GA). |
| **`administrator`** | Assigned state only (`state_id`) | Manages patients, caregivers, referrals, care plans, schedules, and documents **strictly within their assigned state**. |
| **`caregiver`** | Own profile & assigned clients | Submits applications, uploads credentials, views assigned client care plans and schedules, and completes training certifications. |
| **`client`** | Own profile & care data | Completes intake packets, signs e-agreements, reviews personal care plans and schedules, and uploads insurance authorization records. |
| **`public`** | Unauthenticated | Browses state landing pages, career listings, service offerings, and submits public applications or inquiries. |

---

## 3. State Scoping & Multi-Tenancy Architecture

Multi-tenancy treats **State as an Authorization Boundary**. Implementation resides in `backend/app/core/dependencies.py`.

```
┌────────────────────────────────────────────────────────┐
│               Incoming Request + JWT                   │
└──────────────────────────┬─────────────────────────────┘
                           │
                 [get_current_user]
                           │ (Resolves sub, role, state_id)
                           ▼
              [require_admin_scoped]
                           │
      ┌────────────────────┴────────────────────┐
      │                                         │
[super_admin]                             [administrator]
states = None                             states = [state_id]
(Unrestricted Global Access)                     │
                                         state_id IS NULL?
                                         ├── YES ➔ 403 FORBIDDEN (Fail-Closed)
                                         └── NO  ➔ Bound to AdminScope(states=[id])
```

### Core Functions & Security Mechanics

#### 1. `resolve_permitted_states(role, state_id)`
- If role is `super_admin`: Returns `None` (unrestricted access).
- If role is `administrator` with a valid `state_id`: Returns `[state_id]`.
- If role is `administrator` but `state_id` is `None`: Returns `[]` (empty list = zero access).

#### 2. `AdminScope` Dataclass
Encapsulates caller identity and state boundary:
- `scope.is_super`: `True` if caller is a super admin.
- `scope.allows(state_id)`: Returns `True` if the record's state is within permitted scope.
- **Fail-Closed on Unassigned Records**: If an existing record has `state_id IS NULL`, it is denied to a scoped admin because an unassigned record could belong to any jurisdiction.

#### 3. `require_admin_scoped`
FastAPI dependency enforced on all admin endpoints:
- **Fail-Closed Rule**: An administrator without an assigned state (`users.state_id IS NULL`) is denied immediately rather than granted global access:
  ```json
  HTTP 403 Forbidden: "Administrator is not assigned to a state"
  ```

#### 4. `scope_query(query, scope, column="state_id")`
Applies an automated database-level constraint before pagination:
```python
if scope.states is not None:
    query = query.in_(column, scope.states)
```
- Restricting queries in the database ensures unauthorized rows are never transmitted across the network, and pagination counts (`count="exact"`) remain strictly scoped.

#### 5. `assert_state_allowed(scope, state_id)`
Validates single-record operations (e.g. `GET /clients/{id}`, `POST /caregivers/{id}/review`):
- If a record belongs to Georgia (`state_id=3`) and an administrator assigned to Florida (`state_id=1`) attempts access, the API responds:
  ```json
  HTTP 403 Forbidden: "You are not authorized to access records for this state."
  ```

#### 6. `assert_permitted_filter(scope, requested, column="state_id")`
If an administrator provides a URL filter parameter outside their jurisdiction (e.g., requesting `?state_id=2` when assigned to `1`), the request is rejected with a 403 rather than silently ignored, ensuring unauthorized attempts are visible in security logs.

---

## 4. User Identity & Token Verification

### 1. Supabase JWT Validation
- Verifies Bearer token signature against `SUPABASE_JWT_SECRET` via HS256 algorithm.
- Falls back to remote Supabase Auth validation if direct verification encounters unexpected issues.

### 2. User Lifecycle & In-Memory Cache
- Minimizes round-trip latency using a **30-second TTL in-memory cache** (`_USER_CACHE`).
- **Cache Invalidation Hook**: When an administrator updates a user's role or status (`POST /admin/users/{id}/status`), `invalidate_user_cache(user_id)` is invoked to immediately sever revoked privileges.

### 3. Suspended & Deactivated Account Guard
- If `status == 'suspended'`, the request fails immediately: `403 Forbidden: Account suspended`.
- If user record has been soft-deleted (`deleted_at IS NOT NULL`), access is denied: `403 Forbidden: Account is deactivated or no longer present`.

---

## 5. Defense-in-Depth Database RLS Policies

Although the FastAPI backend executes queries via the service role key, database tables maintain active **Row Level Security (RLS)**:
1. **Caregiver & Client Policies**: Directly restricts client-side access to `auth.uid() = owner_id` or `client_id = auth.uid()` on `SELECT` and `INSERT`.
2. **Revocation of Hard DELETE**: Hard `DELETE` grants are revoked from `authenticated` roles across all soft-deletable tables.
3. **Immutable Tables**: `audit_logs` and `client_agreements` tables are write-once; neither administrators nor clients can edit or delete existing rows.
