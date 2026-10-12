"""Training course due date reminders: idempotent in-app notifications."""
from datetime import date

from app.jobs.training_reminders import scan_due_training


def _seed(db):
    db["training_courses"][:] = [
        {"id": 1, "name": "Infection Control"},
        {"id": 2, "name": "HIPAA Privacy"},
        {"id": 3, "name": "Client Safety"},
    ]
    db["training_enrollments"][:] = [
        # Already overdue
        {"id": "e1", "caregiver_id": "u-caregiver-fl", "course_id": 1, "status": "in_progress",
         "due_at": "2025-12-01", "training_courses": {"name": "Infection Control"}},
        # Due within 30 days of 2026-01-15
        {"id": "e2", "caregiver_id": "u-caregiver-fl", "course_id": 2, "status": "enrolled",
         "due_at": "2026-02-01", "training_courses": {"name": "HIPAA Privacy"}},
        # Fine (due far in future)
        {"id": "e3", "caregiver_id": "u-caregiver-fl", "course_id": 3, "status": "enrolled",
         "due_at": "2026-12-31", "training_courses": {"name": "Client Safety"}},
        # Completed — skip
        {"id": "e4", "caregiver_id": "u-caregiver-fl", "course_id": 1, "status": "completed",
         "due_at": "2025-11-01", "training_courses": {"name": "Infection Control"}},
    ]


def test_training_reminders_are_idempotent(client):
    c, db, fake = client
    _seed(db)

    created = scan_due_training(fake, today=date(2026, 1, 15))
    assert created == 2
    types = sorted(n["type"] for n in db["notifications"])
    assert types == ["training_due_soon", "training_overdue"]
    assert all(n["reference_id"] in ("e1", "e2") for n in db["notifications"])

    assert scan_due_training(fake, today=date(2026, 1, 15)) == 0
    assert len(db["notifications"]) == 2


def test_training_reminders_no_match_creates_nothing(client):
    c, db, fake = client
    db["training_enrollments"][:] = [
        {"id": "e3", "caregiver_id": "u-caregiver-fl", "course_id": 3, "status": "enrolled",
         "due_at": "2027-06-01", "training_courses": {"name": "Client Safety"}},
    ]
    assert scan_due_training(fake, today=date(2026, 1, 15)) == 0
    assert db["notifications"] == []
