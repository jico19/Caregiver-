"""Idempotent in-app reminders for caregiver training course due dates.

Runs daily. For every training enrollment that is overdue or due within 30 days
it creates ONE in-app notification keyed on notifications.reference_id, so re-runs
never spam the caregiver.
"""
from datetime import date, timedelta

from app.utils.notifications import notify
from app.core.soft_delete import active_only

EXPIRING_WINDOW_DAYS = 30


def _parse_date(value):
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def scan_due_training(supabase, today=None) -> int:
    today = today or date.today()
    soon_through = today + timedelta(days=EXPIRING_WINDOW_DAYS)

    res = (
        active_only(
            supabase.table("training_enrollments").select(
                "id, caregiver_id, status, due_at, training_courses(name)"
            ),
            "training_enrollments",
        )
        .execute()
    )

    created = 0
    for enrollment in res.data or []:
        if enrollment.get("status") == "completed":
            continue

        caregiver_id = enrollment.get("caregiver_id")
        if not caregiver_id:
            continue

        due_d = _parse_date(enrollment.get("due_at"))
        if due_d is None:
            continue

        is_overdue = due_d < today
        due_soon = not is_overdue and due_d <= soon_through
        if not (is_overdue or due_soon):
            continue

        course_name = (enrollment.get("training_courses") or {}).get("name", "Training Course")
        if is_overdue:
            notif_type, title, body = (
                "training_overdue",
                "Training overdue",
                f"Your training course '{course_name}' was due on {due_d.isoformat()}. Please complete it as soon as possible.",
            )
        else:
            notif_type, title, body = (
                "training_due_soon",
                "Training due soon",
                f"Your training course '{course_name}' is due on {due_d.isoformat()}.",
            )

        exists = (
            active_only(
                supabase.table("notifications").select("id"),
                "notifications",
            )
            .eq("user_id", caregiver_id)
            .eq("type", notif_type)
            .eq("reference_id", str(enrollment.get("id")))
            .execute()
        )
        if exists.data:
            continue

        notify(supabase, caregiver_id, notif_type, title, body, reference_id=str(enrollment.get("id")))
        created += 1

    return created
