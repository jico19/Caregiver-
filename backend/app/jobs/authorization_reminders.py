"""Idempotent in-app reminders for client authorization expiry.

Runs daily. For every authorization that expires within 30 days (or already
expired) it creates ONE in-app notification keyed on notifications.reference_id,
so re-runs never spam the client.
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


def scan_due_authorizations(supabase, today=None) -> int:
    today = today or date.today()
    soon_through = today + timedelta(days=EXPIRING_WINDOW_DAYS)

    res = (
        supabase.table("authorizations")
        .select("id, client_id, status, end_date, authorization_number")
        .execute()
    )

    created = 0
    for auth in res.data or []:
        client_id = auth.get("client_id")
        if not client_id:
            continue
        if auth.get("status") == "rejected":
            continue

        end_d = _parse_date(auth.get("end_date"))
        if end_d is None:
            continue

        is_expired = end_d < today
        expiring = not is_expired and end_d <= soon_through
        if not (is_expired or expiring):
            continue

        num = auth.get("authorization_number") or "N/A"
        if is_expired:
            notif_type, title, body = (
                "authorization_expired",
                "Authorization expired",
                f"Authorization {num} expired on {end_d.isoformat()}. Please contact your care coordinator about renewal.",
            )
        else:
            notif_type, title, body = (
                "authorization_expiring",
                "Authorization expiring soon",
                f"Authorization {num} expires on {end_d.isoformat()}. Contact your care coordinator before it lapses.",
            )

        exists = (
            supabase.table("notifications")
            .select("id")
            .eq("user_id", client_id)
            .eq("type", notif_type)
            .eq("reference_id", str(auth.get("id")))
            .execute()
        )
        if exists.data:
            continue

        notify(supabase, client_id, notif_type, title, body, reference_id=str(auth.get("id")))
        created += 1

    return created