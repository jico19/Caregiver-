"""Tests for the admin aggregate reports endpoint (GET /admin/reports).

The reports endpoint computes all six SOW reports Python-side (no relational
joins), so tests seed plain rows into the in-memory fake and assert on the
computed aggregates.
"""
from datetime import date, timedelta

from conftest import auth_headers


def seed_doc_types(db):
    db["document_types"] += [
        {"id": 10, "name": "CPR Certification", "for_role": "caregiver", "requires_expiration": True},
        {"id": 11, "name": "TB Test", "for_role": "caregiver", "requires_expiration": True},
        {"id": 12, "name": "Background Check", "for_role": "caregiver", "requires_expiration": False},
    ]


def seed_caregivers(db):
    db["caregivers"] += [
        {"id": "u-caregiver", "state_id": 1, "first_name": "Amara", "last_name": "Okafor"},
        {"id": "u-cg2", "state_id": 2, "first_name": "Ben", "last_name": "Reyes"},
    ]


def seed_requirements(db):
    db["document_requirements"] += [
        {"state_id": 1, "document_type_id": 10, "required": True},
        {"state_id": 1, "document_type_id": 11, "required": True},
        {"state_id": 1, "document_type_id": 12, "required": True},
        {"state_id": 2, "document_type_id": 10, "required": True},
    ]


def seed_docs(db):
    today = date.today()
    db["documents"] += [
        {"id": "doc-cpr-1", "owner_id": "u-caregiver", "document_type_id": 10, "state_id": 1,
         "storage_path": "x", "status": "approved",
         "expiration_date": (today + timedelta(days=10)).isoformat()},
        {"id": "doc-tb-1", "owner_id": "u-caregiver", "document_type_id": 11, "state_id": 1,
         "storage_path": "x", "status": "approved",
         "expiration_date": (today - timedelta(days=5)).isoformat()},
        {"id": "doc-cpr-2", "owner_id": "u-cg2", "document_type_id": 10, "state_id": 2,
         "storage_path": "x", "status": "approved",
         "expiration_date": (today + timedelta(days=365)).isoformat()},
    ]


def seed_auths(db):
    today = date.today()
    db["clients"] += [
        {"id": "u-client", "state_id": 1, "first_name": "Maya", "last_name": "Rivera"},
    ]
    db["authorizations"] += [
        {"id": "auth-1", "client_id": "u-client", "state_id": 1, "authorization_number": "AUTH-001",
         "start_date": (today - timedelta(days=30)).isoformat(),
         "end_date": (today + timedelta(days=60)).isoformat(), "status": "active"},
        {"id": "auth-2", "client_id": "u-client", "state_id": 1, "authorization_number": "AUTH-002",
         "start_date": (today - timedelta(days=30)).isoformat(),
         "end_date": (today - timedelta(days=5)).isoformat(), "status": "expired"},
    ]


def seed_trainings(db):
    db["training_courses"] += [
        {"id": "course-1", "state_id": 1, "name": "Direct Care Basics", "active": True},
    ]
    db["training_enrollments"] += [
        {"id": "enr-1", "course_id": "course-1", "caregiver_id": "u-caregiver", "status": "completed"},
        {"id": "enr-2", "course_id": "course-1", "caregiver_id": "u-cg2", "status": "in_progress"},
    ]


def seed_referrals(db):
    db["client_referrals"] += [
        {"id": "ref-1", "state_id": 1, "first_name": "Ana", "last_name": "Lopez",
         "referral_source": "Website Inquiry", "status": "new", "created_at": "2026-09-01T10:00:00Z"},
        {"id": "ref-2", "state_id": 2, "first_name": "Ivy", "last_name": "Nguyen",
         "referral_source": "Website Inquiry", "status": "contacted", "created_at": "2026-09-02T10:00:00Z"},
        {"id": "ref-3", "state_id": 1, "first_name": "Cal", "last_name": "Brown",
         "referral_source": "Physician", "status": "converted", "created_at": "2026-09-03T10:00:00Z"},
    ]


def get(client, token_key="u-admin"):
    return client.get("/api/v1/admin/reports", headers=auth_headers(token_key))


def test_reports_require_admin(client):
    c, db, _ = client
    assert c.get("/api/v1/admin/reports", headers=auth_headers("u-caregiver")).status_code == 403
    assert c.get("/api/v1/admin/reports", headers=auth_headers("u-client")).status_code == 403


