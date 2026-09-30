from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi import UploadFile, File, Form
from starlette.concurrency import run_in_threadpool
from datetime import date, datetime, timezone, timedelta
import hashlib
from typing import Optional
from pydantic import BaseModel, Field
from app.core.dependencies import require_client, validate_state_id
from app.core.soft_delete import active_only
from app.core.supabase import get_supabase
from app.schemas.clients import ClientIntakeSubmit, AgreementSignSubmit
from app.utils.notifications import notify
from app.services.document_service import document_service
from app.api.routes.admin import record_audit_log

router = APIRouter()


def _validate_signature(payload):
    """Require a drawn e-signature before intake is submitted or an agreement is signed."""
    sig = (payload.signature_data or "").strip()
    name = (payload.signed_name or "").strip()
    if not sig:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A drawn signature is required.",
        )
    if not sig.startswith("data:image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signature must be a drawn image (data URL).",
        )
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your full name is required to sign.",
        )
    return {
        "signature_data": sig,
        "signed_name": name,
        "signed_at": datetime.now(timezone.utc).isoformat(),
    }


AGREEMENT_TEMPLATES = [
    {
        "agreement_key": "care_agreement",
        "title": "Care Agreement & Authorization for Services",
        "body": "I authorize the agency to provide home care services to the care recipient identified in my intake, including personal care, homemaking, and medication reminders as documented in the plan of care. I understand services are subject to authorization approval and that I may update my records at any time.",
    },
    {
        "agreement_key": "client_rights",
        "title": "Client Rights & Responsibilities",
        "body": "I acknowledge receipt of the program's client rights statement, including dignity and respect, confidentiality of health information, the right to be informed about services, and the right to voice grievances without retaliation.",
    },
]


class ClientProfileUpdate(BaseModel):
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    medicaid_number: Optional[str] = Field(None, max_length=50)


@router.get("/me")
def get_my_profile(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        active_only(
            supabase.table("clients").select(
                "id, state_id, first_name, last_name, date_of_birth, phone, address, medicaid_number, status, service_start_date, admission_notes, rejection_reason, admitted_by, admitted_at, created_at, updated_at, legal_hold, states(name, code, slug)"
            ),
            "clients",
        )
        .eq("id", user_id)
        .execute()
    )

    if not res.data:
        return {"profile": None}

    return {"profile": res.data[0]}


@router.patch("/me/profile")
def update_my_profile(
    payload: ClientProfileUpdate,
    request: Request,
    user: dict = Depends(require_client),
):
    supabase = get_supabase()
    user_id = user.get("sub")

    update_data = {}
    if payload.phone is not None:
        update_data["phone"] = payload.phone.strip() or None
    if payload.address is not None:
        update_data["address"] = payload.address.strip() or None
    if payload.medicaid_number is not None:
        update_data["medicaid_number"] = payload.medicaid_number.strip() or None

    res = (
        active_only(supabase.table("clients").update(update_data), "clients")
        .eq("id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client profile not found.")

    record_audit_log(
        supabase,
        user_id=user_id,
        action="client_profile_updated",
        table_name="clients",
        record_id=str(user_id),
        new_values=update_data,
        request=request,
        entity_state_id=user.get("state_id"),
    )

    return {"message": "Profile updated successfully", "profile": res.data[0]}


@router.post("/intake")
def submit_intake(
    payload: ClientIntakeSubmit,
    request: Request,
    user: dict = Depends(require_client),
):
    supabase = get_supabase()
    user_id = user.get("sub")

    signature = _validate_signature(payload)
    validate_state_id(supabase, payload.state_id)

    client_data = {
        "id": user_id,
        "state_id": payload.state_id,
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "date_of_birth": str(payload.date_of_birth) if payload.date_of_birth else None,
        "phone": payload.phone,
        "address": payload.address,
        "medicaid_number": payload.medicaid_number,
        **signature,
    }

    res = supabase.table("clients").upsert(client_data).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update client profile.",
        )

    supabase.table("users").update({"state_id": payload.state_id}).eq("id", user_id).execute()

    record_audit_log(
        supabase,
        user_id,
        "client_intake_signed",
        "clients",
        user_id,
        new_values={"signed_name": signature["signed_name"], "signed_at": signature["signed_at"]},
        request=request,
        required=True,
        entity_state_id=payload.state_id,
    )

    notify(
        supabase,
        user_id,
        "intake_submitted",
        "Intake Submitted",
        "Your client intake details have been recorded. An agency care coordinator will reach out shortly.",
    )

    return {
        "message": "Client intake details saved successfully.",
        "profile": res.data[0],
    }


