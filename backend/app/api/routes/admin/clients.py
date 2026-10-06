from datetime import datetime, timezone, date
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
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
from app.models.enums import ALLOWED_CLIENT_TRANSITIONS
from app.services.audit import record_audit_log
from app.utils.notifications import notify
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)

router = APIRouter()


class ClientAdmissionRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|active|discharged|rejected)$")
    service_start_date: Optional[str] = None
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None


def get_client_or_404(supabase, client_id: str, scope: AdminScope):
    """Retrieve client ensuring state scoping is checked; raises 404/403 appropriately."""
    res = (
        active_only(
            supabase.table("clients").select("id, state_id, first_name, last_name"),
            "clients",
        )
        .eq("id", client_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")
    assert_state_allowed(scope, res.data.get("state_id"))
    return res.data


@router.get("/clients")
def list_admin_clients(
    status_filter: Optional[str] = Query(None, alias="status"),
    sort_by: Optional[str] = Query(None, alias="sort_by"),
    params: PaginationParams = Depends(),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    query = scope_query(
        active_only(
            supabase.table("clients").select(
                "id, state_id, first_name, last_name, date_of_birth, phone, address, medicaid_number, status, service_start_date, admission_notes, rejection_reason, admitted_by, admitted_at, created_at, updated_at, legal_hold, states(code, name, slug), users:users!clients_id_fkey(email, status, deleted_at)",
                count="exact",
            ),
            "clients",
        ),
        scope,
    )
    if status_filter:
        query = query.eq("status", status_filter)

    if sort_by == "service_start_date":
        query = query.order("service_start_date", desc=False)
    else:
        query = query.order("created_at", desc=True)

    result = paginate(query, params)
    trim_embedded(result["items"], "users")
    return {"clients": result.pop("items"), **result}


@router.post("/clients/{client_id}/admission")
def update_client_admission(
    client_id: str,
    payload: ClientAdmissionRequest,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    existing = (
        active_only(
            supabase.table("clients").select("id, state_id, first_name, last_name, status, service_start_date, admission_notes, rejection_reason, legal_hold"),
            "clients",
        )
        .eq("id", client_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")

    old_client = existing.data
    assert_state_allowed(scope, old_client.get("state_id"))

    old_status = old_client.get("status", "pending")
    allowed_next = ALLOWED_CLIENT_TRANSITIONS.get(old_status, set())
    if payload.status not in allowed_next:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot transition client status from '{old_status}' to '{payload.status}'.",
        )

    reason = (payload.rejection_reason or payload.notes or "").strip()
    if payload.status == "rejected" and not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A rejection reason is required when rejecting a client admission.",
        )

    if payload.service_start_date:
        try:
            date.fromisoformat(payload.service_start_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid service_start_date format. Expected YYYY-MM-DD.",
            )

    now_iso = datetime.now(timezone.utc).isoformat()
    update_payload = {
        "status": payload.status,
    }
    if payload.status in ("approved", "active"):
        update_payload["admitted_by"] = admin_id
        update_payload["admitted_at"] = now_iso

    if payload.service_start_date is not None:
        update_payload["service_start_date"] = payload.service_start_date

    if payload.notes is not None:
        update_payload["admission_notes"] = payload.notes.strip() if payload.notes else None

    if payload.status == "rejected":
        update_payload["rejection_reason"] = reason

    res = scope_query(
        active_only(
            supabase.table("clients").update(update_payload),
            "clients",
        )
        .eq("id", client_id),
        scope,
    ).execute()

    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update client admission status.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action=f"client_admission_{payload.status}",
        table_name="clients",
        record_id=client_id,
        old_values={"status": old_status, "service_start_date": old_client.get("service_start_date")},
        new_values=update_payload,
    )

    msg_body = f"Your client admission status is now: {payload.status}."
    if payload.status == "rejected" and reason:
        msg_body += f" Reason: {reason}"
    elif update_payload.get("service_start_date"):
        msg_body += f" Confirmed start date: {update_payload['service_start_date']}."

    notify(
        supabase,
        client_id,
        f"client_admission_{payload.status}",
        "Client Admission Update",
        msg_body,
    )

    return {"message": "Client admission status updated successfully", "client": res.data[0]}


@router.get("/clients/{client_id}")
def get_admin_client(
    client_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    res = (
        active_only(
            supabase.table("clients").select(
                "id, state_id, first_name, last_name, date_of_birth, phone, address, medicaid_number, status, service_start_date, admission_notes, rejection_reason, admitted_by, admitted_at, created_at, updated_at, legal_hold, states(code, name, slug), users:users!clients_id_fkey(email, status, deleted_at)"
            ),
            "clients",
        )
        .eq("id", client_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")

    trim_embedded([res.data], "users")
    assert_state_allowed(scope, res.data.get("state_id"))
    return {"client": res.data}
