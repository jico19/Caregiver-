import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.dependencies import (
    AdminScope,
    assert_permitted_filter,
    assert_state_allowed,
    require_admin_scoped,
    scope_query,
)
from app.core.supabase import get_supabase
from app.core.soft_delete import (
    active_only,
    soft_delete_stamp,
    trim_embedded,
)
from app.services.audit import record_audit_log
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)

router = APIRouter()


class AnnouncementCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1)
    audience: str = Field(..., pattern="^(caregiver|client|all)$")
    state_id: Optional[int] = None
    is_active: bool = True


class AnnouncementUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    body: Optional[str] = Field(None, min_length=1)
    audience: Optional[str] = Field(None, pattern="^(caregiver|client|all)$")
    state_id: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/announcements")
def list_announcements(
    params: PaginationParams = Depends(),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    result = paginate(
        scope_query(
            active_only(
                supabase.table("announcements").select(
                    "id, state_id, title, body, audience, is_active, created_by, created_at, updated_at, users:users!announcements_created_by_fkey(email, deleted_at), states(code)",
                    count="exact",
                ),
                "announcements",
            ),
            scope,
        ).order("created_at", desc=True),
        params,
    )
    trim_embedded(result["items"], "users")
    return {"announcements": result.pop("items"), **result}


@router.post("/announcements")
def create_announcement(
    payload: AnnouncementCreateRequest,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    if scope.is_super:
        ann_state = payload.state_id
    else:
        ann_state = (
            assert_permitted_filter(scope, payload.state_id) or scope.states[0]
        )

    ann_data = {
        "title": payload.title.strip(),
        "body": payload.body.strip(),
        "audience": payload.audience,
        "state_id": ann_state,
        "is_active": payload.is_active,
        "created_by": admin_id,
    }

    res = supabase.table("announcements").insert(ann_data).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create announcement.",
        )

    new_ann = res.data[0]

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="announcement_created",
        table_name="announcements",
        record_id=new_ann.get("id"),
        new_values=ann_data,
        entity_state_id=ann_state,
    )

    return {"message": "Announcement created successfully", "announcement": new_ann}


@router.patch("/announcements/{announcement_id}")
def update_announcement(
    announcement_id: str,
    payload: AnnouncementUpdateRequest,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    existing = (
        active_only(
            supabase.table("announcements").select("id, state_id, title, body, audience, is_active"),
            "announcements",
        )
        .eq("id", announcement_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found.",
        )
    assert_state_allowed(scope, existing.data.get("state_id"))

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    if "state_id" in updates and not scope.is_super:
        updates["state_id"] = (
            assert_permitted_filter(scope, updates["state_id"]) or scope.states[0]
        )

    res = scope_query(
        active_only(
            supabase.table("announcements").update(updates),
            "announcements",
        )
        .eq("id", announcement_id),
        scope,
    ).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="announcement_updated",
        table_name="announcements",
        record_id=announcement_id,
        new_values=updates,
        entity_state_id=existing.data.get("state_id"),
    )

    return {"message": "Announcement updated successfully", "announcement": res.data[0]}


@router.delete("/announcements/{announcement_id}")
def delete_announcement(
    announcement_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    existing = (
        active_only(
            supabase.table("announcements").select("id, state_id, title"),
            "announcements",
        )
        .eq("id", announcement_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found.",
        )
    assert_state_allowed(scope, existing.data.get("state_id"))

    scope_query(
        active_only(
            supabase.table("announcements").update(soft_delete_stamp(admin_id)),
            "announcements",
        )
        .eq("id", announcement_id),
        scope,
    ).execute()

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="announcement_deleted",
        table_name="announcements",
        record_id=announcement_id,
        old_values={"title": existing.data.get("title")},
        entity_state_id=existing.data.get("state_id"),
    )

    return {"message": "Announcement deleted successfully"}
