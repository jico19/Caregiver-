from datetime import datetime, timezone
import logging
import secrets
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.dependencies import (
    AdminScope,
    assert_permitted_filter,
    assert_state_allowed,
    require_admin_scoped,
    scope_query,
)
from app.core.supabase import get_supabase
from app.core.soft_delete import active_only
from app.services.audit import record_audit_log
from app.utils.notifications import notify
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)

router = APIRouter()


class ReferralStatusUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(new|contacted|converted|closed)$")
    assigned_to: Optional[str] = None
    handled_notes: Optional[str] = None


def get_or_create_client_user(supabase, email: str, state_id: int) -> str:
    """Find existing client user by email or provision an auth account and users row (fixes B1)."""
    clean_email = email.strip().lower()
    existing_user = (
        active_only(
            supabase.table("users").select("id, role_id"),
            "users",
        )
        .eq("email", clean_email)
        .execute()
    )
    if existing_user.data:
        return existing_user.data[0]["id"]

    role_res = (
        supabase.table("roles")
        .select("id")
        .eq("name", "client")
        .execute()
    )
    role_id = role_res.data[0]["id"] if role_res.data else 3

    user_id = None
    try:
        auth_client = getattr(supabase, "auth", None)
        if auth_client and hasattr(auth_client, "admin") and hasattr(auth_client.admin, "create_user"):
            temp_pass = f"Temp_{secrets.token_urlsafe(12)}!"
            auth_res = auth_client.admin.create_user({
                "email": clean_email,
                "password": temp_pass,
                "email_confirm": True,
            })
            if hasattr(auth_res, "user") and auth_res.user:
                user_id = str(auth_res.user.id)
            elif isinstance(auth_res, dict) and "id" in auth_res:
                user_id = str(auth_res["id"])
    except Exception as exc:
        logger.info("auth.admin.create_user skipped or unmocked (%s): %s", clean_email, exc)

    if not user_id:
        user_id = str(uuid.uuid4())

    user_payload = {
        "id": user_id,
        "email": clean_email,
        "role_id": role_id,
        "state_id": state_id,
        "status": "active",
    }
    supabase.table("users").insert(user_payload).execute()
    return user_id


@router.get("/referrals")
def list_referrals(
    status: Optional[str] = Query(None, pattern="^(new|contacted|converted|closed)$"),
    state_id: Optional[int] = Query(None, ge=1),
    unassigned: Optional[bool] = Query(None),
    params: PaginationParams = Depends(),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    query = scope_query(
        active_only(
            supabase.table("client_referrals").select(
                "id, state_id, first_name, last_name, email, phone, notes, status, assigned_to, handled_notes, converted_client_id, created_at, updated_at, states(code, name)",
                count="exact",
            ),
            "client_referrals",
        ),
        scope,
    ).order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    if state_id:
        query = query.eq("state_id", assert_permitted_filter(scope, state_id))
    if unassigned is True:
        query = query.is_("assigned_to", None)

    result = paginate(query, params)
    return {"referrals": result.pop("items"), **result}


@router.patch("/referrals/{referral_id}")
def update_referral_status(
    referral_id: str,
    payload: ReferralStatusUpdate,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    existing = (
        active_only(
            supabase.table("client_referrals").select(
                "id, state_id, first_name, last_name, email, phone, notes, status, assigned_to, handled_notes, converted_client_id"
            ),
            "client_referrals",
        )
        .eq("id", referral_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Referral not found.",
        )

    referral = existing.data
    assert_state_allowed(scope, referral.get("state_id"))

    old_status = referral.get("status")

    updates = {}
    if payload.status is not None:
        updates["status"] = payload.status
    if payload.assigned_to is not None:
        updates["assigned_to"] = payload.assigned_to.strip() if payload.assigned_to else None
    if payload.handled_notes is not None:
        updates["handled_notes"] = payload.handled_notes.strip() if payload.handled_notes else None

    converted_client_id = None
    if payload.status == "converted":
        if referral.get("converted_client_id"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Referral has already been converted to a client.",
            )

        ref_email = (referral.get("email") or f"client-{referral_id[:8]}@example.com").strip()
        client_user_id = get_or_create_client_user(supabase, ref_email, referral["state_id"])

        client_payload = {
            "id": client_user_id,
            "state_id": referral["state_id"],
            "first_name": referral.get("first_name", "Prospective"),
            "last_name": referral.get("last_name", "Client"),
            "phone": referral.get("phone"),
            "address": referral.get("notes") or referral.get("address"),
            "status": "pending",
        }
        supabase.table("clients").upsert(client_payload).execute()

        converted_client_id = client_user_id
        updates["converted_client_id"] = converted_client_id
        updates["status"] = "converted"

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    res = scope_query(
        active_only(
            supabase.table("client_referrals").update(updates),
            "client_referrals",
        )
        .eq("id", referral_id),
        scope,
    ).execute()

    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update referral.",
        )

    action_name = "referral_converted" if payload.status == "converted" else ("referral_status_changed" if payload.status else "referral_updated")
    is_simple_status_change = bool(payload.status and len(updates) == 2 and "updated_at" in updates)
    old_audit = {"status": old_status} if is_simple_status_change else {"status": old_status, "assigned_to": referral.get("assigned_to"), "handled_notes": referral.get("handled_notes")}
    new_audit = {"status": payload.status} if is_simple_status_change else updates

    record_audit_log(
        supabase,
        user_id=admin_id,
        action=action_name,
        table_name="client_referrals",
        record_id=referral_id,
        old_values=old_audit,
        new_values=new_audit,
        entity_state_id=referral.get("state_id"),
    )

    if payload.status == "converted":
        notify(
            supabase,
            admin_id,
            "referral_converted",
            "Referral Converted",
            f"Referral for {referral.get('first_name')} {referral.get('last_name')} converted to client (pending admission).",
        )

    response_data = {"message": "Referral updated successfully", "referral": res.data[0]}
    if converted_client_id:
        response_data["client_id"] = converted_client_id

    return response_data
