from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime, timezone, date
from typing import Optional
from pydantic import BaseModel, Field
from app.core.dependencies import require_admin
from app.core.supabase import get_supabase
from app.models.enums import ALLOWED_TRANSITIONS
from app.utils.notifications import notify

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
    except Exception:
        pass


@router.get("/dashboard")
async def get_dashboard(
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
async def list_caregivers(
    status_filter: Optional[str] = Query(None, alias="status"),
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()

    query = supabase.table("caregiver_applications").select(
        "*, caregivers(first_name, last_name, phone, address, ssn_last4), states(code, name, slug)"
    )
    if status_filter:
        query = query.eq("status", status_filter)

    res = query.order("created_at", desc=True).execute()
    return {"applications": res.data or []}


@router.post("/caregivers/{application_id}/review")
async def review_caregiver_application(
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
async def get_caregiver_application_detail(
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
async def get_caregiver_application_documents(
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
async def list_admin_documents(
    status_filter: Optional[str] = Query(None, alias="status"),
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()

    query = supabase.table("documents").select(
        "*, document_types(name, for_role, requires_expiration), users:users!documents_owner_id_fkey(email, role_id), states(code, name)"
    )
    if status_filter:
        query = query.eq("status", status_filter)

    res = query.order("uploaded_at", desc=True).execute()
    return {"documents": res.data or []}


@router.post("/documents/{document_id}/review")
async def review_document(
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
async def list_admin_clients(user: dict = Depends(require_admin)):
    supabase = get_supabase()

    res = (
        supabase.table("clients")
        .select("*, states(code, name, slug), users(email, status)")
        .order("created_at", desc=True)
        .execute()
    )
    return {"clients": res.data or []}


@router.get("/authorizations")
async def list_admin_authorizations(user: dict = Depends(require_admin)):
    supabase = get_supabase()

    res = (
        supabase.table("authorizations")
        .select("*, clients(first_name, last_name, medicaid_number), states(code, name)")
        .order("created_at", desc=True)
        .execute()
    )
    return {"authorizations": res.data or []}


@router.post("/authorizations")
async def create_authorization(
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


@router.get("/audit-logs")
async def list_audit_logs(user: dict = Depends(require_admin)):
    supabase = get_supabase()

    res = (
        supabase.table("audit_logs")
        .select("*, users(email)")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"audit_logs": res.data or []}


@router.get("/announcements")
async def list_announcements(user: dict = Depends(require_admin)):
    supabase = get_supabase()

    res = (
        supabase.table("announcements")
        .select("*, users(email), states(code)")
        .order("created_at", desc=True)
        .execute()
    )
    return {"announcements": res.data or []}


@router.post("/announcements")
async def create_announcement(
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
async def update_announcement(
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
async def delete_announcement(
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
