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
from app.services.compliance import (
    check_caregiver_assignment_compliance,
    get_caregiver_compliance_summary,
)
from .clients import get_client_or_404

router = APIRouter()


class CaregiverAssignmentCreateRequest(BaseModel):
    caregiver_id: str
    role: Optional[str] = Field("primary", pattern="^(primary|backup|relief)$")
    override_compliance: Optional[bool] = False
    override_reason: Optional[str] = None


@router.get("/clients/{client_id}/assignments")
def list_client_assignments(
    client_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    get_client_or_404(supabase, client_id, scope)

    try:
        res = (
            supabase.table("caregiver_client_assignments")
            .select("id, caregiver_id, client_id, role, assigned_by, assigned_at, ended_at, created_at, caregivers(id, first_name, last_name, phone, ssn_last4)")
            .eq("client_id", client_id)
            .is_("ended_at", None)
            .execute()
        )
        return {"assignments": res.data or []}
    except Exception as exc:
        err_str = str(exc)
        if "PGRST205" in err_str or "caregiver_client_assignments" in err_str:
            return {"assignments": []}
        raise


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
    client_state_id = client.get("state_id")

    target_cg_id = payload.caregiver_id
    cg_res = (
        active_only(supabase.table("caregivers").select("id, state_id, first_name, last_name"), "caregivers")
        .eq("id", payload.caregiver_id)
        .execute()
    )
    if not cg_res.data:
        app_res = (
            active_only(
                supabase.table("caregiver_applications").select("caregiver_id, state_id"),
                "caregiver_applications",
            )
            .eq("id", payload.caregiver_id)
            .execute()
        )
        if app_res.data and app_res.data[0].get("caregiver_id"):
            target_cg_id = app_res.data[0].get("caregiver_id")
            cg_res = (
                active_only(supabase.table("caregivers").select("id, state_id, first_name, last_name"), "caregivers")
                .eq("id", target_cg_id)
                .execute()
            )

    if not cg_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found.")

    cg = cg_res.data[0]
    cg_state_id = cg.get("state_id")
    assert_state_allowed(scope, cg_state_id)

    # Validate state match between caregiver and client
    if client_state_id and cg_state_id != client_state_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Caregiver belongs to state {cg_state_id} but client belongs to state {client_state_id}. Caregiver does not belong to the same state as the client.",
        )

    # Compliance Gate
    is_compliant, blocking_reasons = check_caregiver_assignment_compliance(
        supabase,
        caregiver_id=target_cg_id,
        state_id=client_state_id or cg_state_id,
    )

    if not is_compliant:
        if payload.override_compliance:
            if not scope.is_super:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only super administrators can override compliance checks.",
                )
            if not payload.override_reason or not payload.override_reason.strip():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="An override reason is required to bypass compliance checks.",
                )
        else:
            reasons_str = "; ".join(blocking_reasons)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Caregiver compliance check failed: {reasons_str}",
            )

    now_iso = datetime.now(timezone.utc).isoformat()
    assign_data = {
        "id": f"{target_cg_id}:{client_id}",
        "caregiver_id": target_cg_id,
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

    audit_data = dict(assign_data)
    if not is_compliant and payload.override_compliance:
        audit_data["compliance_override"] = True
        audit_data["override_reason"] = payload.override_reason.strip()
        audit_data["blocking_reasons"] = blocking_reasons

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="caregiver_client_assigned",
        table_name="caregiver_client_assignments",
        record_id=f"{target_cg_id}:{client_id}",
        new_values=audit_data,
        request=request,
        entity_state_id=client.get("state_id"),
    )

    if not is_compliant and payload.override_compliance:
        record_audit_log(
            supabase,
            user_id=admin_id,
            action="caregiver_compliance_override",
            table_name="caregiver_client_assignments",
            record_id=f"{target_cg_id}:{client_id}",
            new_values={
                "caregiver_id": target_cg_id,
                "client_id": client_id,
                "override_reason": payload.override_reason.strip(),
                "blocking_reasons": blocking_reasons,
            },
            request=request,
            entity_state_id=client.get("state_id"),
        )

    notify(
        supabase,
        target_cg_id,
        "client_assigned",
        "New Client Assignment",
        f"You have been assigned as {payload.role or 'primary'} caregiver for client {client.get('first_name', '')} {client.get('last_name', '')}.",
    )

    return {"message": "Caregiver assigned successfully", "assignment": res.data[0]}


@router.get("/caregivers/{caregiver_id}/compliance")
def get_caregiver_compliance(
    caregiver_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    cg_res = (
        active_only(supabase.table("caregivers").select("id, state_id"), "caregivers")
        .eq("id", caregiver_id)
        .execute()
    )
    if cg_res.data:
        target_cg_id = cg_res.data[0].get("id")
        target_state_id = cg_res.data[0].get("state_id")
    else:
        app_res = (
            active_only(
                supabase.table("caregiver_applications").select("caregiver_id, state_id"),
                "caregiver_applications",
            )
            .eq("id", caregiver_id)
            .execute()
        )
        if app_res.data:
            target_cg_id = app_res.data[0].get("caregiver_id")
            target_state_id = app_res.data[0].get("state_id")
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found.")

    assert_state_allowed(scope, target_state_id)
    return get_caregiver_compliance_summary(supabase, target_cg_id, target_state_id)


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
        .execute()
    )
    if cg_res.data:
        target_cg_id = cg_res.data[0].get("id")
        target_state_id = cg_res.data[0].get("state_id")
    else:
        app_res = (
            active_only(
                supabase.table("caregiver_applications").select("caregiver_id, state_id"),
                "caregiver_applications",
            )
            .eq("id", caregiver_id)
            .execute()
        )
        if app_res.data:
            target_cg_id = app_res.data[0].get("caregiver_id")
            target_state_id = app_res.data[0].get("state_id")
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found.")

    assert_state_allowed(scope, target_state_id)

    try:
        res = (
            supabase.table("caregiver_client_assignments")
            .select("id, caregiver_id, client_id, role, assigned_by, assigned_at, ended_at, created_at, clients(id, first_name, last_name, phone, address, status, states(code, name))")
            .eq("caregiver_id", target_cg_id)
            .is_("ended_at", None)
            .execute()
        )
        return {"assignments": res.data or []}
    except Exception as exc:
        err_str = str(exc)
        if "PGRST205" in err_str or "caregiver_client_assignments" in err_str:
            return {"assignments": []}
        raise
