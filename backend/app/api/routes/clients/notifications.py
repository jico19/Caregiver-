from fastapi import APIRouter, Depends

from app.core.dependencies import require_client
from app.core.soft_delete import active_only
from app.core.supabase import get_supabase

router = APIRouter()


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

    active_only(
        supabase.table("notifications").update({"read": True}),
        "notifications",
    ).eq("id", notification_id).eq("user_id", user_id).execute()

    return {"message": "Notification marked as read"}
