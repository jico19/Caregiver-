"""Idempotent in-app reminders for caregiver credential expiry.

Runs daily. For every document that is expired or expires within 30 days it
creates ONE in-app notification keyed on notifications.reference_id, so re-runs
never spam the caregiver.
"""
from datetime import date, timedelta

from app.utils.notifications import notify

EXPIRING_WINDOW_DAYS = 30


def _parse_date(value):
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def scan_due_credentials(supabase, today=None) -> int:
    today = today or date.today()
    soon_through = today + timedelta(days=EXPIRING_WINDOW_DAYS)

    res = (
        supabase.table("documents")
        .select("id, owner_id, status, expiration_date, document_types(name)")
        .execute()
    )

    created = 0
    for doc in res.data or []:
        owner_id = doc.get("owner_id")
        if not owner_id:
            continue

        exp_date = _parse_date(doc.get("expiration_date"))
        is_expired = doc.get("status") == "expired" or (exp_date and exp_date < today)
        expiring = bool(exp_date) and not is_expired and exp_date <= soon_through
        if not (is_expired or expiring):
            continue

        name = (doc.get("document_types") or {}).get("name", "credential")
        if is_expired:
            notif_type, title, body = (
                "credential_expired",
                "Expired credential",
                f"Your {name} has expired. Please upload a new copy for review.",
            )
        else:
            notif_type, title, body = (
                "credential_expiring",
                "Credential expiring soon",
                f"Your {name} expires on {exp_date.isoformat()}. Please upload a new copy.",
            )

        exists = (
            supabase.table("notifications")
            .select("id")
            .eq("user_id", owner_id)
            .eq("type", notif_type)
            .eq("reference_id", str(doc.get("id")))
            .execute()
        )
        if exists.data:
            continue

        notify(supabase, owner_id, notif_type, title, body, reference_id=str(doc.get("id")))
        created += 1

    return created