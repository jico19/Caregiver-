import hashlib
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.dependencies import require_caregiver, validate_state_id
from app.core.soft_delete import active_only
from app.core.supabase import get_supabase, get_supabase_anon
from app.schemas.caregivers import CaregiverApplicationSubmit, PublicCaregiverApplicationSubmit
from app.services.audit import record_audit_log
from app.services.signature_service import validate_signature
from app.utils.notifications import notify

router = APIRouter()


@router.post("/apply-public")
def apply_public(payload: PublicCaregiverApplicationSubmit, request: Request):
    supabase = get_supabase()
    anon_client = get_supabase_anon()

    signature = validate_signature(
        payload,
        empty_detail="A drawn signature is required to submit your application.",
        name_detail="Your full name is required to sign the application.",
    )

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

    # 2-4: Insert users, caregivers profile, and caregiver_applications with rollback compensation
    try:
        role_row = supabase.table("roles").select("id").eq("name", "caregiver").single().execute()
        role_id = role_row.data["id"] if role_row.data else 2

        supabase.table("users").insert({
            "id": user_id,
            "email": payload.email,
            "role_id": role_id,
            "state_id": state_id,
            "status": "active",
        }).execute()

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
    except Exception as exc:
        # Compensation rollback: clean up partial writes and delete auth user to avoid orphan accounts
        try:
            supabase.table("caregivers").delete().eq("id", user_id).execute()
        except Exception:
            pass
        try:
            supabase.table("users").delete().eq("id", user_id).execute()
        except Exception:
            pass
        try:
            supabase.auth.admin.delete_user(user_id)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Application submission failed during record creation: {exc}",
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

    signature = validate_signature(
        payload,
        empty_detail="A drawn signature is required to submit your application.",
        name_detail="Your full name is required to sign the application.",
    )

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

        # Rejected -> flip the existing row in place
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

    # 4. No application yet -> create a new submitted record
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
