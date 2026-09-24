from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

bear = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bear),
) -> dict:
    """Validate Supabase JWT and return the payload."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    from app.core.supabase import get_supabase
    supabase = get_supabase()

    try:
        user = supabase.auth.get_user(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    if not user or not user.user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Fetch role from our users table with reconnect fallback
    try:
        row = supabase.table("users").select("role_id, state_id, status, roles(name)").eq("id", str(user.user.id)).single().execute()
    except Exception:
        from app.core.supabase import reset_supabase
        reset_supabase()
        supabase = get_supabase()
        row = supabase.table("users").select("role_id, state_id, status, roles(name)").eq("id", str(user.user.id)).single().execute()

    role = "public"
    state_id = None
    if row.data:
        role = row.data.get("roles", {}).get("name", "public")
        state_id = row.data.get("state_id")
        if row.data.get("status") == "suspended":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")

    return {
        "sub": str(user.user.id),
        "email": user.user.email,
        "role": role,
        "state_id": state_id,
    }


def require_role(*roles: str):
    def _check(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return _check


def require_admin(user: dict = Depends(require_role("administrator"))):
    return user


def require_caregiver(user: dict = Depends(require_role("caregiver", "administrator"))):
    return user


def require_client(user: dict = Depends(require_role("client", "administrator"))):
    return user


def validate_state(state: str) -> str:
    if state not in settings.VALID_STATES:
        raise HTTPException(status_code=404, detail=f"State '{state}' not found")
    return state