@router.get("/me/agreements")
def get_my_agreements(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        supabase.table("client_agreements")
        .select("*")
        .eq("client_id", user_id)
        .order("agreement_key")
        .execute()
    )
    signed = {a["agreement_key"]: a for a in res.data or []}

    items = []
    for tpl in AGREEMENT_TEMPLATES:
        record = signed.get(tpl["agreement_key"])
        items.append({
            **tpl,
            "signed": bool(record and record.get("signed_at")),
            "signed_at": record.get("signed_at") if record else None,
            "signed_name": record.get("signed_name") if record else None,
            "version": record.get("version") if record else 1,
        })

    return {"agreements": items}


@router.get("/me/agreements/{agreement_key}/history")
def get_agreement_history(agreement_key: str, user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")
    res = (
        supabase.table("client_agreements")
        .select("*")
        .eq("client_id", user_id)
        .eq("agreement_key", agreement_key)
        .order("version", desc=True)
        .execute()
    )
    return {"history": res.data or []}


@router.post("/me/agreements/{agreement_key}/sign")
def sign_agreement(
    agreement_key: str,
    payload: AgreementSignSubmit,
    request: Request,
    user: dict = Depends(require_client),
):
    supabase = get_supabase()
    user_id = user.get("sub")

    tpl = next((t for t in AGREEMENT_TEMPLATES if t["agreement_key"] == agreement_key), None)
    if tpl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agreement not found.")

    signature = _validate_signature(payload)

    # Determine version increment and compute content hash
    existing_res = (
        supabase.table("client_agreements")
        .select("version")
        .eq("client_id", user_id)
        .eq("agreement_key", agreement_key)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    next_version = (existing_res.data[0]["version"] + 1) if existing_res.data and existing_res.data[0].get("version") else 1
    content_hash = hashlib.sha256(tpl["body"].encode("utf-8")).hexdigest()

    agreement_data = {
        "client_id": user_id,
        "state_id": user.get("state_id"),
        "agreement_key": agreement_key,
        "title": tpl["title"],
        "body": tpl["body"],
        "version": next_version,
        "content_hash": content_hash,
        **signature,
    }

    res = supabase.table("client_agreements").insert(agreement_data).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record agreement signature.",
        )

    record_audit_log(
        supabase,
        user_id,
        "client_agreement_signed",
        "client_agreements",
        agreement_key,
        new_values={
            "signed_name": signature["signed_name"],
            "signed_at": signature["signed_at"],
            "version": next_version,
            "content_hash": content_hash,
        },
        request=request,
        required=True,
        entity_state_id=user.get("state_id"),
    )

    notify(
        supabase,
        user_id,
        "agreement_signed",
        "Form Signed",
        f"'{tpl['title']}' has been signed electronically and stored on your record.",
    )

    return {"message": "Agreement signed successfully", "agreement": res.data[0]}


@router.post("/me/authorizations")
async def upload_authorization(
    request: Request,
    file: UploadFile = File(...),
    start_date: str = Form(...),
    end_date: str = Form(...),
    notes: Optional[str] = Form(None),
    user: dict = Depends(require_client),
):
    """Client self-service: upload an authorization document -> pending authorization record."""
    supabase = get_supabase()
    user_id = user.get("sub")

    try:
        start_d = date.fromisoformat(start_date.strip())
        end_d = date.fromisoformat(end_date.strip())
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid start or end date.")
    if end_d < start_d:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date must be on or after start date.")

    type_res = await run_in_threadpool(
        lambda: supabase.table("document_types")
        .select("id")
        .eq("name", "Authorization Document")
        .single()
        .execute()
    )
    if not type_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authorization Document type is not configured.",
        )

    file_bytes = await file.read()
    record = await run_in_threadpool(
        document_service.upload_document,
        owner_id=user_id,
        role="client",
        state_id=user.get("state_id"),
        document_type_id=type_res.data["id"],
        file_bytes=file_bytes,
        original_filename=file.filename or "authorization",
        content_type=file.content_type or "application/octet-stream",
        expiration_date=None,
    )

    doc_id = record.get("id", "")
    auth_data = {
        "client_id": user_id,
        "state_id": user.get("state_id"),
        "authorization_number": f"PENDING-{doc_id[:8].upper()}",
        "start_date": start_d.isoformat(),
        "end_date": end_d.isoformat(),
        "status": "pending",
        "source": "client",
        "document_id": doc_id,
        "notes": notes.strip() if notes else "Submitted for authorization review.",
    }

    def _save_auth():
        auth_res = supabase.table("authorizations").insert(auth_data).execute()
        if not auth_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to record authorization request.",
            )
        auth_id = auth_res.data[0]["id"]
        record_audit_log(
            supabase,
            user_id=user_id,
            action="authorization_uploaded",
            table_name="authorizations",
            record_id=str(auth_id),
            new_values=auth_data,
            request=request,
            entity_state_id=user.get("state_id"),
        )
        notify(
            supabase,
            user_id,
            "authorization_uploaded",
            "Authorization Submitted",
            "Your authorization document has been received and queued for care coordinator review.",
        )
        return auth_res.data[0]

    saved_auth = await run_in_threadpool(_save_auth)
    return {"message": "Authorization submitted for review", "authorization": saved_auth}


