from fastapi import APIRouter, Depends, HTTPException, status, Request
from datetime import datetime, timezone, date, timedelta
import json
import hashlib
from app.core.dependencies import require_caregiver, validate_state_id
from app.core.supabase import get_supabase, get_supabase_anon
from app.core.soft_delete import active_only
from app.schemas.caregivers import CaregiverApplicationSubmit, CaregiverProfileUpdate, PublicCaregiverApplicationSubmit
from app.utils.notifications import notify
from app.api.routes.admin import record_audit_log

router = APIRouter()


def _validate_signature(payload):
    """Require a drawn e-signature before any application is submitted."""
    sig = (payload.signature_data or "").strip()
    name = (payload.signed_name or "").strip()
    if not sig:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A drawn signature is required to submit your application.",
        )
    if not sig.startswith("data:image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signature must be a drawn image (data URL).",
        )
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your full name is required to sign the application.",
        )
    return {
        "signature_data": sig,
        "signed_name": name,
        "signed_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/me")
def get_my_profile(user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        active_only(
            supabase.table("caregivers").select(
                "id, state_id, first_name, last_name, phone, address, date_of_birth, ssn_last4, created_at, updated_at, legal_hold, states(name, code, slug)"
            ),
            "caregivers",
        )
        .eq("id", user_id)
        .execute()
    )

    if not res.data:
        return {"profile": None}

    return {"profile": res.data[0]}


@router.get("/me/application")
def get_my_application(user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        active_only(
            supabase.table("caregiver_applications").select(
                "id, caregiver_id, state_id, status, submitted_at, reviewed_at, reviewed_by, notes, rejection_reason, created_at, updated_at, states(name, code, slug)"
            ),
            "caregiver_applications",
        )
        .eq("caregiver_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not res.data:
        return {"application": None}

    return {"application": res.data[0]}


@router.post("/apply-public")
def apply_public(payload: PublicCaregiverApplicationSubmit, request: Request):
    supabase = get_supabase()
    anon_client = get_supabase_anon()

    signature = _validate_signature(payload)

    state_id = validate_state_id(supabase, payload.state_id)

    # 1. Create auth user
    try:
        auth_res = supabase.auth.admin.create_user({
            "email": payload.email,
            "password": payload.password,
            "email_confirm": True,
        })
    except Exception as e:
        err_str = str(e)
        if "already been registered" in err_str.lower() or "duplicate" in err_str.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists. Please log in to complete or view your application.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Account creation failed: {err_str}",
        )

    if not auth_res.user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create caregiver user account.",
        )

    user_id = str(auth_res.user.id)

    # 2. Insert into users table
    role_row = supabase.table("roles").select("id").eq("name", "caregiver").single().execute()
    role_id = role_row.data["id"] if role_row.data else 2

    supabase.table("users").insert({
        "id": user_id,
        "email": payload.email,
        "role_id": role_id,
        "state_id": state_id,
        "status": "active",
    }).execute()

    # 3. Create caregiver profile
    profile_data = {
        "id": user_id,
        "state_id": state_id,
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "phone": payload.phone,
        "address": payload.address,
        "date_of_birth": str(payload.date_of_birth) if payload.date_of_birth else None,
        "ssn_last4": payload.ssn_last4,
    }
    supabase.table("caregivers").insert(profile_data).execute()

    # 4. Insert application record with frozen content_hash and version
    now_iso = datetime.now(timezone.utc).isoformat()
    content_hash = hashlib.sha256(json.dumps(payload.model_dump(), sort_keys=True, default=str).encode("utf-8")).hexdigest()
    app_data = {
        "caregiver_id": user_id,
        "state_id": state_id,
        "status": "submitted",
        "submitted_at": now_iso,
        "notes": payload.notes,
        "version": 1,
        "content_hash": content_hash,
        **signature,
    }
    app_res = supabase.table("caregiver_applications").insert(app_data).execute()

    if app_res.data:
        record_audit_log(
            supabase,
            user_id,
            "caregiver_application_signed",
            "caregiver_applications",
            app_res.data[0].get("id"),
            new_values={
                "signed_name": signature["signed_name"],
                "signed_at": signature["signed_at"],
                "content_hash": content_hash,
                "version": 1,
            },
            request=request,
            required=True,
            entity_state_id=state_id,
        )

    # 5. Create in-app notification
    notify(
        supabase,
        user_id,
        "application_submitted",
        "Application Received",
        "Welcome to the CarePlatform clinical team! Your onboarding application has been submitted and is under administrative review.",
    )

    # 6. Generate access session so user is logged in automatically
    session_data = None
    try:
        login_res = anon_client.auth.sign_in_with_password({
            "email": payload.email,
            "password": payload.password,
        })
        if login_res.session:
            session_data = {
                "access_token": login_res.session.access_token,
                "token_type": "bearer",
                "user_id": user_id,
                "role": "caregiver",
                "state_id": state_id,
            }
    except Exception:
        pass

    return {
        "message": "Application submitted successfully",
        "application": app_res.data[0] if app_res.data else None,
        "session": session_data,
    }


