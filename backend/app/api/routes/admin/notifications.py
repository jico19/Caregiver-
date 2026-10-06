from fastapi import APIRouter, Depends
from app.core.dependencies import require_admin
from app.core.supabase import get_supabase
from app.core.soft_delete import active_only

router = APIRouter()


@router.get("/notifications")
def get_admin_notifications(user: dict = Depends(require_admin)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        active_only(
            supabase.table("notifications").select(
                "id, user_id, type, title, body, read, reference_id, created_at, updated_at"
            ),
            "notifications",
        )
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
