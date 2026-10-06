import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.dependencies import (
    AdminScope,
    require_admin_scoped,
    scope_query,
)
from app.core.supabase import get_supabase
from app.core.soft_delete import (
    active_only,
    soft_delete_stamp,
)
from app.services.audit import record_audit_log
from .clients import get_client_or_404

logger = logging.getLogger(__name__)

router = APIRouter()


class ScheduleCreateRequest(BaseModel):
    day_of_week: str = Field(..., min_length=1, max_length=20)
    start_time: str = Field(..., min_length=1, max_length=10)
    end_time: str = Field(..., min_length=1, max_length=10)
    service: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = Field(None, pattern="^(scheduled|confirmed|completed|cancelled)$")
    notes: Optional[str] = None
    sort_order: Optional[int] = None


@router.get("/clients/{client_id}/schedule")
def get_client_schedule(
    client_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    get_client_or_404(supabase, client_id, scope)

    res = (
        active_only(
            supabase.table("care_schedules").select(
                "id, client_id, state_id, day_of_week, start_time, end_time, service, status, notes, sort_order, created_at"
            ),
            "care_schedules",
        )
        .eq("client_id", client_id)
        .execute()
    )
    DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    def day_index(r):
        try:
            return DAY_ORDER.index(r.get("day_of_week"))
        except ValueError:
            return len(DAY_ORDER)

    records = sorted(res.data or [], key=lambda r: (day_index(r), r.get("sort_order") or 0))
    return {"schedule": records}


@router.post("/clients/{client_id}/schedule")
def create_client_schedule(
    client_id: str,
    payload: ScheduleCreateRequest,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    client = get_client_or_404(supabase, client_id, scope)

    sort_order = payload.sort_order
    if sort_order is None:
        last_res = (
            supabase.table("care_schedules")
            .select("sort_order")
            .eq("client_id", client_id)
            .order("sort_order", desc=True)
            .limit(1)
            .execute()
        )
        sort_order = (last_res.data[0]["sort_order"] + 1) if last_res.data else 0

    inserted = (
        supabase.table("care_schedules")
        .insert({
            "client_id": client_id,
            "state_id": client["state_id"],
            "day_of_week": payload.day_of_week,
            "start_time": payload.start_time,
            "end_time": payload.end_time,
            "service": payload.service,
            "status": payload.status or "scheduled",
            "notes": payload.notes,
            "sort_order": sort_order,
        })
        .execute()
    )
    if not inserted.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add schedule entry.",
        )

    entry = inserted.data[0]
    record_audit_log(
        supabase,
        user_id=scope.user_id,
        action="care_schedule_created",
        table_name="care_schedules",
        record_id=str(entry["id"]),
        new_values=entry,
        entity_state_id=client["state_id"],
    )

    return {"message": "Schedule entry added", "entry": entry}


@router.delete("/clients/{client_id}/schedule/{schedule_id}")
def delete_client_schedule(
    client_id: str,
    schedule_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    get_client_or_404(supabase, client_id, scope)

    deleted = scope_query(
        active_only(
            supabase.table("care_schedules").update(soft_delete_stamp(scope.user_id)),
            "care_schedules",
        )
        .eq("id", schedule_id)
        .eq("client_id", client_id),
        scope,
    ).execute()
    if not deleted.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule entry not found for this client.",
        )

    record_audit_log(
        supabase,
        user_id=scope.user_id,
        action="care_schedule_soft_deleted",
        table_name="care_schedules",
        record_id=schedule_id,
        new_values={"client_id": client_id},
    )

    return {"message": "Schedule entry removed"}