@router.post("/applications")
def submit_application(
    payload: CaregiverApplicationSubmit,
    user: dict = Depends(require_caregiver),
):
    supabase = get_supabase()
    user_id = user.get("sub")

    signature = _validate_signature(payload)

    validate_state_id(supabase, payload.state_id)

    # 1. Upsert caregiver profile
    profile_data = {
        "id": user_id,
        "state_id": payload.state_id,
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "phone": payload.phone,
        "address": payload.address,
        "date_of_birth": str(payload.date_of_birth) if payload.date_of_birth else None,
        "ssn_last4": payload.ssn_last4,
    }

    profile_res = supabase.table("caregivers").upsert(profile_data).execute()
    if not profile_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update caregiver profile.",
        )

    # 2. Update users table state_id if needed
    (
        active_only(
            supabase.table("users").update({"state_id": payload.state_id}),
            "users",
        )
        .eq("id", user_id)
        .execute()
    )

    # 3. Enforce the application state machine (one application per caregiver).
    #    A soft-deleted application does not count, so a caregiver whose
    #    application was withdrawn may submit again.
    app_q = (
        active_only(
            supabase.table("caregiver_applications").select("*"),
            "caregiver_applications",
        )
        .eq("caregiver_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    latest = app_q.data[0] if app_q.data else None
    now_iso = datetime.now(timezone.utc).isoformat()

    if latest is not None:
        current_status = latest.get("status")
        if current_status != "rejected":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Your application is already submitted and under review. "
                    "You can edit it again once the review completes."
                ),
            )

        # Rejected → flip the existing row in place (mirror resubmit_application).
        app_res = (
            active_only(
                supabase.table("caregiver_applications").update({
                    "state_id": payload.state_id,
                    "status": "submitted",
                    "submitted_at": now_iso,
                    "notes": payload.notes,
                    "rejection_reason": None,
                    "reviewed_at": None,
                    "reviewed_by": None,
                    **signature,
                }),
                "caregiver_applications",
            )
            .eq("id", latest["id"])
            .execute()
        )
        if not app_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to record caregiver application.",
            )
        record_audit_log(
            supabase,
            user_id,
            "caregiver_application_signed",
            "caregiver_applications",
            latest["id"],
            new_values={"signed_name": signature["signed_name"], "signed_at": signature["signed_at"]},
        )
        notify(
            supabase,
            user_id,
            "application_resubmitted",
            "Application Resubmitted",
            "Your caregiver application has been resubmitted and is back under administrative review.",
        )
        return {"message": "Application resubmitted successfully", "application": app_res.data[0]}

    # 4. No application yet → create a new submitted record
    app_data = {
        "caregiver_id": user_id,
        "state_id": payload.state_id,
        "status": "submitted",
        "submitted_at": now_iso,
        "notes": payload.notes,
        **signature,
    }

    app_res = supabase.table("caregiver_applications").insert(app_data).execute()
    if not app_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record caregiver application.",
        )
    record_audit_log(
        supabase,
        user_id,
        "caregiver_application_signed",
        "caregiver_applications",
        app_res.data[0].get("id"),
        new_values={"signed_name": signature["signed_name"], "signed_at": signature["signed_at"]},
    )

    # 5. Create in-app notification
    notify(
        supabase,
        user_id,
        "application_submitted",
        "Application Received",
        "Your caregiver onboarding application has been received and is under review.",
    )

    return {
        "message": "Application submitted successfully",
        "application": app_res.data[0],
    }


