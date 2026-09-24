from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime, timezone, date, timedelta
import logging
from typing import Optional, List
from pydantic import BaseModel, Field
from app.core.dependencies import require_admin
from app.core.supabase import get_supabase
from app.models.enums import ALLOWED_TRANSITIONS
from app.utils.notifications import notify
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)

router = APIRouter()


class ApplicationReviewRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected|under_review|onboarding)$")
    notes: Optional[str] = None


class DocumentReviewRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    rejection_reason: Optional[str] = None


class AuthorizationCreateRequest(BaseModel):
    client_id: str
    state_id: int
    authorization_number: str = Field(..., min_length=1, max_length=100)
    start_date: str
    end_date: str
    notes: Optional[str] = None


class AuthorizationReviewRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    notes: Optional[str] = None


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


class ScheduleCreateRequest(BaseModel):
    day_of_week: str = Field(..., min_length=1, max_length=20)
    start_time: str = Field(..., min_length=1, max_length=10)
    end_time: str = Field(..., min_length=1, max_length=10)
    service: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = Field(None, pattern="^(scheduled|confirmed|completed|cancelled)$")
    notes: Optional[str] = None
    sort_order: Optional[int] = None


class ReferralStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(new|contacted|converted|closed)$")


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


def record_audit_log(
    supabase,
    user_id: str,
    action: str,
    table_name: str,
    record_id: str,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
):
    try:
        supabase.table("audit_logs").insert({
            "user_id": user_id,
            "action": action,
            "table_name": table_name,
            "record_id": str(record_id),
            "old_values": old_values,
            "new_values": new_values,
        }).execute()
    except Exception as exc:  # Never let audit bookkeeping break the main operation
        logger.warning("audit_logs insert failed (action=%s, record=%s): %s", action, record_id, exc)


