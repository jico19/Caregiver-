from datetime import datetime, timezone
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.dependencies import (
    AdminScope,
    assert_state_allowed,
    require_admin_scoped,
    scope_query,
)
from app.core.supabase import get_supabase
from app.core.soft_delete import (
    active_only,
    trim_embedded,
)
from app.services.audit import record_audit_log
from app.utils.notifications import notify
from app.utils.pagination import PaginationParams, paginate
from .clients import get_client_or_404

logger = logging.getLogger(__name__)

router = APIRouter()


class AuthorizationCreateRequest(BaseModel):
    client_id: str
    state_id: int
    authorization_number: str = Field(..., min_length=1, max_length=100)
    start_date: str
    end_date: str
    notes: Optional[str] = None
    hcpcs_code: str = Field("T1019", max_length=20)
    service_description: Optional[str] = Field("Personal Care Services", max_length=150)
    total_units_authorized: int = Field(0, ge=0)
    units_used: int = Field(0, ge=0)
    max_weekly_hours: Optional[float] = Field(None, ge=0)
    unit_type: str = Field("15_min", pattern="^(15_min|hourly|visit)$")


class AuthorizationReviewRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    notes: Optional[str] = None
    hcpcs_code: Optional[str] = Field(None, max_length=20)
    service_description: Optional[str] = Field(None, max_length=150)
    total_units_authorized: Optional[int] = Field(None, ge=0)
    units_used: Optional[int] = Field(None, ge=0)
    max_weekly_hours: Optional[float] = Field(None, ge=0)
    unit_type: Optional[str] = Field(None, pattern="^(15_min|hourly|visit)$")


class AuthorizationUpdateRequest(BaseModel):
    authorization_number: Optional[str] = Field(None, min_length=1, max_length=100)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(pending|active|expiring_soon|expired|rejected)$")
    hcpcs_code: Optional[str] = Field(None, max_length=20)
    service_description: Optional[str] = Field(None, max_length=150)
    total_units_authorized: Optional[int] = Field(None, ge=0)
    units_used: Optional[int] = Field(None, ge=0)
    max_weekly_hours: Optional[float] = Field(None, ge=0)
    unit_type: Optional[str] = Field(None, pattern="^(15_min|hourly|visit)$")


from app.services.authorizations import compute_auth_units


@router.get("/authorizations")
def list_admin_authorizations(
    params: PaginationParams = Depends(),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    result = paginate(
        scope_query(
            active_only(
                supabase.table("authorizations").select(
                    "id, client_id, state_id, document_id, authorization_number, start_date, end_date, status, notes, reviewed_at, reviewed_by, created_at, updated_at, hcpcs_code, service_description, total_units_authorized, units_used, max_weekly_hours, unit_type, clients:clients!authorizations_client_id_fkey(first_name, last_name, medicaid_number, deleted_at), states(code, name)",
                    count="exact",
                ),
                "authorizations",
            ),
            scope,
        ).order("created_at", desc=True),
        params,
    )
    trim_embedded(result["items"], "clients")
    items = [compute_auth_units(item) for item in result.pop("items")]
    return {"authorizations": items, **result}


@router.post("/authorizations")
def create_authorization(
    payload: AuthorizationCreateRequest,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    client = get_client_or_404(supabase, payload.client_id, scope)
    client_state = client["state_id"]
    if payload.state_id != client_state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"state_id {payload.state_id} does not match the client's state ({client_state}).",
        )

    auth_data = {
        "client_id": payload.client_id,
        "state_id": client_state,
        "authorization_number": payload.authorization_number.strip(),
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "status": "active",
        "notes": payload.notes,
        "hcpcs_code": payload.hcpcs_code.strip() if payload.hcpcs_code else "T1019",
        "service_description": (payload.service_description or "Personal Care Services").strip(),
        "total_units_authorized": payload.total_units_authorized,
        "units_used": payload.units_used,
        "max_weekly_hours": payload.max_weekly_hours,
        "unit_type": payload.unit_type or "15_min",
    }

    res = supabase.table("authorizations").insert(auth_data).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create authorization.",
        )

    new_auth = res.data[0]

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="authorization_created",
        table_name="authorizations",
        record_id=new_auth["id"],
        new_values=auth_data,
        entity_state_id=client_state,
    )

    notify(
        supabase,
        payload.client_id,
        "authorization_approved",
        "Medicaid Authorization Approved",
        f"Authorization #{payload.authorization_number} has been approved from {payload.start_date} to {payload.end_date}.",
    )

    return {"message": "Authorization created successfully", "authorization": compute_auth_units(new_auth)}


