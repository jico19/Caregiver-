from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from datetime import datetime, timezone, date, timedelta
import logging
from typing import Optional, List
from pydantic import BaseModel, Field
from app.core.config import settings
from app.core.dependencies import (
    AdminScope,
    assert_permitted_filter,
    assert_state_allowed,
    require_admin,
    require_admin_scoped,
    require_super_admin,
    scope_query,
)
from app.core.supabase import get_supabase
from app.core.soft_delete import (
    IMMUTABLE_TABLES,
    SOFT_DELETE_TABLES,
    active_only,
    restore_stamp,
    soft_delete_stamp,
    trim_embedded,
)
from app.models.enums import ALLOWED_TRANSITIONS, ALLOWED_CLIENT_TRANSITIONS
from app.utils.notifications import notify
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)

router = APIRouter()


class ApplicationReviewRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected|under_review|onboarding)$")
    notes: Optional[str] = None


class ClientAdmissionRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|active|discharged|rejected)$")
    service_start_date: Optional[str] = None
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None


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
    status: Optional[str] = Field(None, pattern="^(new|contacted|converted|closed)$")
    assigned_to: Optional[str] = None
    handled_notes: Optional[str] = None


class AnnouncementCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1)
    audience: str = Field(..., pattern="^(caregiver|client|all)$")
    state_id: Optional[int] = None
    is_active: bool = True


class CaregiverAssignmentCreateRequest(BaseModel):
    caregiver_id: str
    role: Optional[str] = Field("primary", pattern="^(primary|backup|relief)$")


class AnnouncementUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    body: Optional[str] = Field(None, min_length=1)
    audience: Optional[str] = Field(None, pattern="^(caregiver|client|all)$")
    state_id: Optional[int] = None
    is_active: Optional[bool] = None


def _sanitize_audit_values(values: Optional[dict]) -> Optional[dict]:
    if not values or not isinstance(values, dict):
        return values
    cleaned = {}
    for k, v in values.items():
        if k == "signature_data":
            continue
        if isinstance(v, str) and len(v) > 2000:
            continue
        cleaned[k] = v
    return cleaned


def record_audit_log(
    supabase,
    user_id: Optional[str],
    action: str,
    table_name: str,
    record_id: str,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    request: Optional[Request] = None,
    required: bool = False,
    entity_state_id: Optional[int] = None,
):
    ip_address = None
    user_agent = None
    request_id = None

    if request is not None:
        user_agent = request.headers.get("user-agent")
        request_id = getattr(request.state, "request_id", None)
        if settings.TRUST_FORWARDED_FOR and request.headers.get("x-forwarded-for"):
            ip_address = request.headers.get("x-forwarded-for").split(",")[0].strip()
        elif request.client:
            ip_address = request.client.host

    payload = {
        "user_id": user_id,
        "action": action,
        "table_name": table_name,
        "record_id": str(record_id),
        "old_values": _sanitize_audit_values(old_values),
        "new_values": _sanitize_audit_values(new_values),
        "ip_address": ip_address,
        "user_agent": user_agent,
        "request_id": request_id,
        "entity_state_id": entity_state_id,
    }

    try:
        supabase.table("audit_logs").insert(payload).execute()
    except Exception as exc:
        logger.warning("audit_logs insert failed (action=%s, record=%s): %s", action, record_id, exc)
        if required:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Audit logging failed for critical signature operation.",
            )


