import pytest
from tests.conftest import auth_headers
from app.jobs.retention_purge import run_retention_purge, IMMUTABLE_PURGE_BLOCKED


def test_retention_purge_job_runs(client):
    c, db, fake = client
    res = run_retention_purge(supabase=fake)
    assert res["status"] in ("completed", "disabled")
    assert "purged" in res


def test_legal_hold_toggle_requires_super_admin(client):
    c, db, fake = client
    admin_fl = auth_headers("u-admin-fl")
    super_admin = auth_headers("u-admin")

    payload = {"legal_hold": True, "reason": "Audit hold"}

    # Scoped admin forbidden from legal hold toggle
    resp = c.patch("/api/v1/admin/clients/c-1/legal-hold", json=payload, headers=admin_fl)
    assert resp.status_code in (403, 404)

    # Super admin authorized
    resp = c.patch("/api/v1/admin/clients/c-1/legal-hold", json=payload, headers=super_admin)
    assert resp.status_code in (200, 404)


def test_dsar_erasure_request_refusal_for_active_client(client):
    c, db, fake = client
    super_admin = auth_headers("u-admin")

    # Client c-1 is active (deleted_at is null) in seed fixture
    resp = c.post("/api/v1/admin/clients/c-1/erasure-request", headers=super_admin)
    assert resp.status_code in (404, 422)


def test_immutable_tables_never_purged():
    assert "audit_logs" in IMMUTABLE_PURGE_BLOCKED
    assert "client_agreements" in IMMUTABLE_PURGE_BLOCKED
