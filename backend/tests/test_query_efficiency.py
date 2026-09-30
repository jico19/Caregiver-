import pytest
from tests.conftest import auth_headers
from app.api.routes.admin import _sanitize_audit_values


def test_list_caregivers_omits_signature_data(client):
    c, db, fake = client
    super_admin = auth_headers("u-admin")
    resp = c.get("/api/v1/admin/caregivers", headers=super_admin)
    assert resp.status_code == 200
    data = resp.json()
    apps = data.get("applications", [])
    for app in apps:
        assert "signature_data" not in app


def test_sanitize_audit_values_drops_signatures_and_blobs():
    raw_payload = {
        "status": "approved",
        "notes": "Valid note",
        "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
        "large_blob": "x" * 2500,
    }
    cleaned = _sanitize_audit_values(raw_payload)
    assert "signature_data" not in cleaned
    assert "large_blob" not in cleaned
    assert cleaned["status"] == "approved"
    assert cleaned["notes"] == "Valid note"


def test_schema_signature_data_max_length_rejection(client):
    c, db, fake = client
    super_admin = auth_headers("u-admin")
    oversized_sig = "data:image/png;base64," + ("A" * 300000)
    payload = {
        "state_id": 1,
        "first_name": "Test",
        "last_name": "User",
        "signature_data": oversized_sig,
        "signed_name": "Test User",
    }
    resp = c.post("/api/v1/caregivers/applications", json=payload, headers=super_admin)
    assert resp.status_code == 422


def test_offboard_user_correct_schema_columns(client):
    c, db, fake = client
    super_admin = auth_headers("u-admin")

    db["users"].append({
        "id": "u-offboard-test",
        "email": "offboard@example.com",
        "role_id": 2,
        "state_id": 1,
        "status": "active",
        "deleted_at": None,
    })
    db["caregivers"].append({
        "id": "u-offboard-test",
        "state_id": 1,
        "first_name": "Offboard",
        "last_name": "Target",
        "deleted_at": None,
    })

    resp = c.delete("/api/v1/admin/users/u-offboard-test", headers=super_admin)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "u-offboard-test"

    user_row = next(u for u in db["users"] if u["id"] == "u-offboard-test")
    assert user_row["status"] == "inactive"
    assert user_row["deleted_at"] is not None


def test_care_plan_batched_activity_insert(client):
    c, db, fake = client
    super_admin = auth_headers("u-admin")
    db["clients"].append({
        "id": "c-1",
        "state_id": 1,
        "first_name": "Test",
        "last_name": "Client",
        "status": "active",
        "deleted_at": None,
    })
    payload = {
        "status": "active",
        "primary_nurse": "Nurse Joy",
        "activities": [
            {"task": f"Task {i}", "frequency": "Daily", "sort_order": i}
            for i in range(15)
        ],
    }
    resp = c.put("/api/v1/admin/clients/c-1/care-plan", json=payload, headers=super_admin)
    assert resp.status_code == 200
    plan = resp.json().get("care_plan", {})
    assert len(plan.get("activities", [])) == 15
