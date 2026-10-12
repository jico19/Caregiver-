import json
import logging

from fastapi.testclient import TestClient

from app.main import app
from app.core.logging_config import LOGS_DIR, _DEFAULT_LOGS_DIR


def _error_log_lines():
    error_log = LOGS_DIR / "error.log"
    if not error_log.exists():
        return []
    return [
        line for line in error_log.read_text(encoding="utf-8").splitlines() if line.strip()
    ]


def _app_log_text():
    app_log = LOGS_DIR / "app.log"
    assert app_log.exists()
    return app_log.read_text(encoding="utf-8")


def _access_log_text():
    access_log = LOGS_DIR / "access.log"
    if not access_log.exists():
        return ""
    return access_log.read_text(encoding="utf-8")


def test_unhandled_exception_returns_500_and_logs(client):
    # Add a temporary test route that triggers an unhandled crash
    @app.get("/api/v1/test-crash")
    def trigger_crash():
        raise RuntimeError("Deliberate test crash for error logging")

    # Use a client with raise_server_exceptions=False so exception handler runs
    test_client = TestClient(app, raise_server_exceptions=False)
    res = test_client.get("/api/v1/test-crash")

    assert res.status_code == 500
    data = res.json()
    assert data["detail"] == "Internal server error"
    assert "request_id" in data
    assert res.headers.get("X-Request-ID") == data["request_id"]

    matching = []
    for line in _error_log_lines():
        if "test-crash" not in line and "Deliberate test crash" not in line:
            continue
        record = json.loads(line)
        matching.append(record)

    assert matching, "expected at least one JSON error.log line for the crash"
    assert all("Request crashed" not in (r.get("message") or "") for r in matching)

    unhandled = [r for r in matching if "Unhandled exception" in (r.get("message") or "")]
    assert len(unhandled) == 1
    record = unhandled[0]
    assert record["level"] == "ERROR"
    assert record["exception_type"] == "RuntimeError"
    assert record["fingerprint"] == "RuntimeError|GET|/api/v1/test-crash"
    assert "Deliberate test crash for error logging" in record["message"]
    assert "occurred_at" in record
    assert record["occurred_at"].endswith(" UTC")
    assert "timestamp" in record
    assert "ts" in record


def test_validation_error_returns_422_and_logs_warning(client):
    # Missing required body fields triggers RequestValidationError
    test_client = TestClient(app, raise_server_exceptions=False)
    res = test_client.post("/api/v1/auth/login", json={})

    assert res.status_code == 422
    assert "detail" in res.json()
    assert "X-Request-ID" in res.headers

    marker = "Validation error on POST /api/v1/auth/login"
    error_text = "\n".join(_error_log_lines())
    assert marker not in error_text
    assert marker in _app_log_text()


def test_http_404_logs_warning_and_preserves_request_id(client):
    test_client = TestClient(app, raise_server_exceptions=False)
    res = test_client.get("/api/v1/non-existent-endpoint-12345")

    assert res.status_code == 404
    assert res.headers.get("X-Request-ID") is not None

    marker = "HTTP 404 on GET /api/v1/non-existent-endpoint-12345"
    error_text = "\n".join(_error_log_lines())
    assert marker not in error_text
    assert marker in _app_log_text()


def test_log_files_exist_in_logs_directory():
    assert LOGS_DIR.exists()
    assert LOGS_DIR.is_dir()
    assert (LOGS_DIR / "app.log").exists()
    assert (LOGS_DIR / "access.log").exists()
    assert (LOGS_DIR / "error.log").exists()
    assert _DEFAULT_LOGS_DIR.exists()
    assert (_DEFAULT_LOGS_DIR / ".gitkeep").exists()


def test_request_access_logs_routed_to_access_log(client):
    test_client, _, _ = client
    res = test_client.get("/api/v1/states/")
    assert res.status_code == 200

    access_content = _access_log_text()
    assert "GET /api/v1/states/" in access_content
    # Normal access log lines should not be written to app.log
    app_content = _app_log_text()
    assert "GET /api/v1/states/" not in app_content


def test_error_log_rejects_warnings(client):
    logging.getLogger("app").warning("probe-warning-must-not-enter-error-log")
    error_text = "\n".join(_error_log_lines())
    assert "probe-warning-must-not-enter-error-log" not in error_text
    assert "probe-warning-must-not-enter-error-log" in _app_log_text()
