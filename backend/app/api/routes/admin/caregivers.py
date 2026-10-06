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
from app.models.enums import ALLOWED_TRANSITIONS
from app.services.audit import record_audit_log
from app.utils.notifications import notify
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)

from app.schemas.caregivers import CaregiverApplicationListResponse

router = APIRouter()


class ApplicationReviewRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected|under_review|onboarding)$")
    notes: Optional[str] = None


@router.get("/caregivers", response_model=CaregiverApplicationListResponse)
def list_caregivers(
    status_filter: Optional[str] = Query(None, alias="status"),
    params: PaginationParams = Depends(),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    query = active_only(
        supabase.table("caregiver_applications").select(
            "id, caregiver_id, state_id, status, submitted_at, reviewed_at, reviewed_by, notes, rejection_reason, created_at, updated_at, caregivers(first_name, last_name, phone, address, ssn_last4, deleted_at), states(code, name, slug)",
            count="exact",
        ),
        "caregiver_applications",
    )
    query = scope_query(query, scope)
    if status_filter and status_filter != "all":
        query = query.eq("status", status_filter)

    result = paginate(query.order("created_at", desc=True), params)
    trim_embedded(result["items"], "caregivers")

    # If an explicit status filter was requested and matched nothing, return empty
    # rather than synthesizing un-filtered approved caregivers (fixes L1).
    if status_filter and status_filter != "all":
        return {"applications": result.pop("items"), **result}

    if result.get("total", 0) == 0:
        cg_query = active_only(
            supabase.table("caregivers").select(
                "id, state_id, first_name, last_name, phone, address, date_of_birth, ssn_last4, created_at, updated_at, legal_hold, states(code, name, slug)",
                count="exact",
            ),
            "caregivers",
        )
        cg_query = scope_query(cg_query, scope)
        cg_result = paginate(cg_query, params)
        synth_apps = []
        for cg in cg_result.get("items", []):
            synth_apps.append({
                "id": cg["id"],
                "caregiver_id": cg["id"],
                "state_id": cg.get("state_id"),
                "status": "approved",
                "submitted_at": cg.get("created_at"),
                "caregivers": cg,
                "states": cg.get("states"),
            })
        return {
            "applications": synth_apps,
            "total": cg_result.get("total", 0),
            "page": cg_result.get("page", 1),
            "page_size": cg_result.get("page_size", 20),
            "pages": cg_result.get("pages", 0),
        }

    return {"applications": result.pop("items"), **result}


@router.post("/caregivers/{application_id}/review")
def review_caregiver_application(
    application_id: str,
    payload: ApplicationReviewRequest,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    existing = (
        supabase.table("caregiver_applications")
        .select("id, caregiver_id, state_id, status, notes, rejection_reason, submitted_at")
        .eq("id", application_id)
        .execute()
    )

    if existing.data:
        old_app = existing.data[0]
    else:
        cg_res = (
            supabase.table("caregivers")
            .select("id, state_id, first_name, last_name")
            .eq("id", application_id)
            .execute()
        )
        if not cg_res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
        cg = cg_res.data[0]
        now_iso = datetime.now(timezone.utc).isoformat()
        ins_app = supabase.table("caregiver_applications").insert({
            "id": application_id,
            "caregiver_id": cg["id"],
            "state_id": cg.get("state_id"),
            "status": "under_review",
            "submitted_at": now_iso,
        }).execute()
        if ins_app.data:
            old_app = ins_app.data[0]
        else:
            old_app = {
                "id": application_id,
                "caregiver_id": cg["id"],
                "state_id": cg.get("state_id"),
                "status": "under_review",
            }

    assert_state_allowed(scope, old_app.get("state_id"))
    old_status = old_app.get("status", "submitted")

    if payload.status not in ALLOWED_TRANSITIONS.get(old_status, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot move application from '{old_status}' to '{payload.status}'.",
        )

    if payload.status == "rejected" and not (payload.notes or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A rejection reason is required when rejecting an application.",
        )

    now_iso = datetime.now(timezone.utc).isoformat()

    update_payload = {
        "status": payload.status,
        "reviewed_at": now_iso,
        "reviewed_by": admin_id,
    }
    if payload.status == "rejected":
        update_payload["rejection_reason"] = payload.notes
    elif payload.notes:
        update_payload["notes"] = payload.notes

    res = scope_query(
        supabase.table("caregiver_applications")
        .upsert({**old_app, **update_payload, "id": application_id}),
        scope,
    ).execute()

    record_audit_log(
        supabase,
        user_id=admin_id,
        action=f"caregiver_application_{payload.status}",
        table_name="caregiver_applications",
        record_id=application_id,
        old_values={"status": old_status, "notes": old_app.get("notes")},
        new_values=update_payload,
    )

    rejection_note = payload.notes if payload.status == "rejected" else None
    msg_body = f"Your caregiver application status has been updated to: {payload.status.replace('_', ' ')}."
    if rejection_note:
        msg_body += f" Reason: {rejection_note}"
    elif payload.notes:
        msg_body += f" Note: {payload.notes}"

    if old_app.get("caregiver_id"):
        notify(
            supabase,
            old_app["caregiver_id"],
            f"application_{payload.status}",
            "Application Status Updated",
            msg_body,
        )

    updated_app = res.data[0] if res.data else {**old_app, **update_payload}
    return {"message": "Application updated successfully", "application": updated_app}


@router.get("/caregivers/{application_id}")
def get_caregiver_application_detail(
    application_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    app_res = (
        active_only(
            supabase.table("caregiver_applications").select(
                "*, caregivers(first_name, last_name, phone, address, date_of_birth, ssn_last4, deleted_at), users:users!caregiver_applications_reviewed_by_fkey(email, status, deleted_at), states(code, name, slug)"
            ),
            "caregiver_applications",
        )
        .eq("id", application_id)
        .execute()
    )

    if app_res.data:
        application = app_res.data[0]
    else:
        cg_res = (
            active_only(
                supabase.table("caregivers").select("*, states(code, name, slug)"),
                "caregivers",
            )
            .eq("id", application_id)
            .execute()
        )
        if cg_res.data:
            cg = cg_res.data[0]
            application = {
                "id": cg["id"],
                "caregiver_id": cg["id"],
                "state_id": cg.get("state_id"),
                "status": "approved",
                "submitted_at": cg.get("created_at"),
                "caregivers": cg,
                "states": cg.get("states"),
            }
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")

    trim_embedded([application], "caregivers", "users")
    assert_state_allowed(scope, application.get("state_id"))
    caregiver_id = application.get("caregiver_id")

    enrollments = []
    if caregiver_id:
        enr_res = (
            active_only(
                supabase.table("training_enrollments").select(
                    "*, training_courses(name, description, duration_hours)"
                ),
                "training_enrollments",
            )
            .eq("caregiver_id", caregiver_id)
            .order("enrolled_at", desc=True)
            .execute()
        )
        enrollments = enr_res.data or []

    return {
        "application": application,
        "enrollments": enrollments,
    }


@router.get("/caregivers/{application_id}/documents")
def get_caregiver_application_documents(
    application_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    app_res = (
        active_only(
            supabase.table("caregiver_applications").select("caregiver_id, state_id"),
            "caregiver_applications",
        )
        .eq("id", application_id)
        .execute()
    )

    if app_res.data:
        caregiver_id = app_res.data[0].get("caregiver_id")
        state_id = app_res.data[0].get("state_id")
    else:
        cg_res = (
            active_only(
                supabase.table("caregivers").select("id, state_id"),
                "caregivers",
            )
            .eq("id", application_id)
            .execute()
        )
        if cg_res.data:
            caregiver_id = cg_res.data[0].get("id")
            state_id = cg_res.data[0].get("state_id")
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")

    if caregiver_id:
        user_res = (
            supabase.table("users").select("id, deleted_at")
            .eq("id", caregiver_id)
            .execute()
        )
        if user_res.data and user_res.data[0].get("deleted_at"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found.")

    assert_state_allowed(scope, state_id)

    doc_res = scope_query(
        active_only(
            supabase.table("documents").select(
                "*, document_types(name, for_role, requires_expiration)"
            ),
            "documents",
        )
        .eq("owner_id", caregiver_id),
        scope,
    ).order("uploaded_at", desc=True).execute()

    return {"documents": doc_res.data or []}
