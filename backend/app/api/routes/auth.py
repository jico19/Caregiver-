from fastapi import APIRouter, HTTPException, Depends, Request
from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest
from app.core.supabase import get_supabase_anon, get_supabase
from app.core.dependencies import get_current_user, validate_state_id
from app.core.soft_delete import active_only
from app.api.routes.admin import record_audit_log

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, request: Request):
    supabase = get_supabase_anon()
    admin_client = get_supabase()
    try:
        res = supabase.auth.sign_in_with_password({"email": data.email, "password": data.password})
    except Exception as e:
        record_audit_log(
            admin_client,
            user_id=None,
            action="user_login_failed",
            table_name="users",
            record_id=data.email,
            new_values={"email": data.email},
            request=request,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not res.user:
        record_audit_log(
            admin_client,
            user_id=None,
            action="user_login_failed",
            table_name="users",
            record_id=data.email,
            new_values={"email": data.email},
            request=request,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Fetch the user's role and state from our users table. A soft-deleted
    # account has no row here, so it resolves to the public role and cannot
    # reach any role-gated surface.
    user_row = (
        active_only(
            admin_client.table("users").select("role_id, state_id, roles(name)"),
            "users",
        )
        .eq("id", str(res.user.id))
        .single()
        .execute()
    )

    role = "public"
    state_id = None
    if user_row.data:
        role = user_row.data.get("roles", {}).get("name", "public")
        state_id = user_row.data.get("state_id")

    record_audit_log(
        admin_client,
        user_id=str(res.user.id),
        action="user_login_success",
        table_name="users",
        record_id=str(res.user.id),
        new_values={"role": role, "state_id": state_id},
        request=request,
        entity_state_id=state_id,
    )

    return LoginResponse(
        access_token=res.session.access_token,
        token_type="bearer",
        user_id=str(res.user.id),
        role=role,
        state_id=state_id,
    )


@router.post("/register")
def register(data: RegisterRequest):
    from app.models.enums import UserRole

    # Self-signup is restricted to caregiver/client. Administrator accounts are
    # created only by seed/provisioning scripts, never via the public API.
    allowed_roles = {UserRole.CAREGIVER.value, UserRole.CLIENT.value}
    if data.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Self-registration as '{data.role}' is not permitted. Choose from: {sorted(allowed_roles)}",
        )

    supabase = get_supabase()

    # Create auth user
    try:
        auth_res = supabase.auth.admin.create_user({
            "email": data.email,
            "password": data.password,
            "email_confirm": True,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")

    if not auth_res.user:
        raise HTTPException(status_code=400, detail="Registration failed")

    user_id = str(auth_res.user.id)
    state_id = validate_state_id(supabase, data.state_id or 1)  # Florida default, matches frontend

    # Look up role id
    role_row = supabase.table("roles").select("id").eq("name", data.role).single().execute()
    if not role_row.data:
        raise HTTPException(status_code=400, detail="Role not found")

    # Insert into our users table
    supabase.table("users").insert({
        "id": user_id,
        "email": data.email,
        "role_id": role_row.data["id"],
        "state_id": state_id,
        "status": "active",
    }).execute()

    # Create the role's profile row so the account is fully usable
    profile_data = {
        "id": user_id,
        "state_id": state_id,
        "first_name": (data.first_name or "").strip(),
        "last_name": (data.last_name or "").strip(),
        "phone": data.phone,
    }
    table = "caregivers" if data.role == UserRole.CAREGIVER.value else "clients"
    try:
        supabase.table(table).insert(profile_data).execute()
    except Exception:
        pass  # Profile columns beyond the common set are optional; never block signup on them.

    return {"message": "User registered successfully", "user_id": user_id}


@router.post("/logout")
def logout(request: Request, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    user_id = user.get("sub")
    record_audit_log(
        supabase,
        user_id=user_id,
        action="user_logout",
        table_name="users",
        record_id=str(user_id),
        request=request,
        entity_state_id=user.get("state_id"),
    )
    try:
        supabase.auth.admin.sign_out(user_id)
    except Exception:
        pass
    return {"message": "Logged out"}


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    admin_client = get_supabase()
    user_row = (
        active_only(
            admin_client.table("users").select(
                "*, roles(name), states(name, slug, code)"
            ),
            "users",
        )
        .eq("id", user.get("sub"))
        .single()
        .execute()
    )
    if not user_row.data:
        raise HTTPException(status_code=404, detail="User not found")
    return user_row.data
