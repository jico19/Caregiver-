from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.core.dependencies import (
    AdminScope,
    assert_permitted_filter,
    assert_state_allowed,
    require_admin_scoped,
)
from app.core.supabase import get_supabase
from app.services.audit import record_audit_log

router = APIRouter()


class UpdateDocumentRequirementRequest(BaseModel):
    requirement_id: str
    required: bool
    reason: Optional[str] = None


@router.get("/settings/document-requirements")
def list_document_requirements(
    state_id: Optional[int] = Query(None, ge=1),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    target_state = None
    if state_id:
        target_state = assert_permitted_filter(scope, state_id)
    elif not scope.is_super and scope.states:
        target_state = scope.states[0]

    query = supabase.table("document_requirements").select(
        "id, state_id, document_type_id, required, created_at, updated_at, document_types(id, name, for_role, requires_expiration), states(id, code, name)"
    ).order("state_id")

    if target_state:
        query = query.eq("state_id", target_state)
    elif not scope.is_super and scope.states:
        query = query.in_("state_id", scope.states)

    res = query.execute()
    return {"requirements": res.data or []}


@router.put("/settings/document-requirements")
def update_document_requirement(
    payload: UpdateDocumentRequirementRequest,
    request: Request,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    existing = (
        supabase.table("document_requirements")
        .select("id, state_id, required")
        .eq("id", payload.requirement_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document requirement not found.",
        )

    req_data = existing.data
    assert_state_allowed(scope, req_data.get("state_id"))

    old_required = req_data.get("required")
    update_data = {"required": payload.required}

    res = (
        supabase.table("document_requirements")
        .update(update_data)
        .eq("id", payload.requirement_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update document requirement.",
        )

    updated_req = res.data[0]

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="document_requirement_updated",
        table_name="document_requirements",
        record_id=payload.requirement_id,
        old_values={"required": old_required},
        new_values={"required": payload.required, "reason": payload.reason},
        request=request,
        entity_state_id=req_data.get("state_id"),
    )

    return {
        "message": "Document requirement updated successfully",
        "requirement": updated_req,
    }
