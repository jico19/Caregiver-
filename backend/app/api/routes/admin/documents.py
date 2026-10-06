from datetime import datetime, timezone
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
from app.services.audit import record_audit_log
from app.utils.notifications import notify
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)

router = APIRouter()


class DocumentReviewRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    rejection_reason: Optional[str] = None


@router.get("/documents")
def list_admin_documents(
    status_filter: Optional[str] = Query(None, alias="status"),
    params: PaginationParams = Depends(),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    query = active_only(
        supabase.table("documents").select(
            "id, owner_id, state_id, document_type_id, status, storage_path, expiration_date, rejection_reason, reviewed_at, reviewed_by, uploaded_at, document_types(name, for_role, requires_expiration), users:users!documents_owner_id_fkey(email, role_id, deleted_at), states(code, name)",
            count="exact",
        ),
        "documents",
    )
    query = scope_query(query, scope)
    if status_filter and status_filter != "all":
        query = query.eq("status", status_filter)

    result = paginate(query.order("uploaded_at", desc=True), params)
    owner_ids = [item["owner_id"] for item in result["items"] if "owner_id" in item]
    if owner_ids:
        del_users = (
            supabase.table("users").select("id, deleted_at")
            .in_("id", owner_ids)
            .execute()
        )
        del_user_ids = {u["id"] for u in (del_users.data or []) if u.get("deleted_at")}
        result["items"] = [item for item in result["items"] if item.get("owner_id") not in del_user_ids]
    trim_embedded(result["items"], "users")
    return {"documents": result.pop("items"), **result}


@router.post("/documents/{document_id}/review")
def review_document(
    document_id: str,
    payload: DocumentReviewRequest,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    existing = (
        active_only(
            supabase.table("documents").select("id, owner_id, state_id, status, rejection_reason"),
            "documents",
        )
        .eq("id", document_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    old_doc = existing.data
    assert_state_allowed(scope, old_doc.get("state_id"))
    now_iso = datetime.now(timezone.utc).isoformat()

    update_payload = {
        "status": payload.status,
        "reviewed_at": now_iso,
        "reviewed_by": admin_id,
        "rejection_reason": payload.rejection_reason if payload.status == "rejected" else None,
    }

    res = scope_query(
        active_only(
            supabase.table("documents").update(update_payload),
            "documents",
        )
        .eq("id", document_id),
        scope,
    ).execute()

    record_audit_log(
        supabase,
        user_id=admin_id,
        action=f"document_{payload.status}",
        table_name="documents",
        record_id=document_id,
        old_values={"status": old_doc.get("status")},
        new_values=update_payload,
        entity_state_id=old_doc.get("state_id"),
    )

    msg_body = f"Your uploaded document status is now: {payload.status}."
    if payload.rejection_reason:
        msg_body += f" Reason: {payload.rejection_reason}"

    if old_doc.get("owner_id"):
        notify(
            supabase,
            old_doc["owner_id"],
            f"document_{payload.status}",
            "Document Compliance Review",
            msg_body,
        )

    return {"message": "Document reviewed successfully", "document": res.data[0]}
