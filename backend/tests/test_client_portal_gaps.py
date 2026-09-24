"""Client portal Iteration 1: intake e-sign, agreements, authorization self-service."""
from conftest import auth_headers

INTAKE_BODY = {
    "state_id": 1,
    "first_name": "Maya",
    "last_name": "Rivera",
    "phone": "(555) 111-2222",
    "medicaid_number": "FL12345",
}


def seed_client_profile(db, state_id=1):
    db["clients"].append({
        "id": "u-client",
        "state_id": state_id,
        "first_name": "Maya",
        "last_name": "Rivera",
    })


# ---------- intake e-signature ----------

def test_intake_requires_signature(client):
    c, db, _ = client
    r = c.post("/api/v1/clients/intake", json=INTAKE_BODY, headers=auth_headers("u-client"))
    assert r.status_code == 400
    assert "signature" in r.json()["detail"].lower()
    assert db["clients"] == []


def test_intake_requires_drawn_image_signature(client):
    c, db, _ = client
    r = c.post("/api/v1/clients/intake",
               json={**INTAKE_BODY, "signature_data": "not-an-image", "signed_name": "Maya Rivera"},
               headers=auth_headers("u-client"))
    assert r.status_code == 400
    assert "image" in r.json()["detail"].lower()


def test_intake_submit_persists_signature_and_audit(client):
    c, db, _ = client
    body = {**INTAKE_BODY, "signature_data": "data:image/png;base64,AAAA", "signed_name": "Maya Rivera"}
    r = c.post("/api/v1/clients/intake", json=body, headers=auth_headers("u-client"))
    assert r.status_code == 200
    row = db["clients"][0]
    assert row["signature_data"] == "data:image/png;base64,AAAA"
    assert row["signed_name"] == "Maya Rivera"
    assert row["signed_at"]
    assert any(l["action"] == "client_intake_signed" for l in db["audit_logs"])


# ---------- client agreements ----------

def test_agreements_list_templates_unsigned(client):
    c, db, _ = client
    r = c.get("/api/v1/clients/me/agreements", headers=auth_headers("u-client"))
    assert r.status_code == 200
    agreements = r.json()["agreements"]
    assert {a["agreement_key"] for a in agreements} == {"care_agreement", "client_rights"}
    assert all(a["signed"] is False for a in agreements)


def test_agreement_sign_upserts_and_audits(client):
    c, db, _ = client
    r = c.post("/api/v1/clients/me/agreements/care_agreement/sign",
               json={"signature_data": "data:image/png;base64,BBBB", "signed_name": "Maya Rivera"},
               headers=auth_headers("u-client"))
    assert r.status_code == 200
    row = db["client_agreements"][0]
    assert row["agreement_key"] == "care_agreement"
    assert row["signed_name"] == "Maya Rivera"
    assert any(l["action"] == "client_agreement_signed" for l in db["audit_logs"])
    assert any(n["type"] == "agreement_signed" for n in db["notifications"])

    r = c.get("/api/v1/clients/me/agreements", headers=auth_headers("u-client"))
    by_key = {a["agreement_key"]: a for a in r.json()["agreements"]}
    assert by_key["care_agreement"]["signed"] is True
    assert by_key["client_rights"]["signed"] is False


def test_agreement_sign_unknown_key_404(client):
    c, db, _ = client
    r = c.post("/api/v1/clients/me/agreements/nope/sign",
               json={"signature_data": "data:image/png;base64,BBBB", "signed_name": "Maya Rivera"},
               headers=auth_headers("u-client"))
    assert r.status_code == 404


# ---------- authorization self-service ----------

