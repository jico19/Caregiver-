from fastapi import APIRouter, Depends, HTTPException, status
from app.core.dependencies import require_super_admin
from app.core.supabase import get_supabase
from app.core.soft_delete import (
    IMMUTABLE_TABLES,
    SOFT_DELETE_TABLES,
    restore_stamp,
)
from app.services.audit import record_audit_log

router = APIRouter()


@router.post("/{resource}/{id}/restore")
def restore_resource(
    resource: str,
    id: str,
    user: dict = Depends(require_super_admin),
):
    table_name = resource.replace("-", "_")
    if table_name in IMMUTABLE_TABLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{resource} is immutable and cannot be restored",
        )
    if table_name not in SOFT_DELETE_TABLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Resource '{resource}' is not soft-deletable",
        )

    supabase = get_supabase()
    existing = (
        supabase.table(table_name)
        .select("id, deleted_at, deleted_by")
        .eq("id", id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} not found.",
        )

    update_payload = restore_stamp()
    if table_name == "users":
        update_payload["status"] = "active"

    res = (
        supabase.table(table_name)
        .update(update_payload)
        .eq("id", id)
        .execute()
    )

    record_audit_log(
        supabase,
        user_id=user["sub"],
        action=f"{table_name}_restored",
        table_name=table_name,
        record_id=id,
        old_values={"deleted_at": existing.data.get("deleted_at"), "deleted_by": existing.data.get("deleted_by")},
        new_values=update_payload,
    )

    return {"message": f"{resource} restored successfully", "item": res.data[0] if res.data else None}