@router.post("/applications/resubmit")
def resubmit_application(
    payload: CaregiverApplicationSubmit,
    user: dict = Depends(require_caregiver),
):
    supabase = get_supabase()
    user_id = user.get("sub")

    signature = _validate_signature(payload)

    validate_state_id(supabase, payload.state_id)

    # 1. Load most recent live application for this caregiver
    app_q = (
        active_only(
            supabase.table("caregiver_applications").select("*"),
            "caregiver_applications",
        )
        .eq("caregiver_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not app_q.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No application found to resubmit.",
        )

    latest = app_q.data[0]
    if latest.get("status") != "rejected":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only a rejected application can be resubmitted.",
        )

    # 2. Upsert caregiver profile
    profile_data = {
        "id": user_id,
        "state_id": payload.state_id,
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "phone": payload.phone,
        "address": payload.address,
        "date_of_birth": str(payload.date_of_birth) if payload.date_of_birth else None,
        "ssn_last4": payload.ssn_last4,
    }
    profile_res = supabase.table("caregivers").upsert(profile_data).execute()
    if not profile_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update caregiver profile.",
        )

    # 3. Update users table state_id if needed
    (
        active_only(
            supabase.table("users").update({"state_id": payload.state_id}),
            "users",
        )
        .eq("id", user_id)
        .execute()
    )

    # 4. Flip the existing application record back to submitted (in-place resubmit)
    now_iso = datetime.now(timezone.utc).isoformat()
    app_res = (
        active_only(
            supabase.table("caregiver_applications").update({
                "state_id": payload.state_id,
                "status": "submitted",
                "submitted_at": now_iso,
                "notes": payload.notes,
                "rejection_reason": None,
                "reviewed_at": None,
                "reviewed_by": None,
                **signature,
            }),
            "caregiver_applications",
        )
        .eq("id", latest["id"])
        .execute()
    )

    if not app_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resubmit caregiver application.",
        )

    record_audit_log(
        supabase,
        user_id,
        "caregiver_application_signed",
        "caregiver_applications",
        latest["id"],
        new_values={"signed_name": signature["signed_name"], "signed_at": signature["signed_at"]},
    )

    # 5. Create in-app notification
    notify(
        supabase,
        user_id,
        "application_resubmitted",
        "Application Resubmitted",
        "Your caregiver application has been resubmitted and is back under administrative review.",
    )

    return {
        "message": "Application resubmitted successfully",
        "application": app_res.data[0],
    }


@router.get("/me/documents")
def get_my_documents(user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        active_only(
            supabase.table("documents").select(
                "*, document_types(name, requires_expiration)"
            ),
            "documents",
        )
        .eq("owner_id", user_id)
        .order("uploaded_at", desc=True)
        .execute()
    )

    return {"documents": res.data or []}


@router.patch("/me/profile")
def update_my_profile(
    payload: CaregiverProfileUpdate,
    request: Request,
    user: dict = Depends(require_caregiver),
):
    supabase = get_supabase()
    user_id = user.get("sub")

    # A profile edit must not change which state the caregiver belongs to.
    # state_id is part of this payload because the edit form always submits
    # it, so the current value is accepted and any change is refused.
    # Moving a caregiver between states is an administrative action.
    current_state_id = user.get("state_id")
    if payload.state_id != current_state_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to change your assigned state.",
        )

    validate_state_id(supabase, current_state_id)

    profile_data = {
        "id": user_id,
        "state_id": current_state_id,
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "phone": payload.phone,
        "address": payload.address,
        "date_of_birth": str(payload.date_of_birth) if payload.date_of_birth else None,
        "ssn_last4": payload.ssn_last4,
    }

    res = supabase.table("caregivers").upsert(profile_data).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update caregiver profile.",
        )

    (
        active_only(
            supabase.table("users").update({"state_id": current_state_id}),
            "users",
        )
        .eq("id", user_id)
        .execute()
    )

    record_audit_log(
        supabase,
        user_id=user_id,
        action="caregiver_profile_updated",
        table_name="caregivers",
        record_id=str(user_id),
        new_values=profile_data,
        request=request,
        entity_state_id=current_state_id,
    )

    return {"message": "Profile updated successfully", "profile": res.data[0]}


@router.get("/me/notifications")
def get_my_notifications(user: dict = Depends(require_caregiver)):
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
def mark_notification_read(notification_id: str, user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        active_only(
            supabase.table("notifications").update({"read": True}),
            "notifications",
        )
        .eq("id", notification_id)
        .eq("user_id", user_id)
        .execute()
    )

    return {"message": "Notification marked as read"}