def test_reports_empty_db(client):
    c, db, _ = client
    data = get(c).json()
    assert data["caregiver_compliance"] == {"total": 0, "compliant": 0, "rows": []}
    assert data["expiring_credentials"] == {"total": 0, "rows": []}
    assert data["training_completion"] == {"total_courses": 0, "rows": []}
    assert data["client_authorizations"] == {
        "summary": {"active": 0, "expiring_soon": 0, "expired": 0, "pending": 0, "rejected": 0},
        "rows": [],
    }
    assert data["referral_sources"] == {"total": 0, "rows": []}
    assert data["website_inquiries"] == {"total": 0, "by_state": [], "recent": []}


def test_caregiver_compliance(client):
    c, db, _ = client
    seed_doc_types(db)
    seed_caregivers(db)
    seed_requirements(db)
    seed_docs(db)

    report = get(c).json()["caregiver_compliance"]
    assert report["total"] == 2
    assert report["compliant"] == 1

    rows = {r["name"]: r for r in report["rows"]}
    amara = rows["Amara Okafor"]
    assert amara["state_code"] == "FL"
    assert amara["email"] == "caregiver@test.com"
    assert amara["missing"] == 1
    assert amara["missing_names"] == ["Background Check"]
    assert amara["expired"] == 1
    assert amara["expiring_soon"] == 1
    assert amara["valid"] == 0
    assert amara["compliant"] is False

    ben = rows["Ben Reyes"]
    assert ben["state_code"] == "IN"
    assert ben["email"] is None
    assert ben["missing"] == 0
    assert ben["expired"] == 0
    assert ben["expiring_soon"] == 0
    assert ben["valid"] == 1
    assert ben["compliant"] is True


def test_expiring_credential_report(client):
    c, db, _ = client
    seed_doc_types(db)
    seed_caregivers(db)
    seed_requirements(db)
    seed_docs(db)

    report = get(c).json()["expiring_credentials"]
    assert report["total"] == 2
    by_doc = {r["document_name"]: r for r in report["rows"]}

    cpr = by_doc["CPR Certification"]
    assert cpr["caregiver_name"] == "Amara Okafor"
    assert cpr["state_code"] == "FL"
    assert cpr["days_remaining"] == 10
    assert cpr["status"] == "expiring_soon"

    tb = by_doc["TB Test"]
    assert tb["caregiver_name"] == "Amara Okafor"
    assert tb["days_remaining"] == -5
    assert tb["status"] == "expired"


def test_training_completion_report(client):
    c, db, _ = client
    seed_trainings(db)

    report = get(c).json()["training_completion"]
    assert report["total_courses"] == 1
    row = report["rows"][0]
    assert row["course_id"] == "course-1"
    assert row["name"] == "Direct Care Basics"
    assert row["state_code"] == "FL"
    assert row["enrolled"] == 2
    assert row["completed"] == 1
    assert row["completion_pct"] == 50


def test_client_authorizations_report(client):
    c, db, _ = client
    seed_auths(db)

    report = get(c).json()["client_authorizations"]
    assert report["summary"]["active"] == 1
    assert report["summary"]["expired"] == 1
    assert report["summary"]["expiring_soon"] == 0

    rows = {r["authorization_number"]: r for r in report["rows"]}
    active = rows["AUTH-001"]
    assert active["client_name"] == "Maya Rivera"
    assert active["state_code"] == "FL"
    assert active["status"] == "active"
    assert active["days_left"] == 60
    assert rows["AUTH-002"]["days_left"] == -5


def test_referral_source_report(client):
    c, db, _ = client
    seed_referrals(db)

    report = get(c).json()["referral_sources"]
    assert report["total"] == 3
    rows = {r["source"]: r for r in report["rows"]}

    website = rows["Website Inquiry"]
    assert website["count"] == 2
    assert {s["code"]: s["count"] for s in website["states"]} == {"FL": 1, "IN": 1}

    physician = rows["Physician"]
    assert physician["count"] == 1
    assert {s["code"]: s["count"] for s in physician["states"]} == {"FL": 1}


def test_website_inquiry_report(client):
    c, db, _ = client
    seed_referrals(db)

    report = get(c).json()["website_inquiries"]
    assert report["total"] == 2
    assert {r["code"]: r["count"] for r in report["by_state"]} == {"FL": 1, "IN": 1}
    assert {r["first_name"] for r in report["recent"]} == {"Ana", "Ivy"}