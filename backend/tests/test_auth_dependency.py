import pytest
from tests.conftest import auth_headers
from app.core.dependencies import get_current_user, invalidate_user_cache


def test_auth_cache_and_invalidation(client):
    c, db, fake = client
    super_admin = auth_headers("u-admin")

    invalidate_user_cache()

    # First call fills cache
    resp1 = c.get("/api/v1/admin/caregivers", headers=super_admin)
    assert resp1.status_code == 200

    # Invalidate specific user cache
    invalidate_user_cache("u-admin")


def test_suspended_user_denied_access(client):
    c, db, fake = client
    invalidate_user_cache()

    # Mark user suspended in fake DB
    for u in db["users"]:
        if u["id"] == "u-caregiver":
            u["status"] = "suspended"

    susp_headers = auth_headers("u-caregiver")
    resp = c.get("/api/v1/caregivers/me", headers=susp_headers)
    assert resp.status_code == 403
    assert "suspended" in resp.json()["detail"].lower()


def test_deactivated_user_denied_access(client):
    c, db, fake = client
    invalidate_user_cache()

    # Soft delete user in fake DB
    for u in db["users"]:
        if u["id"] == "u-caregiver":
            u["deleted_at"] = "2026-09-30T00:00:00Z"

    del_headers = auth_headers("u-caregiver")
    resp = c.get("/api/v1/caregivers/me", headers=del_headers)
    assert resp.status_code in (401, 403)