@router.post("/authorizations/{authorization_id}/review")
def review_authorization(
    authorization_id: str,
    payload: AuthorizationReviewRequest,
    scope: AdminScope = Depends(require_admin_scoped),
):
    """Admin review of a client-submitted (pending) authorization."""
    supabase = get_supabase()
    admin_id = scope.user_id

    existing = (
        active_only(
            supabase.table("authorizations").select(
                "id, client_id, state_id, document_id, authorization_number, status, notes, hcpcs_code, service_description, total_units_authorized, units_used, max_weekly_hours, unit_type"
            ),
            "authorizations",
        )
        .eq("id", authorization_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Authorization not found.")

    auth = existing.data
    assert_state_allowed(scope, auth.get("state_id"))
    if auth.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot review an authorization with status '{auth.get('status')}'.",
        )

    new_status = "active" if payload.status == "approved" else "rejected"
    now_iso = datetime.now(timezone.utc).isoformat()

    update_payload = {
        "status": new_status,
        "reviewed_at": now_iso,
        "reviewed_by": admin_id,
    }
    if payload.notes is not None:
        update_payload["notes"] = payload.notes
    if payload.hcpcs_code is not None:
        update_payload["hcpcs_code"] = payload.hcpcs_code.strip()
    if payload.service_description is not None:
        update_payload["service_description"] = payload.service_description.strip()
    if payload.total_units_authorized is not None:
        update_payload["total_units_authorized"] = payload.total_units_authorized
    if payload.units_used is not None:
        update_payload["units_used"] = payload.units_used
    if payload.max_weekly_hours is not None:
        update_payload["max_weekly_hours"] = payload.max_weekly_hours
    if payload.unit_type is not None:
        update_payload["unit_type"] = payload.unit_type

    old_values = {k: auth.get(k) for k in update_payload if k in auth}
    res = scope_query(
        active_only(
            supabase.table("authorizations").update(update_payload),
            "authorizations",
        )
        .eq("id", authorization_id),
        scope,
    ).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update authorization.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action=f"authorization_{new_status}",
        table_name="authorizations",
        record_id=authorization_id,
        old_values=old_values,
        new_values=update_payload,
        entity_state_id=auth.get("state_id"),
    )

    if auth.get("document_id"):
        doc_status = "approved" if new_status == "active" else "rejected"
        scope_query(
            active_only(
                supabase.table("documents").update({
                    "status": doc_status,
                    "reviewed_at": now_iso,
                    "reviewed_by": admin_id,
                }),
                "documents",
            ).eq("id", auth["document_id"]),
            scope,
        ).execute()

    if new_status == "active":
        notify(
            supabase,
            auth["client_id"],
            "authorization_approved",
            "Authorization Approved",
            f"Authorization #{auth.get('authorization_number')} has been approved for your services.",
        )
    else:
        reason = payload.notes or "Please contact your care coordinator."
        notify(
            supabase,
            auth["client_id"],
            "authorization_rejected",
            "Authorization Update",
            f"Your authorization was not approved. Reason: {reason}",
        )

    return {"message": "Authorization reviewed successfully", "authorization": compute_auth_units(res.data[0])}


@router.patch("/authorizations/{authorization_id}")
def update_authorization(
    authorization_id: str,
    payload: AuthorizationUpdateRequest,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    existing = (
        active_only(
            supabase.table("authorizations").select(
                "id, client_id, state_id, authorization_number, start_date, end_date, status, notes, hcpcs_code, service_description, total_units_authorized, units_used, max_weekly_hours, unit_type"
            ),
            "authorizations",
        )
        .eq("id", authorization_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Authorization not found.")

    auth = existing.data
    assert_state_allowed(scope, auth.get("state_id"))

    update_payload = {}
    if payload.authorization_number is not None:
        update_payload["authorization_number"] = payload.authorization_number.strip()
    if payload.start_date is not None:
        update_payload["start_date"] = payload.start_date
    if payload.end_date is not None:
        update_payload["end_date"] = payload.end_date
    if payload.notes is not None:
        update_payload["notes"] = payload.notes
    if payload.status is not None:
        update_payload["status"] = payload.status
    if payload.hcpcs_code is not None:
        update_payload["hcpcs_code"] = payload.hcpcs_code.strip()
    if payload.service_description is not None:
        update_payload["service_description"] = payload.service_description.strip()
    if payload.total_units_authorized is not None:
        update_payload["total_units_authorized"] = payload.total_units_authorized
    if payload.units_used is not None:
        update_payload["units_used"] = payload.units_used
    if payload.max_weekly_hours is not None:
        update_payload["max_weekly_hours"] = payload.max_weekly_hours
    if payload.unit_type is not None:
        update_payload["unit_type"] = payload.unit_type

    if not update_payload:
        return {"message": "No changes requested", "authorization": compute_auth_units(auth)}

    old_values = {k: auth.get(k) for k in update_payload}
    res = scope_query(
        active_only(
            supabase.table("authorizations").update(update_payload),
            "authorizations",
        )
        .eq("id", authorization_id),
        scope,
    ).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update authorization.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="authorization_updated",
        table_name="authorizations",
        record_id=authorization_id,
        old_values=old_values,
        new_values=update_payload,
        entity_state_id=auth.get("state_id"),
    )

    return {"message": "Authorization updated successfully", "authorization": compute_auth_units(res.data[0])}
