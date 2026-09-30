"""Audit trail hardening tests: metadata capture, fail-closed signatures, agreement versioning, state-scoping."""
import pytest
from conftest import auth_headers
from app.core.config import settings
from app.api.routes.admin import record_audit_log


def test_record_audit_log_captures_request_metadata(client):
    c, db, fake = client
    # Dummy request class for testing metadata extraction
    class DummyState:
        request_id = "req-12345"

    class DummyClient:
        host = "192.168.1.50"

    class DummyRequest:
        headers = {"user-agent": "TestBrowser/1.0", "x-forwarded-for": "10.0.0.1"}
        state = DummyState()
        client = DummyClient()

    req = DummyRequest()
    record_audit_log(
        fake,
        user_id="u-admin",
        action="test_action",
        table_name="test_table",
        record_id="rec-1",
        request=req,
    )
    assert len(db["audit_logs"]) == 1
    log = db["audit_logs"][0]
    assert log["user_agent"] == "TestBrowser/1.0"
    assert log["request_id"] == "req-12345"
    # By default TRUST_FORWARDED_FOR is False, so peer host is used
    assert log["ip_address"] == "192.168.1.50"


def test_record_audit_log_trusted_proxy_forwarded_for(client):
    c, db, fake = client
    class DummyState:
        request_id = "req-999"

    class DummyRequest:
        headers = {"user-agent": "TestBrowser/1.0", "x-forwarded-for": "203.0.113.195, 10.0.0.1"}
        state = DummyState()
        client = None

    req = DummyRequest()
    settings.TRUST_FORWARDED_FOR = True
    try:
        record_audit_log(
            fake,
            user_id="u-admin",
            action="test_proxy",
            table_name="test_table",
            record_id="rec-2",
            request=req,
        )
        assert db["audit_logs"][-1]["ip_address"] == "203.0.113.195"
    finally:
        settings.TRUST_FORWARDED_FOR = False


from fastapi import HTTPException


def test_signature_fail_closed_mode():
    class FailingSupabase:
        def table(self, name):
            raise RuntimeError("DB audit insert connection error")

    with pytest.raises(HTTPException) as exc_info:
        record_audit_log(
            FailingSupabase(),
            user_id="u-client",
            action="client_agreement_signed",
            table_name="client_agreements",
            record_id="ag-1",
            required=True,
        )
    assert exc_info.value.status_code == 500


def test_non_signature_fail_open_mode():
    class FailingSupabase:
        def table(self, name):
            raise RuntimeError("DB audit insert connection error")

    # Non-required audit log failure does not raise an exception
    record_audit_log(
        FailingSupabase(),
        user_id="u-admin",
        action="regular_action",
        table_name="users",
        record_id="u-1",
        required=False,
    )


def test_agreement_versioning_and_content_hash(client):
    c, db, _ = client
    db["clients"].append({"id": "u-client", "state_id": 1, "first_name": "Test", "last_name": "Client"})
    
    # First sign
    payload1 = {
        "signed_name": "Test Client",
        "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    }
    r1 = c.post("/api/v1/clients/me/agreements/care_agreement/sign", json=payload1, headers=auth_headers("u-client"))
    assert r1.status_code == 200, r1.text
    ag1 = r1.json()["agreement"]
    assert ag1["version"] == 1
    assert ag1["content_hash"]

    # Re-sign increments version
    r2 = c.post("/api/v1/clients/me/agreements/care_agreement/sign", json=payload1, headers=auth_headers("u-client"))
    assert r2.status_code == 200, r2.text
    ag2 = r2.json()["agreement"]
    assert ag2["version"] == 2

    # Check agreement history
    rh = c.get("/api/v1/clients/me/agreements/care_agreement/history", headers=auth_headers("u-client"))
    assert rh.status_code == 200, rh.text
    history = rh.json()["history"]
    assert len(history) == 2
    assert [h["version"] for h in history] == [2, 1]


def test_login_logout_and_failed_login_auditing(client):
    c, db, _ = client
    # 1. Failed login
    r_fail = c.post("/api/v1/auth/login", json={"email": "nonexistent@test.com", "password": "wrongpassword"})
    assert r_fail.status_code == 401
    failed_logs = [log for log in db["audit_logs"] if log.get("action") == "user_login_failed"]
    assert len(failed_logs) == 1

    # 2. Successful login
    r_succ = c.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "password"})
    assert r_succ.status_code == 200
    succ_logs = [log for log in db["audit_logs"] if log.get("action") == "user_login_success"]
    assert len(succ_logs) == 1

    # 3. Logout
    r_out = c.post("/api/v1/auth/logout", headers=auth_headers("u-admin"))
    assert r_out.status_code == 200
    out_logs = [log for log in db["audit_logs"] if log.get("action") == "user_logout"]
    assert len(out_logs) == 1


def test_audit_logs_endpoint_state_scoping(client):
    c, db, _ = client
    db["users"].extend([
        {"id": "user-fl", "email": "fl@test.com", "state_id": 1},
        {"id": "user-in", "email": "in@test.com", "state_id": 2},
    ])
    db["audit_logs"].extend([
        {"id": "log-fl", "user_id": "user-fl", "action": "fl_action", "entity_state_id": 1, "created_at": "2026-09-01T00:00:00Z"},
        {"id": "log-in", "user_id": "user-in", "action": "in_action", "entity_state_id": 2, "created_at": "2026-09-02T00:00:00Z"},
    ])

    # Florida admin sees FL logs only
    r_fl = c.get("/api/v1/admin/audit-logs", headers=auth_headers("u-admin-fl"))
    assert r_fl.status_code == 200, r_fl.text
    fl_items = r_fl.json()["audit_logs"]
    assert len(fl_items) == 1
    assert fl_items[0]["action"] == "fl_action"

    # Super admin sees all logs
    r_super = c.get("/api/v1/admin/audit-logs", headers=auth_headers("u-admin"))
    assert r_super.status_code == 200, r_super.text
    super_items = r_super.json()["audit_logs"]
    assert len(super_items) >= 2
