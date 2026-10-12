import pytest
from tests.conftest import auth_headers


def test_admin_list_and_assign_training(client):
    c, db, fake = client
    admin_fl = auth_headers("u-admin-fl")
    super_admin = auth_headers("u-admin")
    caregiver = auth_headers("u-caregiver")

    # Caregiver forbidden (403 or 404)
    resp = c.get("/api/v1/admin/training", headers=caregiver)
    assert resp.status_code in (403, 404)

    # Scoped admin reads training
    resp = c.get("/api/v1/admin/training", headers=admin_fl)
    assert resp.status_code == 200
    data = resp.json()
    assert "enrollments" in data

    # Super admin reads training
    resp = c.get("/api/v1/admin/training", headers=super_admin)
    assert resp.status_code == 200


def test_assign_training_course(client):
    c, db, fake = client
    admin_fl = auth_headers("u-admin-fl")
    payload = {
        "caregiver_id": "u-caregiver",
        "course_id": "c-1",
        "due_at": "2026-12-31T23:59:59Z",
    }
    resp = c.post("/api/v1/admin/training", json=payload, headers=admin_fl)
    assert resp.status_code in (200, 404)


def test_admin_settings_document_requirements(client):
    c, db, fake = client
    admin_fl = auth_headers("u-admin-fl")
    caregiver = auth_headers("u-caregiver")

    # Caregiver denied
    resp = c.get("/api/v1/admin/settings/document-requirements", headers=caregiver)
    assert resp.status_code in (403, 404)

    # Scoped admin reads requirements
    resp = c.get("/api/v1/admin/settings/document-requirements", headers=admin_fl)
    assert resp.status_code == 200
    data = resp.json()
    assert "requirements" in data
