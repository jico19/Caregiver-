"""Admin caregiver application review: transition whitelist + rejection reason."""
from conftest import auth_headers


def seed_app(db, status="submitted", app_id="app1", reason=None):
    db["caregiver_applications"].append({
        "id": app_id,
        "caregiver_id": "u-caregiver",
        "state_id": 1,
        "status": status,
        "notes": "narrative",
        "rejection_reason": reason,
        "reviewed_at": "2026-01-02T00:00:00Z" if reason else None,
        "reviewed_by": "u-admin" if reason else None,
        "created_at": "2026-01-01T00:00:00Z",
    })


def test_review_valid_transition_submitted_to_under_review(client):
    c, db, _ = client
    seed_app(db, status="submitted")
    r = c.post(
        "/api/v1/admin/caregivers/app1/review",
        json={"status": "under_review"},
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 200
    assert db["caregiver_applications"][0]["status"] == "under_review"


def test_review_valid_transition_approved_to_onboarding(client):
    c, db, _ = client
    seed_app(db, status="approved")
    r = c.post(
        "/api/v1/admin/caregivers/app1/review",
        json={"status": "onboarding"},
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 200
    assert db["caregiver_applications"][0]["status"] == "onboarding"


def test_review_invalid_transition_rejected_to_onboarding(client):
    c, db, _ = client
    seed_app(db, status="rejected", reason="Missing CPR")
    r = c.post(
        "/api/v1/admin/caregivers/app1/review",
        json={"status": "onboarding"},
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 409
    assert db["caregiver_applications"][0]["status"] == "rejected"


def test_review_invalid_skip_submitted_to_onboarding(client):
    c, db, _ = client
    seed_app(db, status="submitted")
    r = c.post(
        "/api/v1/admin/caregivers/app1/review",
        json={"status": "onboarding"},
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 409
    assert db["caregiver_applications"][0]["status"] == "submitted"


def test_reject_requires_reason(client):
    c, db, _ = client
    seed_app(db, status="submitted")
    r = c.post(
        "/api/v1/admin/caregivers/app1/review",
        json={"status": "rejected", "notes": ""},
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 400


def test_reject_with_reason_sets_rejection_reason(client):
    c, db, _ = client
    seed_app(db, status="under_review")
    r = c.post(
        "/api/v1/admin/caregivers/app1/review",
        json={"status": "rejected", "notes": "Registry mismatch"},
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 200
    row = db["caregiver_applications"][0]
    assert row["status"] == "rejected"
    assert row["rejection_reason"] == "Registry mismatch"


def test_caregiver_cannot_review(client):
    c, db, _ = client
    seed_app(db, status="submitted")
    r = c.post(
        "/api/v1/admin/caregivers/app1/review",
        json={"status": "approved"},
        headers=auth_headers("u-caregiver"),
    )
    assert r.status_code == 403


def test_admin_detail_returns_application_and_enrollments(client):
    c, db, _ = client
    seed_app(db, status="submitted")
    db["training_enrollments"].append({
        "id": "enr1",
        "course_id": "c1",
        "caregiver_id": "u-caregiver",
        "status": "in_progress",
        "training_courses": {"name": "HIPAA Basics"},
    })
    r = c.get("/api/v1/admin/caregivers/app1", headers=auth_headers("u-admin"))
    assert r.status_code == 200
    assert r.json()["application"]["id"] == "app1"
    assert len(r.json()["enrollments"]) == 1


def test_admin_documents_for_application(client):
    c, db, _ = client
    seed_app(db, status="submitted")
    db["documents"].append({
        "id": "doc1",
        "owner_id": "u-caregiver",
        "status": "pending_review",
        "document_types": {"name": "CPR Certificate"},
    })
    r = c.get("/api/v1/admin/caregivers/app1/documents", headers=auth_headers("u-admin"))
    assert r.status_code == 200
    assert len(r.json()["documents"]) == 1
    assert r.json()["documents"][0]["document_types"]["name"] == "CPR Certificate"