"""Authorization expiry reminders: idempotent in-app notifications."""
from datetime import date

from app.jobs.authorization_reminders import scan_due_authorizations


def _seed(db):
    db["authorizations"][:] = [
        # Already expired
        {"id": "a1", "client_id": "u-client", "status": "active",
         "authorization_number": "A-EXP", "end_date": "2025-12-01"},
        # Expiring within 30 days of 2026-01-15
        {"id": "a2", "client_id": "u-client", "status": "active",
         "authorization_number": "A-SOON", "end_date": "2026-02-01"},
        # Fine
        {"id": "a3", "client_id": "u-client", "status": "active",
         "authorization_number": "A-OK", "end_date": "2026-12-31"},
        # Rejected — skip
        {"id": "a4", "client_id": "u-client", "status": "rejected",
         "authorization_number": "A-NO", "end_date": "2025-11-01"},
    ]


def test_authorization_reminders_are_idempotent(client):
    c, db, fake = client
    _seed(db)

    created = scan_due_authorizations(fake, today=date(2026, 1, 15))
    assert created == 2
    types = sorted(n["type"] for n in db["notifications"])
    assert types == ["authorization_expired", "authorization_expiring"]
    assert all(n["reference_id"] in ("a1", "a2") for n in db["notifications"])

    assert scan_due_authorizations(fake, today=date(2026, 1, 15)) == 0
    assert len(db["notifications"]) == 2


def test_authorization_reminders_no_match_creates_nothing(client):
    c, db, fake = client
    db["authorizations"][:] = [
        {"id": "a3", "client_id": "u-client", "status": "active",
         "authorization_number": "A-OK", "end_date": "2027-06-01"},
    ]
    assert scan_due_authorizations(fake, today=date(2026, 1, 15)) == 0
    assert db["notifications"] == []