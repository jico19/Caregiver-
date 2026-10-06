from datetime import datetime, timezone
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.core.dependencies import (
    AdminScope,
    assert_state_allowed,
    require_admin_scoped,
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


class AdminAssignTrainingRequest(BaseModel):
    caregiver_id: str
    course_id: str
    due_at: Optional[str] = None


@router.get("/training")
def list_admin_training(
    course_id: Optional[str] = Query(None),
    caregiver_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    params: PaginationParams = Depends(),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    query = active_only(
        supabase.table("training_enrollments").select(
            "id, caregiver_id, course_id, status, enrolled_at, completed_at, due_at, created_at, updated_at, training_courses(id, name, duration_hours), caregivers!inner(first_name, last_name, phone, state_id, deleted_at)",
            count="exact",
        ),
        "training_enrollments",
    )
    if not scope.is_super:
        query = query.in_("caregivers.state_id", scope.states)
    if status_filter and status_filter != "all":
        query = query.eq("status", status_filter)
    if course_id:
        query = query.eq("course_id", course_id)
    if caregiver_id:
        query = query.eq("caregiver_id", caregiver_id)

    query = query.order("enrolled_at", desc=True)
    result = paginate(query, params)
    trim_embedded(result["items"], "caregivers")
    return {"enrollments": result.pop("items"), **result}


@router.get("/training/{enrollment_id}")
def get_admin_training_detail(
    enrollment_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    res = (
        active_only(
            supabase.table("training_enrollments").select(
                "id, caregiver_id, course_id, status, enrolled_at, completed_at, due_at, created_at, updated_at, training_courses(id, name, description, duration_hours), caregivers(first_name, last_name, phone, state_id, deleted_at)"
            ),
            "training_enrollments",
        )
        .eq("id", enrollment_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training enrollment not found.",
        )

    enrollment = res.data
    trim_embedded([enrollment], "caregivers")
    caregiver = enrollment.get("caregivers") or {}
    if caregiver.get("state_id"):
        assert_state_allowed(scope, caregiver["state_id"])

    return {"enrollment": enrollment}


@router.post("/training")
def assign_training_course(
    payload: AdminAssignTrainingRequest,
    request: Request,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    cg_res = (
        active_only(
            supabase.table("caregivers").select("id, first_name, last_name, state_id"),
            "caregivers",
        )
        .eq("id", payload.caregiver_id)
        .single()
        .execute()
    )
    if not cg_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caregiver not found.",
        )

    cg = cg_res.data
    assert_state_allowed(scope, cg.get("state_id"))

    course_res = (
        supabase.table("training_courses")
        .select("id, name, duration_hours")
        .eq("id", payload.course_id)
        .single()
        .execute()
    )
    if not course_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training course not found.",
        )

    course = course_res.data
    now_iso = datetime.now(timezone.utc).isoformat()

    existing = (
        active_only(
            supabase.table("training_enrollments").select("id, course_id, caregiver_id, status"),
            "training_enrollments",
        )
        .eq("course_id", payload.course_id)
        .eq("caregiver_id", payload.caregiver_id)
        .execute()
    )

    if existing.data:
        record = existing.data[0]
    else:
        enr_data = {
            "course_id": payload.course_id,
            "caregiver_id": payload.caregiver_id,
            "status": "in_progress",
            "enrolled_at": now_iso,
        }
        if payload.due_at:
            enr_data["due_at"] = payload.due_at

        ins = supabase.table("training_enrollments").insert(enr_data).execute()
        if not ins.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to assign training course.",
            )
        record = ins.data[0]

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="training_course_assigned",
        table_name="training_enrollments",
        record_id=str(record.get("id")),
        new_values={
            "course_id": payload.course_id,
            "caregiver_id": payload.caregiver_id,
            "assigned_by": admin_id,
        },
        request=request,
        entity_state_id=cg.get("state_id"),
    )

    notify(
        supabase,
        payload.caregiver_id,
        "training_assigned",
        "New Training Assigned",
        f"You have been assigned a new training course: {course['name']}.",
    )

    return {"message": "Training course assigned successfully", "enrollment": record}