@router.get("/dashboard")
def get_dashboard(
    state: Optional[str] = Query(None, description="florida, indiana, georgia, or all"),
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()

    # Base counts
    caregivers_q = supabase.table("caregivers").select("id", count="exact")
    clients_q = supabase.table("clients").select("id", count="exact")
    apps_pending_q = supabase.table("caregiver_applications").select("id", count="exact").in_("status", ["submitted", "under_review"])
    docs_pending_q = supabase.table("documents").select("id", count="exact").eq("status", "pending_review")

    if state and state != "all":
        state_row = supabase.table("states").select("id").eq("slug", state).single().execute()
        if state_row.data:
            s_id = state_row.data["id"]
            caregivers_q = caregivers_q.eq("state_id", s_id)
            clients_q = clients_q.eq("state_id", s_id)
            apps_pending_q = apps_pending_q.eq("state_id", s_id)
            docs_pending_q = docs_pending_q.eq("state_id", s_id)

    caregivers_res = caregivers_q.execute()
    clients_res = clients_q.execute()
    apps_res = apps_pending_q.execute()
    docs_res = docs_pending_q.execute()

    return {
        "metrics": {
            "total_caregivers": caregivers_res.count or 0,
            "total_clients": clients_res.count or 0,
            "pending_applications": apps_res.count or 0,
            "pending_documents": docs_res.count or 0,
        }
    }


@router.get("/caregivers")
def list_caregivers(
    status_filter: Optional[str] = Query(None, alias="status"),
    params: PaginationParams = Depends(),
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()

    query = supabase.table("caregiver_applications").select(
        "*, caregivers(first_name, last_name, phone, address, ssn_last4), states(code, name, slug)",
        count="exact",
    )
    if status_filter:
        query = query.eq("status", status_filter)

    result = paginate(query.order("created_at", desc=True), params)
    return {"applications": result.pop("items"), **result}


@router.post("/caregivers/{application_id}/review")
def review_caregiver_application(
    application_id: str,
    payload: ApplicationReviewRequest,
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    existing = (
        supabase.table("caregiver_applications")
        .select("*")
        .eq("id", application_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")

    old_app = existing.data
    old_status = old_app.get("status")

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

    res = (
        supabase.table("caregiver_applications")
        .update(update_payload)
        .eq("id", application_id)
        .execute()
    )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action=f"caregiver_application_{payload.status}",
        table_name="caregiver_applications",
        record_id=application_id,
        old_values=old_app,
        new_values=update_payload,
    )

    # In-app notification
    rejection_note = payload.notes if payload.status == "rejected" else None
    msg_body = f"Your caregiver application status has been updated to: {payload.status.replace('_', ' ')}."
    if rejection_note:
        msg_body += f" Reason: {rejection_note}"
    elif payload.notes:
        msg_body += f" Note: {payload.notes}"

    notify(
        supabase,
        old_app["caregiver_id"],
        f"application_{payload.status}",
        "Application Status Updated",
        msg_body,
    )

    return {"message": "Application updated successfully", "application": res.data[0]}


@router.get("/caregivers/{application_id}")
def get_caregiver_application_detail(
    application_id: str,
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()

    app_res = (
        supabase.table("caregiver_applications")
        .select("*, caregivers(first_name, last_name, phone, address, date_of_birth, ssn_last4), users(email, status), states(code, name, slug)")
        .eq("id", application_id)
        .single()
        .execute()
    )
    if not app_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")

    application = app_res.data
    caregiver_id = application.get("caregiver_id")

    enrollments = []
    if caregiver_id:
        enr_res = (
            supabase.table("training_enrollments")
            .select("*, training_courses(name, description, duration_hours)")
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
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()

    app_res = (
        supabase.table("caregiver_applications")
        .select("caregiver_id")
        .eq("id", application_id)
        .single()
        .execute()
    )
    if not app_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")

    doc_res = (
        supabase.table("documents")
        .select("*, document_types(name, for_role, requires_expiration)")
        .eq("owner_id", app_res.data["caregiver_id"])
        .order("uploaded_at", desc=True)
        .execute()
    )

    return {"documents": doc_res.data or []}


@router.get("/documents")
def list_admin_documents(
    status_filter: Optional[str] = Query(None, alias="status"),
    params: PaginationParams = Depends(),
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()

    query = supabase.table("documents").select(
        "*, document_types(name, for_role, requires_expiration), users:users!documents_owner_id_fkey(email, role_id), states(code, name)",
        count="exact",
    )
    if status_filter:
        query = query.eq("status", status_filter)

    result = paginate(query.order("uploaded_at", desc=True), params)
    return {"documents": result.pop("items"), **result}


@router.post("/documents/{document_id}/review")
def review_document(
    document_id: str,
    payload: DocumentReviewRequest,
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    existing = (
        supabase.table("documents")
        .select("*")
        .eq("id", document_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    old_doc = existing.data
    now_iso = datetime.now(timezone.utc).isoformat()

    update_payload = {
        "status": payload.status,
        "reviewed_at": now_iso,
        "reviewed_by": admin_id,
        "rejection_reason": payload.rejection_reason if payload.status == "rejected" else None,
    }

    res = (
        supabase.table("documents")
        .update(update_payload)
        .eq("id", document_id)
        .execute()
    )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action=f"document_{payload.status}",
        table_name="documents",
        record_id=document_id,
        old_values=old_doc,
        new_values=update_payload,
    )

    # In-app notification
    msg_body = f"Your uploaded document status is now: {payload.status}."
    if payload.rejection_reason:
        msg_body += f" Reason: {payload.rejection_reason}"

    notify(
        supabase,
        old_doc["owner_id"],
        f"document_{payload.status}",
        "Document Compliance Review",
        msg_body,
    )

    return {"message": "Document reviewed successfully", "document": res.data[0]}


@router.get("/clients")
def list_admin_clients(
    params: PaginationParams = Depends(),
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()

    result = paginate(
        supabase.table("clients").select(
            "*, states(code, name, slug), users(email, status)", count="exact"
        ).order("created_at", desc=True),
        params,
    )
    return {"clients": result.pop("items"), **result}


@router.get("/clients/{client_id}")
def get_admin_client(
    client_id: str,
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()

    res = (
        supabase.table("clients")
        .select("*, states(code, name, slug), users(email, status)")
        .eq("id", client_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")

    return {"client": res.data}


def _get_client_or_404(supabase, client_id):
    res = (
        supabase.table("clients")
        .select("id, state_id, first_name, last_name")
        .eq("id", client_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")
    return res.data


def _fetch_care_plan_with_activities(supabase, client_id):
    plan_res = (
        supabase.table("care_plans")
        .select("*")
        .eq("client_id", client_id)
        .single()
        .execute()
    )
    plan = plan_res.data
    if not plan:
        return {"care_plan": None}

    activities_res = (
        supabase.table("care_plan_activities")
        .select("*")
        .eq("care_plan_id", plan["id"])
        .order("sort_order")
        .execute()
    )
    return {"care_plan": {**plan, "activities": activities_res.data or []}}


@router.get("/clients/{client_id}/care-plan")
def get_client_care_plan(
    client_id: str,
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()
    _get_client_or_404(supabase, client_id)
    return _fetch_care_plan_with_activities(supabase, client_id)


@router.put("/clients/{client_id}/care-plan")
def update_client_care_plan(
    client_id: str,
    payload: CarePlanUpdateRequest,
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]
    client = _get_client_or_404(supabase, client_id)

    existing = (
        supabase.table("care_plans")
        .select("id")
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
        supabase.table("care_plans").update(update_fields).eq("client_id", client_id).execute()
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
        # Full replacement of the activity list (mirrors admin "edit plan" semantics).
        supabase.table("care_plan_activities").delete().eq("care_plan_id", plan_id).execute()
        for i, act in enumerate(payload.activities):
            supabase.table("care_plan_activities").insert({
                "care_plan_id": plan_id,
                "task": act.task,
                "frequency": act.frequency,
                "notes": act.notes,
                "sort_order": act.sort_order if act.sort_order is not None else i,
            }).execute()

    return _fetch_care_plan_with_activities(supabase, client_id)


@router.get("/clients/{client_id}/schedule")
def get_client_schedule(
    client_id: str,
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()
    _get_client_or_404(supabase, client_id)

    res = (
        supabase.table("care_schedules")
        .select("*")
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
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()
    client = _get_client_or_404(supabase, client_id)

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

    return {"message": "Schedule entry added", "entry": inserted.data[0]}


@router.delete("/clients/{client_id}/schedule/{schedule_id}")
def delete_client_schedule(
    client_id: str,
    schedule_id: str,
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()
    _get_client_or_404(supabase, client_id)

    deleted = (
        supabase.table("care_schedules")
        .delete()
        .eq("id", schedule_id)
        .eq("client_id", client_id)
        .execute()
    )
    if not deleted.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule entry not found for this client.",
        )

    return {"message": "Schedule entry removed"}


@router.get("/authorizations")
def list_admin_authorizations(
    params: PaginationParams = Depends(),
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()

    result = paginate(
        supabase.table("authorizations").select(
            "*, clients(first_name, last_name, medicaid_number), states(code, name)", count="exact"
        ).order("created_at", desc=True),
        params,
    )
    return {"authorizations": result.pop("items"), **result}


@router.post("/authorizations")
def create_authorization(
    payload: AuthorizationCreateRequest,
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    auth_data = {
        "client_id": payload.client_id,
        "state_id": payload.state_id,
        "authorization_number": payload.authorization_number.strip(),
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "status": "active",
        "notes": payload.notes,
    }

    res = supabase.table("authorizations").insert(auth_data).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create authorization.",
        )

    new_auth = res.data[0]

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="authorization_created",
        table_name="authorizations",
        record_id=new_auth["id"],
        new_values=auth_data,
    )

    notify(
        supabase,
        payload.client_id,
        "authorization_approved",
        "Medicaid Authorization Approved",
        f"Authorization #{payload.authorization_number} has been approved from {payload.start_date} to {payload.end_date}.",
    )

    return {"message": "Authorization created successfully", "authorization": new_auth}


@router.post("/authorizations/{authorization_id}/review")
def review_authorization(
    authorization_id: str,
    payload: AuthorizationReviewRequest,
    user: dict = Depends(require_admin),
):
    """Admin review of a client-submitted (pending) authorization."""
    supabase = get_supabase()
    admin_id = user["sub"]

    existing = (
        supabase.table("authorizations")
        .select("*")
        .eq("id", authorization_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Authorization not found.")

    auth = existing.data
    if auth.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot review an authorization with status '{auth.get('status')}'.",
        )

    new_status = "active" if payload.status == "approved" else "rejected"
    now_iso = datetime.now(timezone.utc).isoformat()

    update_payload = {
        "status": new_status,
        "reviewed_at": now_iso,
        "reviewed_by": admin_id,
    }
    if payload.notes:
        update_payload["notes"] = payload.notes

    res = (
        supabase.table("authorizations")
        .update(update_payload)
        .eq("id", authorization_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update authorization.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action=f"authorization_{new_status}",
        table_name="authorizations",
        record_id=authorization_id,
        old_values=auth,
        new_values=update_payload,
    )

    # Mirror the decision onto the linked uploaded document.
    if auth.get("document_id"):
        doc_status = "approved" if new_status == "active" else "rejected"
        supabase.table("documents").update({
            "status": doc_status,
            "reviewed_at": now_iso,
            "reviewed_by": admin_id,
        }).eq("id", auth["document_id"]).execute()

    if new_status == "active":
        notify(
            supabase,
            auth["client_id"],
            "authorization_approved",
            "Authorization Approved",
            f"Authorization #{auth.get('authorization_number')} has been approved for your services.",
        )
    else:
        reason = payload.notes or "Please contact your care coordinator."
        notify(
            supabase,
            auth["client_id"],
            "authorization_rejected",
            "Authorization Update",
            f"Your authorization was not approved. Reason: {reason}",
        )

    return {"message": "Authorization reviewed successfully", "authorization": res.data[0]}


@router.get("/audit-logs")
def list_audit_logs(
    params: PaginationParams = Depends(),
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()

    result = paginate(
        supabase.table("audit_logs").select("*, users(email)", count="exact").order(
            "created_at", desc=True
        ),
        params,
    )
    return {"audit_logs": result.pop("items"), **result}


@router.get("/announcements")
def list_announcements(
    params: PaginationParams = Depends(),
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()

    result = paginate(
        supabase.table("announcements").select("*, users(email), states(code)", count="exact").order(
            "created_at", desc=True
        ),
        params,
    )
    return {"announcements": result.pop("items"), **result}


@router.post("/announcements")
def create_announcement(
    payload: AnnouncementCreateRequest,
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    ann_data = {
        "title": payload.title.strip(),
        "body": payload.body.strip(),
        "audience": payload.audience,
        "state_id": payload.state_id,
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
    )

    return {"message": "Announcement created successfully", "announcement": new_ann}


@router.patch("/announcements/{announcement_id}")
def update_announcement(
    announcement_id: str,
    payload: AnnouncementUpdateRequest,
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    res = (
        supabase.table("announcements")
        .update(updates)
        .eq("id", announcement_id)
        .execute()
    )
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
    )

    return {"message": "Announcement updated successfully", "announcement": res.data[0]}


@router.delete("/announcements/{announcement_id}")
def delete_announcement(
    announcement_id: str,
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    existing = supabase.table("announcements").select("*").eq("id", announcement_id).single().execute()
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found.",
        )

    supabase.table("announcements").delete().eq("id", announcement_id).execute()

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="announcement_deleted",
        table_name="announcements",
        record_id=announcement_id,
        old_values=existing.data,
    )

    return {"message": "Announcement deleted successfully"}


@router.get("/referrals")
def list_referrals(
    status: Optional[str] = Query(None, pattern="^(new|contacted|converted|closed)$"),
    state_id: Optional[int] = Query(None, ge=1),
    params: PaginationParams = Depends(),
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()

    query = supabase.table("client_referrals").select(
        "*, states(code, name)", count="exact"
    ).order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    if state_id:
        query = query.eq("state_id", state_id)

    result = paginate(query, params)
    return {"referrals": result.pop("items"), **result}


@router.patch("/referrals/{referral_id}")
def update_referral_status(
    referral_id: str,
    payload: ReferralStatusUpdate,
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    existing = supabase.table("client_referrals").select("*").eq("id", referral_id).single().execute()
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Referral not found.",
        )
    old_status = existing.data.get("status")

    res = (
        supabase.table("client_referrals")
        .update({"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", referral_id)
        .execute()
    )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="referral_status_changed",
        table_name="client_referrals",
        record_id=referral_id,
        old_values={"status": old_status},
        new_values={"status": payload.status},
    )

    return {"message": "Referral status updated.", "referral": res.data[0]}


def _parse_iso_date(value):
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


@router.get("/reports")
def generate_reports(user: dict = Depends(require_admin)):
    """Aggregate snapshot across all SOW reports in one response.

    Reports: caregiver compliance, expiring credentials, in-service
    completion, client authorizations, referral sources, website inquiries.
    Computed Python-side (no relational joins) so it works against the fake
    in-memory Supabase used by tests.
    """
    supabase = get_supabase()
    today = date.today()
    soon_through = today + timedelta(days=30)

    def _fetch_all(table, cols="*"):
        return (supabase.table(table).select(cols).execute().data) or []

    states = {s["id"]: s for s in _fetch_all("states")}
    users = {u["id"]: u for u in _fetch_all("users", "id, email, status")}
    doc_types = {d["id"]: d for d in _fetch_all("document_types")}
    caregivers = _fetch_all("caregivers")
    clients = {c["id"]: c for c in _fetch_all("clients")}
    requirements = _fetch_all("document_requirements")
    docs = _fetch_all("documents")
    authorizations = _fetch_all("authorizations")
    courses = {c["id"]: c for c in _fetch_all("training_courses")}
    enrollments = _fetch_all("training_enrollments")
    referrals = _fetch_all("client_referrals")

    def state_code(sid):
        return states.get(sid, {}).get("code") or "—"

    # ---- 1 & 2: caregiver compliance + expiring credentials ----
    req_by_state = {}
    for r in requirements:
        req_by_state.setdefault(r.get("state_id"), []).append(r)

    compliance_rows = []
    cred_rows = []
    for cg in caregivers:
        cg_id = cg.get("id")
        cg_state = cg.get("state_id")
        user = users.get(cg_id, {})
        name = f"{cg.get('first_name', '')} {cg.get('last_name', '')}".strip() or "Caregiver"
        required = [r for r in req_by_state.get(cg_state, []) if r.get("required")]
        cg_docs = [d for d in docs if d.get("owner_id") == cg_id]
        uploaded_ids = {d.get("document_type_id") for d in cg_docs}

        missing = []
        for r in required:
            tid = r.get("document_type_id")
            if tid not in uploaded_ids:
                missing.append({
                    "document_type_id": tid,
                    "name": doc_types.get(tid, {}).get("name", "Required document"),
                })

        expired = []
        expiring_soon = []
        valid = []
        for d in cg_docs:
            did = d.get("document_type_id")
            dname = doc_types.get(did, {}).get("name", "Document")
            base = {"name": dname, "status": d.get("status"), "expiration_date": d.get("expiration_date")}
            if d.get("status") == "expired":
                expired.append(base)
                continue
            exp = _parse_iso_date(d.get("expiration_date"))
            if exp is None or exp > soon_through:
                valid.append(base)
            elif exp < today:
                expired.append(base)
            else:
                expiring_soon.append(base)

            exp = _parse_iso_date(d.get("expiration_date"))
            if exp is not None:
                days = (exp - today).days
                if days < 0 or 0 <= days <= 30:
                    cred_rows.append({
                        "caregiver_id": cg_id,
                        "caregiver_name": name,
                        "state_code": state_code(cg_state),
                        "document_name": dname,
                        "expiration_date": d.get("expiration_date"),
                        "days_remaining": days,
                        "status": "expired" if days < 0 else "expiring_soon",
                    })

        compliance_rows.append({
            "caregiver_id": cg_id,
            "name": name,
            "email": user.get("email"),
            "state_code": state_code(cg_state),
            "missing": len(missing),
            "expired": len(expired),
            "expiring_soon": len(expiring_soon),
            "valid": len(valid),
            "missing_names": [m["name"] for m in missing][:5],
            "compliant": len(missing) == 0 and len(expired) == 0,
        })

    cred_rows.sort(key=lambda r: r["expiration_date"] or "9999")
    compliance_rows.sort(key=lambda r: r["name"].lower())

    # ---- 3: in-service (training) completion ----
    course_stats = []
    for c in courses.values():
        enr = [e for e in enrollments if e.get("course_id") == c.get("id")]
        completed = [e for e in enr if e.get("status") == "completed"]
        enrolled = len(enr)
        course_stats.append({
            "course_id": c.get("id"),
            "name": c.get("name"),
            "state_code": state_code(c.get("state_id")),
            "enrolled": enrolled,
            "completed": len(completed),
            "completion_pct": round(len(completed) / enrolled * 100) if enrolled else 0,
        })
    course_stats.sort(key=lambda c: c["name"].lower())

    # ---- 4: client authorizations ----
    auth_rows = []
    for a in authorizations:
        cl = clients.get(a.get("client_id"), {})
        end = _parse_iso_date(a.get("end_date"))
        auth_rows.append({
            "authorization_number": a.get("authorization_number"),
            "client_name": f"{cl.get('first_name', '')} {cl.get('last_name', '')}".strip() or "Client",
            "state_code": state_code(a.get("state_id")),
            "start_date": a.get("start_date"),
            "end_date": a.get("end_date"),
            "status": a.get("status"),
            "days_left": None if end is None else (end - today).days,
        })
    auth_rows.sort(key=lambda a: a["end_date"] or "9999")
    auth_summary = {s: 0 for s in ("active", "expiring_soon", "expired", "pending", "rejected")}
    for a in auth_rows:
        auth_summary[a["status"]] = auth_summary.get(a["status"], 0) + 1

    # ---- 5: referral sources ----
    source_rows = {}
    for r in referrals:
        src = r.get("referral_source") or "Website Inquiry"
        item = source_rows.setdefault(src, {"source": src, "count": 0, "states": {}})
        item["count"] += 1
        code = state_code(r.get("state_id"))
        item["states"][code] = item["states"].get(code, 0) + 1
    source_list = sorted(source_rows.values(), key=lambda s: s["count"], reverse=True)
    for s in source_list:
        s["states"] = [{"code": code, "count": cnt} for code, cnt in sorted(s["states"].items())]

    # ---- 6: website inquiries ----
    inquiries = [r for r in referrals if (r.get("referral_source") or "Website Inquiry") == "Website Inquiry"]
    by_state = {}
    for r in inquiries:
        code = state_code(r.get("state_id"))
        by_state[code] = by_state.get(code, 0) + 1
    recent = sorted(inquiries, key=lambda r: r.get("created_at") or "", reverse=True)[:50]
    recent = [
        {
            "id": r.get("id"),
            "first_name": r.get("first_name"),
            "last_name": r.get("last_name"),
            "state_code": state_code(r.get("state_id")),
            "phone": r.get("phone"),
            "email": r.get("email"),
            "status": r.get("status"),
            "created_at": r.get("created_at"),
        }
        for r in recent
    ]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "caregiver_compliance": {
            "total": len(compliance_rows),
            "compliant": sum(1 for c in compliance_rows if c["compliant"]),
            "rows": compliance_rows,
        },
        "expiring_credentials": {
            "total": len(cred_rows),
            "rows": cred_rows,
        },
        "training_completion": {
            "total_courses": len(course_stats),
            "rows": course_stats,
        },
        "client_authorizations": {
            "summary": auth_summary,
            "rows": auth_rows,
        },
        "referral_sources": {
            "total": sum(s["count"] for s in source_list),
            "rows": source_list,
        },
        "website_inquiries": {
            "total": len(inquiries),
            "by_state": [{"code": code, "count": cnt} for code, cnt in sorted(by_state.items())],
            "recent": recent,
        },
    }
