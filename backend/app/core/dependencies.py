import time
import jwt
import logging
from dataclasses import dataclass
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.core.soft_delete import active_only

logger = logging.getLogger(__name__)
bear = HTTPBearer(auto_error=False)

# A super_admin may access every state. An administrator is scoped to the
# single state on their users row. users.state_id IS NULL means "all states"
# and is only honoured for the super_admin role.
SUPER_ADMIN_ROLE = "super_admin"
ADMIN_ROLES = ("administrator", SUPER_ADMIN_ROLE)

_USER_CACHE: dict[str, dict] = {}
_USER_CACHE_TTL = 30.0


def invalidate_user_cache(user_id: str | None = None):
    """Invalidate cached user row for user_id or clear entire cache."""
    global _USER_CACHE
    if user_id:
        _USER_CACHE.pop(str(user_id), None)
    else:
        _USER_CACHE.clear()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bear),
) -> dict:
    """Validate Supabase JWT and return the payload."""
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token = credentials.credentials
    user_id = None
    email = None

    try:
        if settings.SUPABASE_JWT_SECRET and settings.SUPABASE_JWT_SECRET != "placeholder-secret-change-in-production":
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        else:
            payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        email = payload.get("email")
    except Exception:
        from app.core.supabase import get_supabase
        try:
            user = get_supabase().auth.get_user(token)
            if user and user.user:
                user_id = str(user.user.id)
                email = user.user.email
        except Exception:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    now = time.time()
    cached = _USER_CACHE.get(str(user_id))
    if cached and (now - cached["ts"]) < _USER_CACHE_TTL:
        user_row = cached["data"]
    else:
        from app.core.supabase import get_supabase
        supabase = get_supabase()

        def _load_user_row(sb):
            return (
                active_only(
                    sb.table("users").select("role_id, state_id, status, roles(name)"),
                    "users",
                )
                .eq("id", str(user_id))
                .single()
                .execute()
            )

        try:
            res = _load_user_row(supabase)
            user_row = res.data
        except Exception:
            from app.core.supabase import reset_supabase
            reset_supabase()
            supabase = get_supabase()
            try:
                res = _load_user_row(supabase)
                user_row = res.data
            except Exception:
                user_row = None

        if user_row:
            _USER_CACHE[str(user_id)] = {"data": user_row, "ts": now}

    if not user_row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated or no longer present",
        )

    if user_row.get("status") == "suspended":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")

    role = "public"
    if isinstance(user_row.get("roles"), dict):
        role = user_row.get("roles", {}).get("name", "public")
    state_id = user_row.get("state_id")

    return {
        "sub": str(user_id),
        "email": email or "",
        "role": role,
        "state_id": state_id,
    }


def require_role(*roles: str):
    def _check(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return _check


def require_admin(user: dict = Depends(require_role(*ADMIN_ROLES))):
    return user


def require_caregiver(user: dict = Depends(require_role("caregiver", "administrator", SUPER_ADMIN_ROLE))):
    return user


def require_client(user: dict = Depends(require_role("client", "administrator", SUPER_ADMIN_ROLE))):
    return user


def require_super_admin(user: dict = Depends(require_role(SUPER_ADMIN_ROLE))):
    return user


# ============================================================
# STATE AUTHORIZATION
#
# The single source of truth for "which states may this caller access?".
# Permitted states are always derived from the authenticated principal --
# never from a query parameter, body field, or other request input.
# ============================================================


def resolve_permitted_states(role: str, state_id: int | None) -> list[int] | None:
    """Return the states a caller may access.

    Returns ``None`` for an unrestricted caller (super_admin) and a list of
    permitted state ids otherwise. An empty list means "no state access".
    """
    if role == SUPER_ADMIN_ROLE:
        return None
    if state_id is None:
        return []
    return [state_id]


@dataclass(frozen=True)
class AdminScope:
    """An admin caller bound to its permitted states."""

    user: dict
    states: list[int] | None  # None == unrestricted (super_admin)

    @property
    def is_super(self) -> bool:
        return self.states is None

    @property
    def user_id(self) -> str:
        return self.user["sub"]

    def allows(self, state_id) -> bool:
        """True when this scope may access a record in ``state_id``.

        A record with no state is denied to a scoped admin (fail-closed):
        an unassigned record could belong to any state.
        """
        if self.states is None:
            return True
        return state_id in self.states


def require_admin_scoped(user: dict = Depends(require_admin)) -> AdminScope:
    """Dependency for every route that reads or writes state-scoped data."""
    states = resolve_permitted_states(user.get("role"), user.get("state_id"))
    if states is not None and not states:
        # An administrator with no state assigned is misconfigured, not
        # privileged. Deny rather than fall back to all-states access.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator is not assigned to a state",
        )
    return AdminScope(user=user, states=states)


def admin_scope_for(user: dict) -> AdminScope | None:
    """Build a scope for a user dict, or None if the user is not an admin.

    For endpoints that accept any authenticated user but must widen access
    for admins (e.g. document downloads).
    """
    if user.get("role") not in ADMIN_ROLES:
        return None
    return AdminScope(
        user=user,
        states=resolve_permitted_states(user.get("role"), user.get("state_id")),
    )


def scope_query(query, scope: AdminScope, column: str = "state_id"):
    """Constrain a query to the caller's permitted states.

    Applies the filter in the database so unauthorized rows are never
    returned. A caller-supplied filter must still be intersected with this
    by the caller -- this only ever narrows.
    """
    if scope.states is None:
        return query
    return query.in_(column, scope.states)


def assert_state_allowed(
    scope: AdminScope,
    state_id,
    detail: str = "You are not authorized to access records for this state.",
):
    """Raise 403 when a record's state is outside the caller's scope."""
    if not scope.allows(state_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def assert_permitted_filter(scope: AdminScope, requested, column: str = "state_id"):
    """Validate a caller-supplied state filter without ever widening access.

    A filter the caller may not use is rejected outright rather than
    silently ignored, so a request for another state is visible as a
    denial instead of quietly returning the caller's own data.
    """
    if requested is None:
        return None
    if scope.states is not None and requested not in scope.states:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You are not authorized to filter on {column}={requested}.",
        )
    return requested


def validate_state(state: str) -> str:
    if state not in settings.VALID_STATES:
        raise HTTPException(status_code=404, detail=f"State '{state}' not found")
    return state


def validate_state_id(supabase, state_id: int) -> int:
    """Ensure a client-supplied state_id exists in the states table."""
    if state_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="state_id is required")
    res = supabase.table("states").select("id").eq("id", state_id).single().execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid state_id '{state_id}'",
        )
    return state_id
