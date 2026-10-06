from fastapi import APIRouter, Depends

from app.core.dependencies import require_caregiver
from app.core.soft_delete import active_only
from app.core.supabase import get_supabase

router = APIRouter()


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

    active_only(
        supabase.table("notifications").update({"read": True}),
        "notifications",
    ).eq("id", notification_id).eq("user_id", user_id).execute()

    return {"message": "Notification marked as read"}


@router.patch("/me/notifications/read-all")
def mark_all_notifications_read(user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    active_only(
        supabase.table("notifications").update({"read": True}),
        "notifications",
    ).eq("user_id", user_id).execute()

    return {"message": "All notifications marked as read"}
