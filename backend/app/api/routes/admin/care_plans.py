from datetime import datetime, timezone
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends
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


class CarePlanActivityInput(BaseModel):
    task: str = Field(..., min_length=1, max_length=200)
    frequency: Optional[str] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


class CarePlanUpdateRequest(BaseModel):
    status: Optional[str] = Field(None, pattern="^(active|pending|inactive)$")
    effective_date: Optional[str] = None
    primary_nurse: Optional[str] = Field(None, max_length=200)
    emergency_protocol: Optional[str] = None
    activities: Optional[List[CarePlanActivityInput]] = None


def fetch_care_plan_with_activities(supabase, client_id: str):
    """Fetch care plan and related activities projecting explicit columns."""
    plan_res = (
        active_only(
            supabase.table("care_plans").select(
                "id, client_id, state_id, status, effective_date, primary_nurse, emergency_protocol, created_at, updated_at"
            ),
            "care_plans",
        )
        .eq("client_id", client_id)
        .single()
        .execute()
    )
    plan = plan_res.data
    if not plan:
        return {"care_plan": None}

    activities_res = (
        active_only(
            supabase.table("care_plan_activities").select(
                "id, care_plan_id, task, frequency, notes, sort_order, created_at, updated_at"
            ),
            "care_plan_activities",
        )
        .eq("care_plan_id", plan["id"])
        .order("sort_order")
        .execute()
    )
    return {"care_plan": {**plan, "activities": activities_res.data or []}}


@router.get("/clients/{client_id}/care-plan")
def get_client_care_plan(
    client_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    get_client_or_404(supabase, client_id, scope)
    return fetch_care_plan_with_activities(supabase, client_id)


@router.put("/clients/{client_id}/care-plan")
def update_client_care_plan(
    client_id: str,
    payload: CarePlanUpdateRequest,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id
    client = get_client_or_404(supabase, client_id, scope)

    existing = (
        active_only(
            supabase.table("care_plans").select("id"),
            "care_plans",
        )
        .eq("client_id", client_id)
        .single()
        .execute()
    )
    now_iso = datetime.now(timezone.utc).isoformat()

    update_fields = {
        "status": payload.status if payload.status is not None else "active",
        "primary_nurse": payload.primary_nurse,
        "emergency_protocol": payload.emergency_protocol,
    }
    if payload.effective_date is not None:
        update_fields["effective_date"] = payload.effective_date

    if existing.data:
        plan_id = existing.data["id"]
        update_fields["updated_at"] = now_iso
        scope_query(
            active_only(
                supabase.table("care_plans").update(update_fields),
                "care_plans",
            ).eq("client_id", client_id),
            scope,
        ).execute()
    else:
        inserted = (
            supabase.table("care_plans")
            .insert({
                "client_id": client_id,
                "state_id": client["state_id"],
                "created_by": admin_id,
                **update_fields,
            })
            .execute()
        )
        plan_id = inserted.data[0]["id"]

    if payload.activities is not None:
        (
            active_only(
                supabase.table("care_plan_activities").update(
                    soft_delete_stamp(admin_id)
                ),
                "care_plan_activities",
            )
            .eq("care_plan_id", plan_id)
            .execute()
        )
        record_audit_log(
            supabase,
            user_id=admin_id,
            action="care_plan_activities_replaced",
            table_name="care_plan_activities",
            record_id=plan_id,
            new_values={"activity_count": len(payload.activities)},
        )
        if payload.activities:
            activities_to_insert = [
                {
                    "care_plan_id": plan_id,
                    "task": act.task,
                    "frequency": act.frequency,
                    "notes": act.notes,
                    "sort_order": act.sort_order if act.sort_order is not None else i,
                }
                for i, act in enumerate(payload.activities)
            ]
            supabase.table("care_plan_activities").insert(activities_to_insert).execute()

    return fetch_care_plan_with_activities(supabase, client_id)