def test_authorization_upload_creates_pending(client):
    c, db, _ = client
    r = c.post(
        "/api/v1/clients/me/authorizations",
        files={"file": ("pa-letter.pdf", b"%PDF-1.4 test", "application/pdf")},
        data={"start_date": "2026-01-01", "end_date": "2027-01-01", "notes": "Renewal"},
        headers=auth_headers("u-client"),
    )
    assert r.status_code == 200
    auth = r.json()["authorization"]
    assert auth["status"] == "pending"
    assert auth["source"] == "client"
    assert auth["document_id"]
    assert db["documents"]
    assert any(n["type"] == "authorization_uploaded" for n in db["notifications"])


def test_authorization_upload_requires_valid_dates(client):
    c, db, _ = client
    r = c.post(
        "/api/v1/clients/me/authorizations",
        files={"file": ("pa-letter.pdf", b"%PDF-1.4 test", "application/pdf")},
        data={"start_date": "2027-01-01", "end_date": "2026-01-01"},
        headers=auth_headers("u-client"),
    )
    assert r.status_code == 400
    assert "End date" in r.json()["detail"]


def seed_pending_authorization(db, auth_id="auth-pending", doc_id="doc-auth"):
    db["authorizations"].append({
        "id": auth_id,
        "client_id": "u-client",
        "state_id": 1,
        "authorization_number": "PENDING-ABC123",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "status": "pending",
        "source": "client",
        "document_id": doc_id,
        "notes": "Submitted for review.",
    })
    db["documents"].append({
        "id": doc_id,
        "owner_id": "u-client",
        "document_type_id": 1,
        "status": "pending_review",
    })


def test_admin_review_approves_authorization_and_document(client):
    c, db, _ = client
    seed_pending_authorization(db)
    r = c.post("/api/v1/admin/authorizations/auth-pending/review",
               json={"status": "approved"}, headers=auth_headers("u-admin"))
    assert r.status_code == 200
    auth = next(a for a in db["authorizations"] if a["id"] == "auth-pending")
    assert auth["status"] == "active"
    assert auth["reviewed_by"] == "u-admin"
    doc = next(d for d in db["documents"] if d["id"] == "doc-auth")
    assert doc["status"] == "approved"
    assert any(l["action"] == "authorization_active" for l in db["audit_logs"])
    assert any(n["type"] == "authorization_approved" for n in db["notifications"])


def test_admin_review_rejects_authorization(client):
    c, db, _ = client
    seed_pending_authorization(db)
    r = c.post("/api/v1/admin/authorizations/auth-pending/review",
               json={"status": "rejected", "notes": "Incomplete paperwork"}, headers=auth_headers("u-admin"))
    assert r.status_code == 200
    auth = db["authorizations"][0]
    assert auth["status"] == "rejected"
    assert db["documents"][0]["status"] == "rejected"
    assert any(n["type"] == "authorization_rejected" for n in db["notifications"])


def test_admin_review_already_reviewed_409(client):
    c, db, _ = client
    seed_pending_authorization(db)
    r1 = c.post("/api/v1/admin/authorizations/auth-pending/review",
                json={"status": "approved"}, headers=auth_headers("u-admin"))
    assert r1.status_code == 200
    r2 = c.post("/api/v1/admin/authorizations/auth-pending/review",
                json={"status": "approved"}, headers=auth_headers("u-admin"))
    assert r2.status_code == 409


def test_authorization_history_includes_source(client):
    c, db, _ = client
    db["authorizations"].extend([
        {"id": "a1", "client_id": "u-client", "state_id": 1,
         "authorization_number": "AUTH-1", "start_date": "2026-01-01",
         "end_date": "2026-12-31", "status": "active", "source": "admin"},
        {"id": "a2", "client_id": "u-client", "state_id": 1,
         "authorization_number": "AUTH-2", "start_date": "2026-01-01",
         "end_date": "2026-12-31", "status": "pending", "source": "client"},
    ])
    r = c.get("/api/v1/clients/me/authorizations", headers=auth_headers("u-client"))
    assert r.status_code == 200
    records = r.json()["authorizations"]
    assert {a["source"] for a in records} == {"admin", "client"}
    assert {a["status"] for a in records} == {"active", "pending"}