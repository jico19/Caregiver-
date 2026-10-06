from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.dependencies import require_super_admin
from app.core.supabase import get_supabase
from app.services.audit import record_audit_log

router = APIRouter()


class LegalHoldRequest(BaseModel):
    legal_hold: bool
    reason: Optional[str] = None


@router.patch("/clients/{client_id}/legal-hold")
def toggle_client_legal_hold(
    client_id: str,
    payload: LegalHoldRequest,
    request: Request,
    user: dict = Depends(require_super_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    existing = (
        supabase.table("clients")
        .select("id, state_id, legal_hold")
        .eq("id", client_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found.",
        )

    old_row = existing.data[0]
    old_hold = old_row.get("legal_hold", False)

    res = (
        supabase.table("clients")
        .update({"legal_hold": payload.legal_hold})
        .eq("id", client_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update client legal hold.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="legal_hold_toggled",
        table_name="clients",
        record_id=client_id,
        old_values={"legal_hold": old_hold},
        new_values={"legal_hold": payload.legal_hold, "reason": payload.reason},
        request=request,
        entity_state_id=old_row.get("state_id"),
    )

    return {"message": "Client legal hold updated", "client": res.data[0]}


@router.patch("/caregivers/{caregiver_id}/legal-hold")
def toggle_caregiver_legal_hold(
    caregiver_id: str,
    payload: LegalHoldRequest,
    request: Request,
    user: dict = Depends(require_super_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    existing = (
        supabase.table("caregivers")
        .select("id, state_id, legal_hold")
        .eq("id", caregiver_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caregiver not found.",
        )

    old_row = existing.data[0]
    old_hold = old_row.get("legal_hold", False)

    res = (
        supabase.table("caregivers")
        .update({"legal_hold": payload.legal_hold})
        .eq("id", caregiver_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update caregiver legal hold.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="legal_hold_toggled",
        table_name="caregivers",
        record_id=caregiver_id,
        old_values={"legal_hold": old_hold},
        new_values={"legal_hold": payload.legal_hold, "reason": payload.reason},
        request=request,
        entity_state_id=old_row.get("state_id"),
    )

    return {"message": "Caregiver legal hold updated", "caregiver": res.data[0]}


@router.patch("/documents/{document_id}/legal-hold")
def toggle_document_legal_hold(
    document_id: str,
    payload: LegalHoldRequest,
    request: Request,
    user: dict = Depends(require_super_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    existing = (
        supabase.table("documents")
        .select("id, state_id, legal_hold")
        .eq("id", document_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    old_row = existing.data[0]
    old_hold = old_row.get("legal_hold", False)

    res = (
        supabase.table("documents")
        .update({"legal_hold": payload.legal_hold})
        .eq("id", document_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update document legal hold.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="legal_hold_toggled",
        table_name="documents",
        record_id=document_id,
        old_values={"legal_hold": old_hold},
        new_values={"legal_hold": payload.legal_hold, "reason": payload.reason},
        request=request,
        entity_state_id=old_row.get("state_id"),
    )

    return {"message": "Document legal hold updated", "document": res.data[0]}


@router.post("/clients/{client_id}/erasure-request")
def process_client_erasure_request(
    client_id: str,
    request: Request,
    user: dict = Depends(require_super_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    client_res = (
        supabase.table("clients")
        .select("id, state_id, deleted_at, legal_hold, states(code, name)")
        .eq("id", client_id)
        .execute()
    )
    if not client_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client record not found.",
        )

    client_row = client_res.data[0]
    state_code = client_row.get("states", {}).get("code", "FL") if client_row.get("states") else "FL"

    statutory_years = 7 if state_code == "IN" else (6 if state_code == "GA" else 5)
    deleted_at_str = client_row.get("deleted_at")

    if not deleted_at_str:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Erasure request refused: Client is active. Record must be discharged and soft-deleted before statutory erasure evaluation.",
        )

    deleted_at = datetime.fromisoformat(deleted_at_str.replace("Z", "+00:00"))
    cutoff = datetime.now(timezone.utc) - timedelta(days=statutory_years * 365)

    if deleted_at > cutoff:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Erasure request refused: Statutory clinical retention requirement ({statutory_years} years for {state_code}) has not elapsed.",
        )

    if client_row.get("legal_hold"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Erasure request refused: Record is under an active legal hold.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="dsar_erasure_approved",
        table_name="clients",
        record_id=client_id,
        new_values={"statutory_years": statutory_years, "state_code": state_code},
        request=request,
        entity_state_id=client_row.get("state_id"),
    )

    return {
        "message": "Data Subject Erasure Request approved and queued for purge.",
        "statutory_retention_years": statutory_years,
        "eligible": True,
    }