@router.get("/dashboard")
def get_dashboard(
    state: Optional[str] = Query(None, description="florida, indiana, georgia, or all"),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    # Base counts, always constrained to the caller's permitted states. These
    # use count="exact", so a missing soft-delete filter shows up directly as an
    # inflated metric rather than as an extra row.
    caregivers_q = scope_query(
        active_only(
            supabase.table("caregivers").select("id", count="exact"),
            "caregivers",
        ),
        scope,
    )
    clients_q = scope_query(
        active_only(
            supabase.table("clients").select("id", count="exact"),
            "clients",
        ),
        scope,
    )
    apps_pending_q = scope_query(
        active_only(
            supabase.table("caregiver_applications")
            .select("id", count="exact")
            .in_("status", ["submitted", "under_review"]),
            "caregiver_applications",
        ),
        scope,
    )
    docs_pending_q = scope_query(
        active_only(
            supabase.table("documents")
            .select("id", count="exact")
            .eq("status", "pending_review"),
            "documents",
        ),
        scope,
    )

    if state and state != "all":
        state_row = supabase.table("states").select("id").eq("slug", state).single().execute()
        if state_row.data:
            # Narrows only. A state the caller may not see is rejected, not ignored.
            s_id = assert_permitted_filter(scope, state_row.data["id"])
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
        .select("*")
        .eq("id", application_id)
        .execute()
    )

    if existing.data:
        old_app = existing.data[0]
    else:
        cg_res = (
            supabase.table("caregivers")
            .select("*")
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
        old_values=old_app,
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


@router.get("/documents")
def list_admin_documents(
    status_filter: Optional[str] = Query(None, alias="status"),
    params: PaginationParams = Depends(),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    query = active_only(
        supabase.table("documents").select(
            "*, document_types(name, for_role, requires_expiration), users:users!documents_owner_id_fkey(email, role_id, deleted_at), states(code, name)",
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
        active_only(supabase.table("documents").select("*"), "documents")
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
    status_filter: Optional[str] = Query(None, alias="status"),
    sort_by: Optional[str] = Query(None, alias="sort_by"),
    params: PaginationParams = Depends(),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    query = scope_query(
        active_only(
            supabase.table("clients").select(
                "id, state_id, first_name, last_name, date_of_birth, phone, address, medicaid_number, status, service_start_date, admission_notes, rejection_reason, admitted_by, admitted_at, created_at, updated_at, legal_hold, states(code, name, slug), users:users!clients_id_fkey(email, status, deleted_at)",
                count="exact",
            ),
            "clients",
        ),
        scope,
    )
    if status_filter:
        query = query.eq("status", status_filter)

    if sort_by == "service_start_date":
        query = query.order("service_start_date", desc=False)
    else:
        query = query.order("created_at", desc=True)

    result = paginate(query, params)
    trim_embedded(result["items"], "users")
    return {"clients": result.pop("items"), **result}


@router.post("/clients/{client_id}/admission")
def update_client_admission(
    client_id: str,
    payload: ClientAdmissionRequest,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    existing = (
        active_only(
            supabase.table("clients").select("id, state_id, first_name, last_name, status, service_start_date, admission_notes, rejection_reason, legal_hold"),
            "clients",
        )
        .eq("id", client_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")

    old_client = existing.data
    assert_state_allowed(scope, old_client.get("state_id"))

    old_status = old_client.get("status", "pending")
    allowed_next = ALLOWED_CLIENT_TRANSITIONS.get(old_status, set())
    if payload.status not in allowed_next:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot transition client status from '{old_status}' to '{payload.status}'.",
        )

    reason = (payload.rejection_reason or payload.notes or "").strip()
    if payload.status == "rejected" and not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A rejection reason is required when rejecting a client admission.",
        )

    if payload.service_start_date:
        try:
            date.fromisoformat(payload.service_start_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid service_start_date format. Expected YYYY-MM-DD.",
            )

    now_iso = datetime.now(timezone.utc).isoformat()
    update_payload = {
        "status": payload.status,
    }
    if payload.status in ("approved", "active"):
        update_payload["admitted_by"] = admin_id
        update_payload["admitted_at"] = now_iso

    if payload.service_start_date is not None:
        update_payload["service_start_date"] = payload.service_start_date

    if payload.notes is not None:
        update_payload["admission_notes"] = payload.notes.strip() if payload.notes else None

    if payload.status == "rejected":
        update_payload["rejection_reason"] = reason

    res = scope_query(
        active_only(
            supabase.table("clients").update(update_payload),
            "clients",
        )
        .eq("id", client_id),
        scope,
    ).execute()

    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update client admission status.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action=f"client_admission_{payload.status}",
        table_name="clients",
        record_id=client_id,
        old_values=old_client,
        new_values=update_payload,
    )

    msg_body = f"Your client admission status is now: {payload.status}."
    if payload.status == "rejected" and reason:
        msg_body += f" Reason: {reason}"
    elif update_payload.get("service_start_date"):
        msg_body += f" Confirmed start date: {update_payload['service_start_date']}."

    notify(
        supabase,
        client_id,
        f"client_admission_{payload.status}",
        "Client Admission Update",
        msg_body,
    )

    return {"message": "Client admission status updated successfully", "client": res.data[0]}



@router.get("/clients/{client_id}")
def get_admin_client(
    client_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    res = (
        active_only(
            supabase.table("clients").select(
                "id, state_id, first_name, last_name, date_of_birth, phone, address, medicaid_number, status, service_start_date, admission_notes, rejection_reason, admitted_by, admitted_at, created_at, updated_at, legal_hold, states(code, name, slug), users:users!clients_id_fkey(email, status, deleted_at)"
            ),
            "clients",
        )
        .eq("id", client_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")

    trim_embedded([res.data], "users")
    assert_state_allowed(scope, res.data.get("state_id"))
    return {"client": res.data}


def _get_client_or_404(supabase, client_id, scope: AdminScope):
    res = (
        active_only(
            supabase.table("clients").select("id, state_id, first_name, last_name"),
            "clients",
        )
        .eq("id", client_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")
    assert_state_allowed(scope, res.data.get("state_id"))
    return res.data


def _fetch_care_plan_with_activities(supabase, client_id):
    plan_res = (
        active_only(supabase.table("care_plans").select("*"), "care_plans")
        .eq("client_id", client_id)
        .single()
        .execute()
    )
    plan = plan_res.data
    if not plan:
        return {"care_plan": None}

    activities_res = (
        active_only(
            supabase.table("care_plan_activities").select("*"),
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
    _get_client_or_404(supabase, client_id, scope)
    return _fetch_care_plan_with_activities(supabase, client_id)


@router.put("/clients/{client_id}/care-plan")
def update_client_care_plan(
    client_id: str,
    payload: CarePlanUpdateRequest,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id
    client = _get_client_or_404(supabase, client_id, scope)

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
        # Full replacement of the activity list (mirrors admin "edit plan"
        # semantics). The outgoing activities are soft-deleted, never removed,
        # so the previous plan version stays recoverable in the record. The
        # re-read above filters deleted rows, so only the new set is returned.
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

    return _fetch_care_plan_with_activities(supabase, client_id)


@router.get("/clients/{client_id}/schedule")
def get_client_schedule(
    client_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    _get_client_or_404(supabase, client_id, scope)

    res = (
        active_only(
            supabase.table("care_schedules").select("*"),
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
    client = _get_client_or_404(supabase, client_id, scope)

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
    _get_client_or_404(supabase, client_id, scope)

    # Soft delete: the row is stamped and filtered out of every read path
    # rather than removed, so the visit history stays intact and auditable.
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


@router.get("/authorizations")
def list_admin_authorizations(
    params: PaginationParams = Depends(),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    result = paginate(
        scope_query(
            active_only(
                supabase.table("authorizations").select(
                    "*, clients:clients!authorizations_client_id_fkey(first_name, last_name, medicaid_number, deleted_at), states(code, name)",
                    count="exact",
                ),
                "authorizations",
            ),
            scope,
        ).order("created_at", desc=True),
        params,
    )
    trim_embedded(result["items"], "clients")
    return {"authorizations": result.pop("items"), **result}


@router.post("/authorizations")
def create_authorization(
    payload: AuthorizationCreateRequest,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    # The authorization belongs to a client, so the client's own state is the
    # authoritative one. A client-supplied state_id must never widen access.
    client = _get_client_or_404(supabase, payload.client_id, scope)
    client_state = client["state_id"]
    if payload.state_id != client_state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"state_id {payload.state_id} does not match the client's state ({client_state}).",
        )

    auth_data = {
        "client_id": payload.client_id,
        "state_id": client_state,
        "authorization_number": payload.authorization_number.strip(),
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "status": "active",
        "notes": payload.notes,
    }

    # state_id is taken from the client row (already state-checked above), and
    # insert() builders are not filterable, so the value is safe to persist.
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
    scope: AdminScope = Depends(require_admin_scoped),
):
    """Admin review of a client-submitted (pending) authorization."""
    supabase = get_supabase()
    admin_id = scope.user_id

    existing = (
        active_only(
            supabase.table("authorizations").select("*"),
            "authorizations",
        )
        .eq("id", authorization_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Authorization not found.")

    auth = existing.data
    assert_state_allowed(scope, auth.get("state_id"))
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

    res = scope_query(
        active_only(
            supabase.table("authorizations").update(update_payload),
            "authorizations",
        )
        .eq("id", authorization_id),
        scope,
    ).execute()
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

    # Mirror the decision onto the linked uploaded document. The document is a
    # separate record and may carry a different state, so it is checked too.
    if auth.get("document_id"):
        doc_status = "approved" if new_status == "active" else "rejected"
        scope_query(
            active_only(
                supabase.table("documents").update({
                    "status": doc_status,
                    "reviewed_at": now_iso,
                    "reviewed_by": admin_id,
                }),
                "documents",
            ).eq("id", auth["document_id"]),
            scope,
        ).execute()

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
    scope: AdminScope = Depends(require_admin_scoped),
):
    """State-scoped audit trail for state administrators, global for super_admin."""
    supabase = get_supabase()
    query = supabase.table("audit_logs").select("*, users(email, state_id)", count="exact").order("created_at", desc=True)

    if not scope.is_super:
        query = query.in_("entity_state_id", scope.states)

    result = paginate(query, params)
    items = result.pop("items")
    if not scope.is_super:
        for item in items:
            user_data = item.get("users")
            if user_data and user_data.get("state_id") and user_data.get("state_id") not in scope.states:
                item["users"] = None

    return {"audit_logs": items, **result}


@router.get("/announcements")
def list_announcements(
    params: PaginationParams = Depends(),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    # A scoped admin sees announcements targeted at its own state. Global
    # announcements (state_id IS NULL) are visible to super admins only,
    # matching the fail-closed rule used for documents.
    result = paginate(
        scope_query(
            active_only(
                supabase.table("announcements").select(
                    "*, users:users!announcements_created_by_fkey(email, deleted_at), states(code)",
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
        # Only an unrestricted caller may publish a company-wide announcement.
        ann_state = payload.state_id
    else:
        # A scoped admin is pinned to its own state; it can neither target
        # another state nor publish globally.
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
            supabase.table("announcements").select("*"),
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
        # A scoped admin cannot retarget an announcement to another state or
        # make it global by sending an explicit null.
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
            supabase.table("announcements").select("*"),
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

    # Soft delete. The row is stamped rather than removed, so an announcement
    # that was published and later withdrawn stays in the audit trail.
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
        old_values=existing.data,
    )

    return {"message": "Announcement deleted successfully"}


def _get_or_create_client_user(supabase, email: str, state_id: int) -> str:
    clean_email = email.strip().lower()
    existing_user = (
        active_only(
            supabase.table("users").select("id, role_id"),
            "users",
        )
        .eq("email", clean_email)
        .execute()
    )
    if existing_user.data:
        return existing_user.data[0]["id"]

    role_res = (
        supabase.table("roles")
        .select("id")
        .eq("name", "client")
        .execute()
    )
    role_id = role_res.data[0]["id"] if role_res.data else 3

    import uuid
    new_id = str(uuid.uuid4())
    user_payload = {
        "id": new_id,
        "email": clean_email,
        "role_id": role_id,
        "state_id": state_id,
        "status": "active",
    }
    supabase.table("users").insert(user_payload).execute()
    return new_id


@router.get("/referrals")
def list_referrals(
    status: Optional[str] = Query(None, pattern="^(new|contacted|converted|closed)$"),
    state_id: Optional[int] = Query(None, ge=1),
    unassigned: Optional[bool] = Query(None),
    params: PaginationParams = Depends(),
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()

    query = scope_query(
        active_only(
            supabase.table("client_referrals").select("*, states(code, name)", count="exact"),
            "client_referrals",
        ),
        scope,
    ).order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    if state_id:
        # Narrows only; a state the caller may not see is rejected.
        query = query.eq("state_id", assert_permitted_filter(scope, state_id))
    if unassigned is True:
        query = query.is_("assigned_to", None)

    result = paginate(query, params)
    return {"referrals": result.pop("items"), **result}


@router.patch("/referrals/{referral_id}")
def update_referral_status(
    referral_id: str,
    payload: ReferralStatusUpdate,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    existing = (
        active_only(
            supabase.table("client_referrals").select("*"),
            "client_referrals",
        )
        .eq("id", referral_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Referral not found.",
        )

    referral = existing.data
    assert_state_allowed(scope, referral.get("state_id"))

    old_status = referral.get("status")

    updates = {}
    if payload.status is not None:
        updates["status"] = payload.status
    if payload.assigned_to is not None:
        updates["assigned_to"] = payload.assigned_to.strip() if payload.assigned_to else None
    if payload.handled_notes is not None:
        updates["handled_notes"] = payload.handled_notes.strip() if payload.handled_notes else None

    converted_client_id = None
    if payload.status == "converted":
        if referral.get("converted_client_id"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Referral has already been converted to a client.",
            )

        ref_email = (referral.get("email") or f"client-{referral_id[:8]}@example.com").strip()
        client_user_id = _get_or_create_client_user(supabase, ref_email, referral["state_id"])

        client_payload = {
            "id": client_user_id,
            "state_id": referral["state_id"],
            "first_name": referral.get("first_name", "Prospective"),
            "last_name": referral.get("last_name", "Client"),
            "phone": referral.get("phone"),
            "address": referral.get("notes") or referral.get("address"),
            "status": "pending",
        }
        supabase.table("clients").upsert(client_payload).execute()

        converted_client_id = client_user_id
        updates["converted_client_id"] = converted_client_id
        updates["status"] = "converted"

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    res = scope_query(
        active_only(
            supabase.table("client_referrals").update(updates),
            "client_referrals",
        )
        .eq("id", referral_id),
        scope,
    ).execute()

    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update referral.",
        )

    action_name = "referral_converted" if payload.status == "converted" else ("referral_status_changed" if payload.status else "referral_updated")
    is_simple_status_change = bool(payload.status and len(updates) == 2 and "updated_at" in updates)
    old_audit = {"status": old_status} if is_simple_status_change else referral
    new_audit = {"status": payload.status} if is_simple_status_change else updates

    record_audit_log(
        supabase,
        user_id=admin_id,
        action=action_name,
        table_name="client_referrals",
        record_id=referral_id,
        old_values=old_audit,
        new_values=new_audit,
    )




    if payload.status == "converted":
        notify(
            supabase,
            admin_id,
            "referral_converted",
            "Referral Converted",
            f"Referral for {referral.get('first_name')} {referral.get('last_name')} converted to client (pending admission).",
        )

    response_data = {"message": "Referral updated successfully", "referral": res.data[0]}
    if converted_client_id:
        response_data["client_id"] = converted_client_id

    return response_data



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
def generate_reports(scope: AdminScope = Depends(require_admin_scoped)):
    """Aggregate snapshot across all SOW reports in one response.

    Reports: caregiver compliance, expiring credentials, in-service
    completion, client authorizations, referral sources, website inquiries.
    Computed Python-side (no relational joins) so it works against the fake
    in-memory Supabase used by tests.

    Every state-scoped table is filtered in the query via scope_query, so a
    scoped admin never receives another state's rows in the first place.
    """
    supabase = get_supabase()
    today = date.today()
    soon_through = today + timedelta(days=30)

    def _fetch_all(table, cols="*", state_scoped=True):
        # `table` is a parameter here, so the soft-delete filter cannot be
        # written at the call site. Reference tables (states, document_types,
        # training_courses, document_requirements) are not soft-deletable and
        # are passed through unfiltered.
        query = supabase.table(table).select(cols)
        if table in SOFT_DELETE_TABLES:
            query = active_only(query, table)
        if state_scoped:
            query = scope_query(query, scope)
        return (query.execute().data) or []

    # states / document_types / training_courses are global lookups:
    # a course with state_id IS NULL is company-wide, so filtering courses
    # would hide it from a scoped admin. users is a caregiver-keyed email
    # lookup over caregivers that are already state-filtered.
    states = {s["id"]: s for s in _fetch_all("states", state_scoped=False)}
    users = {u["id"]: u for u in _fetch_all("users", "id, email, status", state_scoped=False)}
    doc_types = {d["id"]: d for d in _fetch_all("document_types", state_scoped=False)}
    caregivers = _fetch_all("caregivers")
    clients = {c["id"]: c for c in _fetch_all("clients")}
    requirements = _fetch_all("document_requirements")
    docs = _fetch_all("documents")
    authorizations = _fetch_all("authorizations")
    courses = {c["id"]: c for c in _fetch_all("training_courses", state_scoped=False)}

    # training_enrollments has no state_id, so it is scoped through the
    # caregiver set. An unrestricted caller already sees every enrollment.
    enrollments = _fetch_all("training_enrollments", state_scoped=False)
    if scope.states is not None:
        allowed_caregiver_ids = {c.get("id") for c in caregivers}
        enrollments = [e for e in enrollments if e.get("caregiver_id") in allowed_caregiver_ids]
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
        .select("*")
        .eq("id", id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} not found.",
        )

    # Note: restore is non-cascading. Restoring a client does not restore its
    # care plans or schedules; each must be restored deliberately.
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


@router.get("/notifications")
def get_admin_notifications(user: dict = Depends(require_admin)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        active_only(supabase.table("notifications").select("*"), "notifications")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    return {"notifications": res.data or []}


@router.patch("/notifications/{notification_id}/read")
def mark_admin_notification_read(notification_id: str, user: dict = Depends(require_admin)):
    supabase = get_supabase()
    user_id = user.get("sub")

    (
        active_only(
            supabase.table("notifications").update({"read": True}),
            "notifications",
        )
        .eq("id", notification_id)
        .eq("user_id", user_id)
        .execute()
    )

    return {"message": "Notification marked as read"}


@router.patch("/notifications/read-all")
def mark_all_admin_notifications_read(user: dict = Depends(require_admin)):
    supabase = get_supabase()
    user_id = user.get("sub")

    (
        active_only(
            supabase.table("notifications").update({"read": True}),
            "notifications",
        )
        .eq("user_id", user_id)
        .eq("read", False)
        .execute()
    )

    return {"message": "All notifications marked as read"}


class AdminAssignTrainingRequest(BaseModel):
    caregiver_id: str
    course_id: str
    due_at: Optional[str] = None


class UpdateDocumentRequirementRequest(BaseModel):
    requirement_id: str
    required: bool
    reason: Optional[str] = None


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
            "*, training_courses(*), caregivers!inner(first_name, last_name, phone, state_id, deleted_at)",
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
                "*, training_courses(*), caregivers(first_name, last_name, phone, state_id, deleted_at)"
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

    # Verify caregiver exists and state permitted
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

    # Verify course exists
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

    # Check existing active enrollment
    existing = (
        active_only(
            supabase.table("training_enrollments").select("*"),
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

    return {
        "message": "Training course assigned successfully",
        "enrollment": record,
    }


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
        "*, document_types(id, code, name, description, for_role, requires_expiration), states(id, code, name)"
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
        .select("*")
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


class LegalHoldRequest(BaseModel):
    legal_hold: bool
    reason: Optional[str] = None


@router.patch("/clients/{client_id}/legal-hold")
def toggle_client_legal_hold(
    client_id: str,
    payload: LegalHoldRequest,
    request: Request,
    user: dict = Depends(require_super_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    existing = (
        supabase.table("clients")
        .select("*")
        .eq("id", client_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found.",
        )

    old_row = existing.data[0]
    old_hold = old_row.get("legal_hold", False)

    res = (
        supabase.table("clients")
        .update({"legal_hold": payload.legal_hold})
        .eq("id", client_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update client legal hold.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="legal_hold_toggled",
        table_name="clients",
        record_id=client_id,
        old_values={"legal_hold": old_hold},
        new_values={"legal_hold": payload.legal_hold, "reason": payload.reason},
        request=request,
        entity_state_id=old_row.get("state_id"),
    )

    return {"message": "Client legal hold updated", "client": res.data[0]}


@router.patch("/caregivers/{caregiver_id}/legal-hold")
def toggle_caregiver_legal_hold(
    caregiver_id: str,
    payload: LegalHoldRequest,
    request: Request,
    user: dict = Depends(require_super_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    existing = (
        supabase.table("caregivers")
        .select("*")
        .eq("id", caregiver_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caregiver not found.",
        )

    old_row = existing.data[0]
    old_hold = old_row.get("legal_hold", False)

    res = (
        supabase.table("caregivers")
        .update({"legal_hold": payload.legal_hold})
        .eq("id", caregiver_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update caregiver legal hold.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="legal_hold_toggled",
        table_name="caregivers",
        record_id=caregiver_id,
        old_values={"legal_hold": old_hold},
        new_values={"legal_hold": payload.legal_hold, "reason": payload.reason},
        request=request,
        entity_state_id=old_row.get("state_id"),
    )

    return {"message": "Caregiver legal hold updated", "caregiver": res.data[0]}


@router.patch("/documents/{document_id}/legal-hold")
def toggle_document_legal_hold(
    document_id: str,
    payload: LegalHoldRequest,
    request: Request,
    user: dict = Depends(require_super_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    existing = (
        supabase.table("documents")
        .select("*")
        .eq("id", document_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    old_row = existing.data[0]
    old_hold = old_row.get("legal_hold", False)

    res = (
        supabase.table("documents")
        .update({"legal_hold": payload.legal_hold})
        .eq("id", document_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update document legal hold.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="legal_hold_toggled",
        table_name="documents",
        record_id=document_id,
        old_values={"legal_hold": old_hold},
        new_values={"legal_hold": payload.legal_hold, "reason": payload.reason},
        request=request,
        entity_state_id=old_row.get("state_id"),
    )

    return {"message": "Document legal hold updated", "document": res.data[0]}


@router.post("/clients/{client_id}/erasure-request")
def process_client_erasure_request(
    client_id: str,
    request: Request,
    user: dict = Depends(require_super_admin),
):
    supabase = get_supabase()
    admin_id = user["sub"]

    client_res = (
        supabase.table("clients")
        .select("*, states(code, name)")
        .eq("id", client_id)
        .execute()
    )
    if not client_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client record not found.",
        )

    client_row = client_res.data[0]
    state_code = client_row.get("states", {}).get("code", "FL") if client_row.get("states") else "FL"

    # Evaluate statutory retention rules
    # Florida: 5 yrs, Georgia: 6 yrs, Indiana: 7 yrs
    statutory_years = 7 if state_code == "IN" else (6 if state_code == "GA" else 5)
    deleted_at_str = client_row.get("deleted_at")

    if not deleted_at_str:
        # Active client record cannot be erased via DSAR without prior discharge/deletion
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Erasure request refused: Client is active. Record must be discharged and soft-deleted before statutory erasure evaluation.",
        )

    deleted_at = datetime.fromisoformat(deleted_at_str.replace("Z", "+00:00"))
    cutoff = datetime.now(timezone.utc) - timedelta(days=statutory_years * 365)

    if deleted_at > cutoff:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Erasure request refused: Statutory clinical retention requirement ({statutory_years} years for {state_code}) has not elapsed.",
        )

    if client_row.get("legal_hold"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Erasure request refused: Record is under an active legal hold.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="dsar_erasure_approved",
        table_name="clients",
        record_id=client_id,
        new_values={"statutory_years": statutory_years, "state_code": state_code},
        request=request,
        entity_state_id=client_row.get("state_id"),
    )

    return {
        "message": "Data Subject Erasure Request approved and queued for purge.",
        "statutory_retention_years": statutory_years,
        "eligible": True,
    }


@router.get("/clients/{client_id}/assignments")
def list_client_assignments(
    client_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    _get_client_or_404(supabase, client_id, scope)

    res = (
        supabase.table("caregiver_client_assignments")
        .select("*, caregivers(id, first_name, last_name, phone, ssn_last4)")
        .eq("client_id", client_id)
        .is_("ended_at", None)
        .execute()
    )
    return {"assignments": res.data or []}


@router.post("/clients/{client_id}/assignments")
def assign_caregiver_to_client(
    client_id: str,
    payload: CaregiverAssignmentCreateRequest,
    request: Request,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    client = _get_client_or_404(supabase, client_id, scope)

    cg_res = (
        active_only(supabase.table("caregivers").select("id, state_id, first_name, last_name"), "caregivers")
        .eq("id", payload.caregiver_id)
        .single()
        .execute()
    )
    if not cg_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found.")

    cg = cg_res.data
    assert_state_allowed(scope, cg.get("state_id"))

    now_iso = datetime.now(timezone.utc).isoformat()
    assign_data = {
        "id": f"{payload.caregiver_id}:{client_id}",
        "caregiver_id": payload.caregiver_id,
        "client_id": client_id,
        "role": payload.role or "primary",
        "assigned_by": admin_id,
        "assigned_at": now_iso,
        "ended_at": None,
    }

    res = supabase.table("caregiver_client_assignments").upsert(assign_data).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign caregiver to client.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="caregiver_client_assigned",
        table_name="caregiver_client_assignments",
        record_id=f"{payload.caregiver_id}:{client_id}",
        new_values=assign_data,
        request=request,
        entity_state_id=client.get("state_id"),
    )

    notify(
        supabase,
        payload.caregiver_id,
        "client_assigned",
        "New Client Assignment",
        f"You have been assigned as {payload.role or 'primary'} caregiver for client {client.get('first_name', '')} {client.get('last_name', '')}.",
    )

    return {"message": "Caregiver assigned successfully", "assignment": res.data[0]}


@router.delete("/clients/{client_id}/assignments/{caregiver_id}")
def end_caregiver_assignment(
    client_id: str,
    caregiver_id: str,
    request: Request,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    admin_id = scope.user_id

    client = _get_client_or_404(supabase, client_id, scope)
    now_iso = datetime.now(timezone.utc).isoformat()

    res = (
        supabase.table("caregiver_client_assignments")
        .update({"ended_at": now_iso})
        .eq("client_id", client_id)
        .eq("caregiver_id", caregiver_id)
        .is_("ended_at", None)
        .execute()
    )

    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active caregiver assignment not found.",
        )

    record_audit_log(
        supabase,
        user_id=admin_id,
        action="caregiver_client_assignment_ended",
        table_name="caregiver_client_assignments",
        record_id=f"{caregiver_id}:{client_id}",
        new_values={"ended_at": now_iso},
        request=request,
        entity_state_id=client.get("state_id"),
    )

    return {"message": "Caregiver assignment ended successfully"}


@router.get("/caregivers/{caregiver_id}/assignments")
def list_caregiver_assigned_clients(
    caregiver_id: str,
    scope: AdminScope = Depends(require_admin_scoped),
):
    supabase = get_supabase()
    cg_res = (
        active_only(supabase.table("caregivers").select("id, state_id"), "caregivers")
        .eq("id", caregiver_id)
        .single()
        .execute()
    )
    if not cg_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found.")

    assert_state_allowed(scope, cg_res.data.get("state_id"))

    res = (
        supabase.table("caregiver_client_assignments")
        .select("*, clients(id, first_name, last_name, phone, address, status, states(code, name))")
        .eq("caregiver_id", caregiver_id)
        .is_("ended_at", None)
        .execute()
    )
    return {"assignments": res.data or []}