@router.get("/me/authorizations")
def get_my_authorizations(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        active_only(
            supabase.table("authorizations").select("*, states(name, code, slug)"),
            "authorizations",
        )
        .eq("client_id", user_id)
        .order("end_date", desc=True)
        .execute()
    )

    records = res.data or []
    today = date.today()

    computed_list = []
    for auth in records:
        end_d = datetime.strptime(auth["end_date"], "%Y-%m-%d").date() if auth.get("end_date") else None
        days_left = (end_d - today).days if end_d else None

        auth_status = auth.get("status", "pending")
        if auth_status == "active" and days_left is not None and 0 <= days_left <= 30:
            auth_status = "expiring_soon"
        elif end_d and end_d < today:
            auth_status = "expired"

        computed_list.append({
            **auth,
            "status": auth_status,
            "days_until_expiration": days_left,
        })

    return {"authorizations": computed_list}


# Day-of-week ordering for schedule display (matches frontend weekly layout).
DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

SCHEDULE_STATUS_LABELS = {
    "scheduled": "Scheduled",
    "confirmed": "Confirmed",
    "completed": "Completed",
    "cancelled": "Cancelled",
}


def _format_time_12h(value):
    """Format a TIME value ('14:00:00') as a 12-hour clock string ('02:00 PM')."""
    if not value:
        return ""
    try:
        hh, mm = value.split(":")[0:2]
    except (ValueError, AttributeError):
        return str(value)
    hour = int(hh)
    minute = int(mm)
    period = "AM" if hour < 12 else "PM"
    hour12 = hour % 12 or 12
    return f"{hour12:02d}:{minute:02d} {period}"


def _fetch_care_plan(supabase, client_id):
    plan_res = (
        active_only(supabase.table("care_plans").select("*"), "care_plans")
        .eq("client_id", client_id)
        .single()
        .execute()
    )
    return plan_res.data


def _fetch_plan_activities(supabase, care_plan_id):
    if not care_plan_id:
        return []
    res = (
        active_only(
            supabase.table("care_plan_activities").select("*"),
            "care_plan_activities",
        )
        .eq("care_plan_id", care_plan_id)
        .order("sort_order")
        .execute()
    )
    return res.data or []


