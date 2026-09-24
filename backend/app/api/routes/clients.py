from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import UploadFile, File, Form
from starlette.concurrency import run_in_threadpool
from datetime import date, datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field
from app.core.dependencies import require_client, validate_state_id
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
        supabase.table("clients")
        .select("*, states(name, code, slug)")
        .eq("id", user_id)
        .execute()
    )

    if not res.data:
        return {"profile": None}

    return {"profile": res.data[0]}


@router.patch("/me/profile")
def update_my_profile(
    payload: ClientProfileUpdate,
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

    res = supabase.table("clients").update(update_data).eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client profile not found.")

    return {"message": "Profile updated successfully", "profile": res.data[0]}


@router.post("/intake")
def submit_intake(
    payload: ClientIntakeSubmit,
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
        })

    return {"agreements": items}


@router.post("/me/agreements/{agreement_key}/sign")
def sign_agreement(
    agreement_key: str,
    payload: AgreementSignSubmit,
    user: dict = Depends(require_client),
):
    supabase = get_supabase()
    user_id = user.get("sub")

    tpl = next((t for t in AGREEMENT_TEMPLATES if t["agreement_key"] == agreement_key), None)
    if tpl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agreement not found.")

    signature = _validate_signature(payload)

    agreement_data = {
        "client_id": user_id,
        "state_id": user.get("state_id"),
        "agreement_key": agreement_key,
        "title": tpl["title"],
        "body": tpl["body"],
        **signature,
    }

    res = supabase.table("client_agreements").upsert(agreement_data).execute()
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
        new_values={"signed_name": signature["signed_name"], "signed_at": signature["signed_at"]},
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

    type_res = (
        supabase.table("document_types")
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

    auth_data = {
        "client_id": user_id,
        "state_id": user.get("state_id"),
        "authorization_number": f"PENDING-{record.get('id', '')[:8].upper()}",
        "start_date": start_d.isoformat(),
        "end_date": end_d.isoformat(),
        "status": "pending",
        "source": "client",
        "document_id": record.get("id"),
        "notes": notes.strip() if notes else "Submitted for authorization review.",
    }
    auth_res = supabase.table("authorizations").insert(auth_data).execute()
    if not auth_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record authorization request.",
        )

    notify(
        supabase,
        user_id,
        "authorization_uploaded",
        "Authorization Submitted",
        "Your authorization document has been received and queued for care coordinator review.",
    )

    return {"message": "Authorization submitted for review", "authorization": auth_res.data[0]}


@router.get("/me/authorizations")
def get_my_authorizations(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        supabase.table("authorizations")
        .select("*, states(name, code, slug)")
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
        supabase.table("care_plans")
        .select("*")
        .eq("client_id", client_id)
        .single()
        .execute()
    )
    return plan_res.data


def _fetch_plan_activities(supabase, care_plan_id):
    if not care_plan_id:
        return []
    res = (
        supabase.table("care_plan_activities")
        .select("*")
        .eq("care_plan_id", care_plan_id)
        .order("sort_order")
        .execute()
    )
    return res.data or []


@router.get("/me/care-plan")
def get_my_care_plan(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    client_res = supabase.table("clients").select("*, states(name, code)").eq("id", user_id).execute()
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

    client_res = supabase.table("clients").select("*, states(name, code)").eq("id", user_id).execute()
    client = client_res.data[0] if client_res.data else None
    state_code = client.get("states", {}).get("code", "FL") if client else "FL"

    res = (
        supabase.table("care_schedules")
        .select("*")
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
        supabase.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    return {"notifications": res.data or []}


@router.patch("/me/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    supabase.table("notifications").update({"read": True}).eq("id", notification_id).eq("user_id", user_id).execute()

    return {"message": "Notification marked as read"}
