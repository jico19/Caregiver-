def notify(supabase, user_id: str, type_: str, title: str, body: str, reference_id: str = None) -> None:
    """Insert an in-app notification for a user.

    `reference_id` lets reminder jobs stay idempotent (one notification per
    referenced record, e.g. an expiring document).
    """
    payload = {
        "user_id": user_id,
        "type": type_,
        "title": title,
        "body": body,
    }
    if reference_id:
        payload["reference_id"] = reference_id
    supabase.table("notifications").insert(payload).execute()