@router.patch("/me/notifications/read-all")
def mark_all_notifications_read(user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    (
        active_only(
            supabase.table("notifications").update({"read": True}),
            "notifications",
        )
        .eq("user_id", user_id)
        .execute()
    )

    return {"message": "All notifications marked as read"}


def _parse_date(value):
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


@router.get("/me/credential-status")
def get_credential_status(user: dict = Depends(require_caregiver)):
    """Aggregate credential health vs. the state's required document types."""
    supabase = get_supabase()
    user_id = user.get("sub")

    prof = (
        active_only(
            supabase.table("caregivers").select("state_id"),
            "caregivers",
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
            .select("document_type_id, required, document_types(name)")
            .eq("state_id", state_id)
            .execute()
        )
        required = req_res.data or []

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


@router.get("/me/announcements")
def get_my_announcements(user: dict = Depends(require_caregiver)):
    """Latest active announcements targeted at all caregivers or this caregiver's state."""
    supabase = get_supabase()
    user_id = user.get("sub")
    state_id = None
    prof = (
        active_only(
            supabase.table("caregivers").select("state_id"),
            "caregivers",
        )
        .eq("id", user_id)
        .single()
        .execute()
    )
    if prof.data and prof.data.get("state_id"):
        state_id = prof.data["state_id"]

    res = (
        active_only(supabase.table("announcements").select("*"), "announcements")
        .eq("is_active", True)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )

    items = []
    for a in res.data or []:
        if a.get("audience") in ("client", "administrator") and a.get("audience") != "all":
            continue
        if a.get("audience") not in ("caregiver", "all"):
            continue
        if a.get("state_id") and a["state_id"] != state_id:
            continue
        items.append(a)

    return {"announcements": items[:5]}


def _assert_caregiver_assigned_to_client(supabase, caregiver_id: str, client_id: str):
    res = (
        supabase.table("caregiver_client_assignments")
        .select("id")
        .eq("caregiver_id", caregiver_id)
        .eq("client_id", client_id)
        .is_("ended_at", None)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access records for this client.",
        )


@router.get("/me/clients")
def get_my_clients(user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    assign_res = (
        supabase.table("caregiver_client_assignments")
        .select("id, client_id, role, assigned_at, clients(id, first_name, last_name, phone, address, status, states(name, code, slug))")
        .eq("caregiver_id", user_id)
        .is_("ended_at", None)
        .execute()
    )

    clients = []
    for row in (assign_res.data or []):
        client = row.get("clients")
        if isinstance(client, dict):
            if client.get("deleted_at") is None:
                client["assignment_role"] = row.get("role")
                client["assigned_at"] = row.get("assigned_at")
                clients.append(client)
        elif row.get("client_id"):
            c_res = (
                active_only(
                    supabase.table("clients").select("id, first_name, last_name, phone, address, status, states(name, code, slug)"),
                    "clients",
                )
                .eq("id", row["client_id"])
                .execute()
            )
            if c_res.data:
                c_item = c_res.data[0]
                c_item["assignment_role"] = row.get("role")
                c_item["assigned_at"] = row.get("assigned_at")
                clients.append(c_item)

    return {"clients": clients}


@router.get("/me/clients/{client_id}/care-plan")
def get_assigned_client_care_plan(client_id: str, user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    _assert_caregiver_assigned_to_client(supabase, user_id, client_id)

    client_res = (
        active_only(
            supabase.table("clients").select("id, first_name, last_name, state_id, states(name, code)"),
            "clients",
        )
        .eq("id", client_id)
        .execute()
    )
    client = client_res.data[0] if client_res.data else None

    plan_res = (
        active_only(supabase.table("care_plans").select("*"), "care_plans")
        .eq("client_id", client_id)
        .execute()
    )
    plan = plan_res.data[0] if plan_res.data else None
    if not plan:
        return {"care_plan": None, "client": client}

    act_res = (
        active_only(supabase.table("care_plan_activities").select("*"), "care_plan_activities")
        .eq("care_plan_id", plan["id"])
        .order("sort_order")
        .execute()
    )
    activities = act_res.data or []

    care_plan = {
        "id": plan.get("id"),
        "client_id": client_id,
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

    return {"care_plan": care_plan, "client": client}


@router.get("/me/clients/{client_id}/schedule")
def get_assigned_client_schedule(client_id: str, user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    _assert_caregiver_assigned_to_client(supabase, user_id, client_id)

    client_res = (
        active_only(
            supabase.table("clients").select("id, first_name, last_name, state_id, states(name, code)"),
            "clients",
        )
        .eq("id", client_id)
        .execute()
    )
    client = client_res.data[0] if client_res.data else None

    res = (
        active_only(supabase.table("care_schedules").select("*"), "care_schedules")
        .eq("client_id", client_id)
        .execute()
    )
    records = res.data or []

    DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    def day_index(r):
        try:
            return DAY_ORDER.index(r.get("day_of_week"))
        except ValueError:
            return len(DAY_ORDER)

    records.sort(key=lambda r: (day_index(r), r.get("sort_order") or 0))

    return {"schedule": records, "client": client}