@router.get("/me/care-plan")
def get_my_care_plan(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    client_res = (
        active_only(
            supabase.table("clients").select("*, states(name, code)"),
            "clients",
        )
        .eq("id", user_id)
        .execute()
    )
    client = client_res.data[0] if client_res.data else None

    plan = _fetch_care_plan(supabase, user_id)
    if not plan:
        return {"care_plan": None}

    activities = _fetch_plan_activities(supabase, plan["id"])

    care_plan = {
        "client_name": f"{client['first_name']} {client['last_name']}" if client else "Client",
        "plan_status": plan.get("status", "active"),
        "primary_nurse": plan.get("primary_nurse"),
        "effective_date": plan.get("effective_date"),
        "daily_activities": [
            {"task": a["task"], "frequency": a.get("frequency"), "notes": a.get("notes")}
            for a in activities
        ],
        "emergency_protocol": plan.get("emergency_protocol"),
    }

    return {"care_plan": care_plan}


@router.get("/me/schedule")
def get_my_schedule(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    client_res = (
        active_only(
            supabase.table("clients").select("*, states(name, code)"),
            "clients",
        )
        .eq("id", user_id)
        .execute()
    )
    client = client_res.data[0] if client_res.data else None
    state_code = client.get("states", {}).get("code", "FL") if client else "FL"

    res = (
        active_only(supabase.table("care_schedules").select("*"), "care_schedules")
        .eq("client_id", user_id)
        .execute()
    )
    records = res.data or []

    def day_index(r):
        try:
            return DAY_ORDER.index(r.get("day_of_week"))
        except ValueError:
            return len(DAY_ORDER)

    records.sort(key=lambda r: (day_index(r), r.get("sort_order") or 0))

    schedule = [
        {
            "day": r.get("day_of_week"),
            "time": f"{_format_time_12h(r.get('start_time'))} - {_format_time_12h(r.get('end_time'))}",
            "service": r.get("service"),
            "status": SCHEDULE_STATUS_LABELS.get(r.get("status"), r.get("status")),
            "branch": state_code,
            "notes": r.get("notes"),
        }
        for r in records
    ]

    return {"schedule": schedule}


@router.get("/me/notifications")
def get_my_notifications(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        active_only(supabase.table("notifications").select("*"), "notifications")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )

    return {"notifications": res.data or []}


@router.patch("/me/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, user: dict = Depends(require_client)):
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


def _parse_date(value):
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


@router.get("/me/document-status")
def get_client_document_status(user: dict = Depends(require_client)):
    """Aggregate document health vs. the client's state's required document types."""
    supabase = get_supabase()
    user_id = user.get("sub")

    prof = (
        active_only(
            supabase.table("clients").select("state_id"),
            "clients",
        )
        .eq("id", user_id)
        .single()
        .execute()
    )
    state_id = (prof.data or {}).get("state_id")

    required = []
    if state_id:
        req_res = (
            supabase.table("document_requirements")
            .select("document_type_id, required, for_role, document_types(name)")
            .eq("state_id", state_id)
            .execute()
        )
        required = [
            r for r in (req_res.data or [])
            if r.get("for_role") in ("client", "both") or r.get("for_role") is None
        ]

    docs_res = (
        active_only(
            supabase.table("documents").select(
                "*, document_types(name, requires_expiration)"
            ),
            "documents",
        )
        .eq("owner_id", user_id)
        .execute()
    )
    docs = docs_res.data or []
    uploaded_type_ids = {d.get("document_type_id") for d in docs}

    today = date.today()
    soon_through = today + timedelta(days=30)

    missing = []
    required_panels = []
    for r in required:
        type_id = r.get("document_type_id")
        name = (r.get("document_types") or {}).get("name", "Required document")
        required_panels.append({"document_type_id": type_id, "name": name})
        if r.get("required") and type_id not in uploaded_type_ids:
            missing.append({"document_type_id": type_id, "name": name})

    expired = []
    expiring_soon = []
    valid = []
    for d in docs:
        name = (d.get("document_types") or {}).get("name", "Document")
        base = {
            "id": d.get("id"),
            "name": name,
            "status": d.get("status"),
            "expiration_date": d.get("expiration_date"),
        }
        if d.get("status") == "expired":
            expired.append(base)
            continue
        exp_date = _parse_date(d.get("expiration_date"))
        if exp_date is None or exp_date > soon_through:
            valid.append(base)
        elif exp_date < today:
            expired.append(base)
        else:
            expiring_soon.append(base)

    return {
        "state_id": state_id,
        "required_types": required_panels,
        "missing": missing,
        "expired": expired,
        "expiring_soon": expiring_soon,
        "valid": valid,
        "summary": {
            "missing": len(missing),
            "expired": len(expired),
            "expiring_soon": len(expiring_soon),
            "compliant": len(missing) == 0 and len(expired) == 0,
        },
    }

