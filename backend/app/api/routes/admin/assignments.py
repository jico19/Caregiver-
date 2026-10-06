from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.core.dependencies import (
    AdminScope,
    assert_state_allowed,
    require_admin_scoped,
)
from app.core.supabase import get_supabase
from app.core.soft_delete import active_only
from app.services.audit import record_audit_log
from app.utils.notifications import notify
from .clients import get_client_or_404

router = APIRouter()


class CaregiverAssignmentCreateRequest(BaseModel):
    caregiver_id: str
    role: Optional[str] = Field("primary", pattern="^(primary|backup|relief)$")


@router.get("/clients/{client_id}/assignments")
def list_client_assignments(
    client_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    get_client_or_404(supabase, client_id, scope)

    res = (
        supabase.table("caregiver_client_assignments")
        .select("id, caregiver_id, client_id, role, assigned_by, assigned_at, ended_at, created_at, caregivers(id, first_name, last_name, phone, ssn_last4)")
        .eq("client_id", client_id)
        .is_("ended_at", None)
        .execute()
    )
    return {"assignments": res.data or []}


@router.post("/clients/{client_id}/assignments")
def assign_caregiver_to_client(
    client_id: str,
    payload: CaregiverAssignmentCreateRequest,
    request: Request,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    client = get_client_or_404(supabase, client_id, scope)

    cg_res = (
        active_only(supabase.table("caregivers").select("id, state_id, first_name, last_name"), "caregivers")
        .eq("id", payload.caregiver_id)
        .single()
        .execute()
    )
    if not cg_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found.")

    cg = cg_res.data
    assert_state_allowed(scope, cg.get("state_id"))

    now_iso = datetime.now(timezone.utc).isoformat()
    assign_data = {
        "id": f"{payload.caregiver_id}:{client_id}",
        "caregiver_id": payload.caregiver_id,
        "client_id": client_id,
        "role": payload.role or "primary",
        "assigned_by": admin_id,
        "assigned_at": now_iso,
        "ended_at": None,
    }

    res = supabase.table("caregiver_client_assignments").upsert(assign_data).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign caregiver to client.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="caregiver_client_assigned",
        table_name="caregiver_client_assignments",
        record_id=f"{payload.caregiver_id}:{client_id}",
        new_values=assign_data,
        request=request,
        entity_state_id=client.get("state_id"),
    )

    notify(
        supabase,
        payload.caregiver_id,
        "client_assigned",
        "New Client Assignment",
        f"You have been assigned as {payload.role or 'primary'} caregiver for client {client.get('first_name', '')} {client.get('last_name', '')}.",
    )

    return {"message": "Caregiver assigned successfully", "assignment": res.data[0]}


@router.delete("/clients/{client_id}/assignments/{caregiver_id}")
def end_caregiver_assignment(
    client_id: str,
    caregiver_id: str,
    request: Request,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    client = get_client_or_404(supabase, client_id, scope)
    now_iso = datetime.now(timezone.utc).isoformat()

    res = (
        supabase.table("caregiver_client_assignments")
        .update({"ended_at": now_iso})
        .eq("client_id", client_id)
        .eq("caregiver_id", caregiver_id)
        .is_("ended_at", None)
        .execute()
    )

    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active caregiver assignment not found.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="caregiver_client_assignment_ended",
        table_name="caregiver_client_assignments",
        record_id=f"{caregiver_id}:{client_id}",
        new_values={"ended_at": now_iso},
        request=request,
        entity_state_id=client.get("state_id"),
    )

    return {"message": "Caregiver assignment ended successfully"}


@router.get("/caregivers/{caregiver_id}/assignments")
def list_caregiver_assigned_clients(
    caregiver_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    cg_res = (
        active_only(supabase.table("caregivers").select("id, state_id"), "caregivers")
        .eq("id", caregiver_id)
        .single()
        .execute()
    )
    if not cg_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found.")

    assert_state_allowed(scope, cg_res.data.get("state_id"))

    res = (
        supabase.table("caregiver_client_assignments")
        .select("id, caregiver_id, client_id, role, assigned_by, assigned_at, ended_at, created_at, clients(id, first_name, last_name, phone, address, status, states(code, name))")
        .eq("caregiver_id", caregiver_id)
        .is_("ended_at", None)
        .execute()
    )
    return {"assignments": res.data or []}
