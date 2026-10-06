from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime, timezone
import logging
from typing import Optional, List
from pydantic import BaseModel, Field

from app.core.dependencies import (
    AdminScope,
    assert_permitted_filter,
    assert_state_allowed,
    require_admin_scoped,
    require_super_admin,
    scope_query,
    validate_state_id,
    invalidate_user_cache,
)
from app.core.supabase import get_supabase
from app.core.soft_delete import (
    active_only,
    soft_delete_stamp,
)
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)

router = APIRouter()


class UserStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(active|suspended|inactive)$")


class UserRoleUpdateRequest(BaseModel):
    role: Optional[str] = Field(None, pattern="^(caregiver|client|administrator|super_admin)$")
    role_id: Optional[int] = None


class UserStateUpdateRequest(BaseModel):
    state_id: Optional[int] = None


from app.services.audit import record_audit_log


@router.get("")
def list_users(
    role: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    state_id_filter: Optional[int] = Query(None, alias="state_id"),
    params: PaginationParams = Depends(),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    query = active_only(
        supabase.table("users").select("*, roles(name), states(code, name, slug)", count="exact"),
        "users",
    )
    query = scope_query(query, scope)

    if status_filter:
        query = query.eq("status", status_filter)

    if state_id_filter is not None:
        s_id = assert_permitted_filter(scope, state_id_filter)
        query = query.eq("state_id", s_id)

    if role:
        query = query.eq("roles.name", role)

    result = paginate(query.order("created_at", desc=True), params)
    users_list = result.pop("items") or []

    return {"users": users_list, **result}


@router.get("/{user_id}")
def get_user(
    user_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    user_res = (
        active_only(
            supabase.table("users").select("*, roles(name), states(code, name, slug)"),
            "users",
        )
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not user_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user_data = user_res.data
    if user_data.get("state_id"):
        assert_state_allowed(scope, user_data.get("state_id"))

    role_name = (
        user_data.get("roles", {}).get("name")
        if isinstance(user_data.get("roles"), dict)
        else user_data.get("role")
    )

    profile = None
    if role_name == "caregiver":
        cg_res = (
            active_only(supabase.table("caregivers").select("*"), "caregivers")
            .eq("id", user_id)
            .execute()
        )
        if cg_res.data:
            profile = cg_res.data[0]
    elif role_name == "client":
        cl_res = (
            active_only(supabase.table("clients").select("*"), "clients")
            .eq("id", user_id)
            .execute()
        )
        if cl_res.data:
            profile = cl_res.data[0]

    return {**user_data, "profile": profile}


@router.post("/{user_id}/status")
def update_user_status(
    user_id: str,
    payload: UserStatusUpdateRequest,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    user_res = (
        active_only(supabase.table("users").select("*"), "users")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not user_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user_data = user_res.data
    if user_data.get("state_id"):
        assert_state_allowed(scope, user_data.get("state_id"))

    old_status = user_data.get("status")
    now_iso = datetime.now(timezone.utc).isoformat()

    supabase.table("users").update({"status": payload.status, "updated_at": now_iso}).eq("id", user_id).execute()
    invalidate_user_cache(user_id)

    record_audit_log(
        supabase,
        user_id=scope.user_id,
        action=f"user.status.{payload.status}",
        table_name="users",
        record_id=user_id,
        old_values={"status": old_status},
        new_values={"status": payload.status},
    )

    return {"message": "Status updated successfully", "id": user_id, "status": payload.status}


@router.post("/{user_id}/role")
def update_user_role(
    user_id: str,
    payload: UserRoleUpdateRequest,
    user: dict = Depends(require_super_admin),
):
    caller_id = user["sub"]
    supabase = get_supabase()

    user_res = (
        active_only(supabase.table("users").select("*"), "users")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not user_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    target_role_id = payload.role_id
    if target_role_id is None and payload.role:
        role_map = {"caregiver": 2, "client": 3, "administrator": 4, "super_admin": 5}
        target_role_id = role_map.get(payload.role)
        try:
            r = supabase.table("roles").select("id").eq("name", payload.role).single().execute()
            if r.data:
                target_role_id = r.data.get("id", target_role_id)
        except Exception:
            pass

    if target_role_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role specified.")

    old_role_id = user_res.data.get("role_id")
    now_iso = datetime.now(timezone.utc).isoformat()

    supabase.table("users").update({"role_id": target_role_id, "updated_at": now_iso}).eq("id", user_id).execute()
    invalidate_user_cache(user_id)

    record_audit_log(
        supabase,
        user_id=caller_id,
        action="user.role_change",
        table_name="users",
        record_id=user_id,
        old_values={"role_id": old_role_id},
        new_values={"role_id": target_role_id},
    )

    return {"message": "Role updated successfully", "id": user_id, "role_id": target_role_id}


@router.post("/{user_id}/state")
def update_user_state(
    user_id: str,
    payload: UserStateUpdateRequest,
    user: dict = Depends(require_super_admin),
):
    caller_id = user["sub"]
    supabase = get_supabase()

    user_res = (
        active_only(supabase.table("users").select("*"), "users")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not user_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if payload.state_id is not None:
        validate_state_id(supabase, payload.state_id)

    old_state_id = user_res.data.get("state_id")
    now_iso = datetime.now(timezone.utc).isoformat()

    supabase.table("users").update({"state_id": payload.state_id, "updated_at": now_iso}).eq("id", user_id).execute()
    invalidate_user_cache(user_id)

    record_audit_log(
        supabase,
        user_id=caller_id,
        action="user.state_change",
        table_name="users",
        record_id=user_id,
        old_values={"state_id": old_state_id},
        new_values={"state_id": payload.state_id},
    )

    return {"message": "State updated successfully", "id": user_id, "state_id": payload.state_id}


@router.delete("/{user_id}")
def offboard_user(
    user_id: str,
    user: dict = Depends(require_super_admin),
):
    """Soft-delete offboard a user.

    Do NOT call auth.admin.delete_user(). The auth account stays as an inert
    shell with no profile behind it. It cannot authenticate into anything
    because users.status='inactive' and users.deleted_at is set, revoking
    application access while preserving full clinical audit history.
    """
    caller_id = user["sub"]
    if user_id == caller_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot offboard yourself.",
        )

    supabase = get_supabase()

    existing = supabase.table("users").select("*").eq("id", user_id).single().execute()

    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if existing.data.get("deleted_at") is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already offboarded.")

    stamp = soft_delete_stamp(caller_id)

    # 1. Update user record to status='inactive' and stamp deleted_at/deleted_by
    supabase.table("users").update({"status": "inactive", **stamp}).eq("id", user_id).execute()
    invalidate_user_cache(user_id)

    # 2. Soft-delete profile rows and document rows (caregivers/clients keyed by id = user_id; documents by owner_id)
    supabase.table("caregivers").update(stamp).eq("id", user_id).execute()
    supabase.table("clients").update(stamp).eq("id", user_id).execute()
    supabase.table("documents").update(stamp).eq("owner_id", user_id).execute()

    # 3. Soft-delete dependent clinical rows for caregiver & client
    supabase.table("caregiver_applications").update(stamp).eq("caregiver_id", user_id).execute()
    supabase.table("training_enrollments").update(stamp).eq("caregiver_id", user_id).execute()

    cl_ids = [user_id]

    plans_res = supabase.table("care_plans").select("id").in_("client_id", cl_ids).execute()
    if plans_res.data:
        plan_ids = [p["id"] for p in plans_res.data]
        supabase.table("care_plan_activities").update(stamp).in_("care_plan_id", plan_ids).execute()

    supabase.table("care_plans").update(stamp).in_("client_id", cl_ids).execute()
    supabase.table("care_schedules").update(stamp).in_("client_id", cl_ids).execute()
    supabase.table("authorizations").update(stamp).in_("client_id", cl_ids).execute()
    supabase.table("client_referrals").update(stamp).in_("converted_client_id", cl_ids).execute()

    # 4. Write audit log entry
    record_audit_log(
        supabase,
        user_id=caller_id,
        action="user.offboard",
        table_name="users",
        record_id=user_id,
        old_values={"status": existing.data.get("status")},
        new_values={"status": "inactive", "deleted_at": stamp["deleted_at"]},
    )

    return {"message": "User successfully offboarded", "id": user_id}
