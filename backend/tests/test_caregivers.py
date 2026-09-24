"""Caregiver application submission + state machine tests."""
from conftest import auth_headers

PAYLOAD = {
    "state_id": 1,
    "first_name": "Jane",
    "last_name": "Doe",
    "phone": "(555) 000-0000",
    "address": "123 Main St",
    "date_of_birth": "1990-01-01",
    "ssn_last4": "1234",
    "notes": "Available immediately.",
    "signature_data": "data:image/png;base64,iVBORw0KGgoAAA",
    "signed_name": "Jane Doe",
}


def test_submit_requires_signature(client):
    c, db, _ = client
    no_sig = {k: v for k, v in PAYLOAD.items() if not k.startswith("sign")}
    r = c.post("/api/v1/caregivers/applications", json=no_sig, headers=auth_headers("u-caregiver"))
    assert r.status_code == 400
    assert len(db["caregiver_applications"]) == 0


def test_submit_records_signature_and_audit(client):
    c, db, _ = client
    r = c.post("/api/v1/caregivers/applications", json=PAYLOAD, headers=auth_headers("u-caregiver"))
    assert r.status_code == 200
    row = db["caregiver_applications"][0]
    assert row["signature_data"] == PAYLOAD["signature_data"]
    assert row["signed_name"] == "Jane Doe"
    assert row["signed_at"]
    logs = [l for l in db["audit_logs"] if l["action"] == "caregiver_application_signed"]
    assert len(logs) == 1


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


def test_submit_application_creates_one_row(client):
    c, db, _ = client
    r = c.post("/api/v1/caregivers/applications", json=PAYLOAD, headers=auth_headers("u-caregiver"))
    assert r.status_code == 200
    rows = db["caregiver_applications"]
    assert len(rows) == 1
    assert rows[0]["status"] == "submitted"
    assert "submitted" in r.json()["message"]
    types = [n["type"] for n in db["notifications"]]
    assert "application_submitted" in types


def test_submit_when_already_submitted_is_conflict(client):
    c, db, _ = client
    seed_app(db, status="submitted")
    r = c.post("/api/v1/caregivers/applications", json=PAYLOAD, headers=auth_headers("u-caregiver"))
    assert r.status_code == 409
    assert len(db["caregiver_applications"]) == 1
    assert db["caregiver_applications"][0]["status"] == "submitted"


def test_submit_when_approved_is_conflict(client):
    c, db, _ = client
    seed_app(db, status="approved")
    r = c.post("/api/v1/caregivers/applications", json=PAYLOAD, headers=auth_headers("u-caregiver"))
    assert r.status_code == 409
    assert len(db["caregiver_applications"]) == 1


def test_submit_when_rejected_flips_same_row_in_place(client):
    c, db, _ = client
    seed_app(db, status="rejected", reason="Missing CPR")
    r = c.post("/api/v1/caregivers/applications", json=PAYLOAD, headers=auth_headers("u-caregiver"))
    assert r.status_code == 200
    rows = db["caregiver_applications"]
    assert len(rows) == 1
    assert rows[0]["id"] == "app1"
    assert rows[0]["status"] == "submitted"
    assert rows[0]["rejection_reason"] is None
    assert rows[0]["reviewed_at"] is None
    assert "resubmitted" in r.json()["message"]
    types = [n["type"] for n in db["notifications"]]
    assert "application_resubmitted" in types


PUBLIC_PAYLOAD = {
    **PAYLOAD,
    "email": "jane@example.com",
    "password": "secret123",
}


def test_apply_public_creates_account_and_application(client):
    c, db, _ = client
    r = c.post("/api/v1/caregivers/apply-public", json=PUBLIC_PAYLOAD)
    assert r.status_code == 200
    apps = db["caregiver_applications"]
    assert len(apps) == 1
    assert apps[0]["status"] == "submitted"
    assert any(u["email"] == "jane@example.com" for u in db["users"])
    assert len(db["caregivers"]) == 1
    types = [n["type"] for n in db["notifications"]]
    assert "application_submitted" in types


def test_apply_public_rejects_bad_email(client):
    c, db, _ = client
    bad = {**PUBLIC_PAYLOAD, "email": "not-an-email"}
    r = c.post("/api/v1/caregivers/apply-public", json=bad)
    assert r.status_code == 422
    assert len(db["caregiver_applications"]) == 0