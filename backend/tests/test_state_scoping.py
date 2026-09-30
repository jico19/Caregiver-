"""State-scoped authorization boundary.

The negative cases are the point of this file. A test suite that only proves
"Florida admin can reach Florida" does not prove a boundary exists; these
assert the denials that make the boundary real.

Fixture principals (see conftest.USERS):
    u-admin      super_admin, state_id NULL  -> all states
    u-admin-fl   administrator, state_id 1   -> Florida only
    u-admin-in   administrator, state_id 2   -> Indiana only
    u-admin-ga   administrator, state_id 3   -> Georgia only
"""
import pytest

from conftest import auth_headers

SUPER = "u-admin"
FL, IN, GA = "u-admin-fl", "u-admin-in", "u-admin-ga"

STATE_IDS = {"FL": 1, "IN": 2, "GA": 3}

STATE_ADMINS = [FL, IN, GA]
ALL_ADMINS = [FL, IN, GA, SUPER]


def seed_three_states(db):
    """One caregiver, application, client, document, authorization and
    referral per state, so cross-state access is always observable."""
    for code, sid in STATE_IDS.items():
        db["caregivers"].append({
            "id": f"cg-{code}", "state_id": sid,
            "first_name": f"Care{code}", "last_name": "Giver",
        })
        db["caregiver_applications"].append({
            "id": f"app-{code}", "caregiver_id": f"cg-{code}", "state_id": sid,
            "status": "submitted", "created_at": "2026-09-01T00:00:00Z",
        })
        db["clients"].append({
            "id": f"cl-{code}", "state_id": sid,
            "first_name": f"Cli{code}", "last_name": "Ent",
        })
        db["documents"].append({
            "id": f"doc-{code}", "owner_id": f"cg-{code}", "state_id": sid,
            "document_type_id": 1, "storage_path": f"{code}/doc.pdf",
            "status": "pending_review",
        })
        db["authorizations"].append({
            "id": f"auth-{code}", "client_id": f"cl-{code}", "state_id": sid,
            "authorization_number": f"AUTH-{code}",
            "start_date": "2026-01-01", "end_date": "2026-12-31",
            "status": "active",
        })
        db["client_referrals"].append({
            "id": f"ref-{code}", "state_id": sid,
            "first_name": "Ref", "last_name": code,
            "status": "new", "created_at": "2026-09-01T00:00:00Z",
        })


def get(c, admin, path):
    return c.get(path, headers=auth_headers(admin))


# ---------------------------------------------------------------- matrix


@pytest.mark.parametrize("admin,code", [
    (FL, "FL"), (IN, "IN"), (GA, "GA"),
    (SUPER, "FL"), (SUPER, "IN"), (SUPER, "GA"),
])
def test_admin_reads_application_in_permitted_state(client, admin, code):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, admin, f"/api/v1/admin/caregivers/app-{code}")
    assert r.status_code == 200, r.text


@pytest.mark.parametrize("admin,code", [
    (FL, "IN"), (FL, "GA"),
    (IN, "FL"), (IN, "GA"),
    (GA, "FL"), (GA, "IN"),
])
def test_admin_denied_application_in_other_state(client, admin, code):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, admin, f"/api/v1/admin/caregivers/app-{code}")
    assert r.status_code == 403, r.text


@pytest.mark.parametrize("admin,expected", [
    (FL, ["app-FL"]),
    (IN, ["app-IN"]),
    (GA, ["app-GA"]),
    (SUPER, ["app-FL", "app-GA", "app-IN"]),
])
def test_application_list_returns_only_permitted_states(client, admin, expected):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, admin, "/api/v1/admin/caregivers")
    assert r.status_code == 200, r.text
    body = r.json()
    assert sorted(a["id"] for a in body["applications"]) == sorted(expected)
    assert body["total"] == len(expected)


# ---------------------------------------------------------------- object-ID attacks


@pytest.mark.parametrize("admin,code", [
    (FL, "IN"), (FL, "GA"), (IN, "FL"), (IN, "GA"), (GA, "FL"), (GA, "IN"),
])
def test_admin_denied_other_state_client_by_id(client, admin, code):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, admin, f"/api/v1/admin/clients/cl-{code}")
    assert r.status_code == 403, r.text


@pytest.mark.parametrize("admin,code", [(FL, "FL"), (IN, "IN"), (GA, "GA"), (SUPER, "GA")])
def test_admin_allowed_own_state_client_by_id(client, admin, code):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, admin, f"/api/v1/admin/clients/cl-{code}")
    assert r.status_code == 200, r.text


@pytest.mark.parametrize("admin,code", [(FL, "IN"), (FL, "GA"), (IN, "FL"), (GA, "IN")])
def test_admin_denied_care_plan_for_other_state(client, admin, code):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, admin, f"/api/v1/admin/clients/cl-{code}/care-plan")
    assert r.status_code == 403, r.text


@pytest.mark.parametrize("admin,code", [(FL, "IN"), (IN, "GA"), (GA, "FL")])
def test_admin_denied_schedule_for_other_state(client, admin, code):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, admin, f"/api/v1/admin/clients/cl-{code}/schedule")
    assert r.status_code == 403, r.text


# ---------------------------------------------------------------- mutations


@pytest.mark.parametrize("admin,code", [(FL, "IN"), (FL, "GA"), (IN, "FL"), (GA, "IN")])
def test_admin_cannot_review_other_state_application(client, admin, code):
    """The denial must happen before the write, not after."""
    c, db, _ = client
    seed_three_states(db)
    r = c.post(
        f"/api/v1/admin/caregivers/app-{code}/review",
        json={"status": "under_review"},
        headers=auth_headers(admin),
    )
    assert r.status_code == 403, r.text
    row = next(a for a in db["caregiver_applications"] if a["id"] == f"app-{code}")
    assert row["status"] == "submitted", "record was mutated despite the denial"


def test_admin_can_review_own_state_application(client):
    c, db, _ = client
    seed_three_states(db)
    r = c.post(
        "/api/v1/admin/caregivers/app-FL/review",
        json={"status": "under_review"},
        headers=auth_headers(FL),
    )
    assert r.status_code == 200, r.text


@pytest.mark.parametrize("admin,code", [(FL, "IN"), (IN, "GA"), (GA, "FL")])
def test_admin_cannot_review_other_state_document(client, admin, code):
    c, db, _ = client
    seed_three_states(db)
    r = c.post(
        f"/api/v1/admin/documents/doc-{code}/review",
        json={"status": "approved"},
        headers=auth_headers(admin),
    )
    assert r.status_code == 403, r.text
    row = next(d for d in db["documents"] if d["id"] == f"doc-{code}")
    assert row["status"] == "pending_review", "document mutated despite the denial"


def test_admin_can_review_own_state_document(client):
    c, db, _ = client
    seed_three_states(db)
    r = c.post(
        "/api/v1/admin/documents/doc-FL/review",
        json={"status": "approved"},
        headers=auth_headers(FL),
    )
    assert r.status_code == 200, r.text


@pytest.mark.parametrize("admin,code", [(FL, "IN"), (IN, "GA"), (GA, "FL")])
def test_admin_cannot_update_other_state_referral(client, admin, code):
    c, db, _ = client
    seed_three_states(db)
    r = c.patch(
        f"/api/v1/admin/referrals/ref-{code}",
        json={"status": "contacted"},
        headers=auth_headers(admin),
    )
    assert r.status_code == 403, r.text
    row = next(x for x in db["client_referrals"] if x["id"] == f"ref-{code}")
    assert row["status"] == "new", "referral mutated despite the denial"


@pytest.mark.parametrize("admin,code", [(FL, "IN"), (IN, "GA"), (GA, "FL")])
def test_admin_cannot_create_authorization_for_other_state_client(client, admin, code):
    c, db, _ = client
    seed_three_states(db)
    r = c.post(
        "/api/v1/admin/authorizations",
        json={
            "client_id": f"cl-{code}",
            "state_id": STATE_IDS[code],
            "authorization_number": "X-1",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
        },
        headers=auth_headers(admin),
    )
    assert r.status_code == 403, r.text
    assert not any(a["authorization_number"] == "X-1" for a in db["authorizations"])


def test_admin_cannot_create_authorization_with_mismatched_state(client):
    """A client-supplied state must not be able to contradict the client row."""
    c, db, _ = client
    seed_three_states(db)
    r = c.post(
        "/api/v1/admin/authorizations",
        json={
            "client_id": "cl-FL",
            "state_id": 2,
            "authorization_number": "MISMATCH-1",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
        },
        headers=auth_headers(SUPER),
    )
    assert r.status_code == 400, r.text
    assert not any(a["authorization_number"] == "MISMATCH-1" for a in db["authorizations"])


def test_admin_can_create_authorization_for_own_state_client(client):
    c, db, _ = client
    seed_three_states(db)
    r = c.post(
        "/api/v1/admin/authorizations",
        json={
            "client_id": "cl-FL",
            "state_id": 1,
            "authorization_number": "OK-1",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
        },
        headers=auth_headers(FL),
    )
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------- documents


@pytest.mark.parametrize("code", ["FL", "IN", "GA"])
def test_super_admin_gets_signed_url_for_any_state_document(client, code):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, SUPER, f"/api/v1/documents/doc-{code}/download-url")
    assert r.status_code == 200, r.text
    assert r.json()["download_url"]


@pytest.mark.parametrize("admin,code", [
    (FL, "IN"), (FL, "GA"), (IN, "FL"), (IN, "GA"), (GA, "FL"), (GA, "IN"),
])
def test_state_admin_denied_signed_url_for_other_state_document(client, admin, code):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, admin, f"/api/v1/documents/doc-{code}/download-url")
    assert r.status_code == 403, r.text
    assert "download_url" not in r.json()


def test_state_admin_allowed_signed_url_for_own_state_document(client):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, FL, "/api/v1/documents/doc-FL/download-url")
    assert r.status_code == 200, r.text
    assert r.json()["download_url"]


def test_document_without_state_denied_to_state_admin(client):
    """Fail-closed: an unassigned document could belong to any state."""
    c, db, _ = client
    seed_three_states(db)
    db["documents"].append({
        "id": "doc-null", "owner_id": "cg-IN", "state_id": None,
        "document_type_id": 1, "storage_path": "orphan/doc.pdf",
        "status": "pending_review",
    })
    assert get(c, FL, "/api/v1/documents/doc-null/download-url").status_code == 403
    assert get(c, SUPER, "/api/v1/documents/doc-null/download-url").status_code == 200


def test_state_admin_document_list_is_state_scoped(client):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, FL, "/api/v1/admin/documents")
    assert r.status_code == 200, r.text
    body = r.json()
    assert [d["id"] for d in body["documents"]] == ["doc-FL"]
    assert body["total"] == 1


# ---------------------------------------------------------------- reports


def test_fl_admin_report_contains_only_florida(client):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, FL, "/api/v1/admin/reports")
    assert r.status_code == 200, r.text
    body = r.json()

    assert body["caregiver_compliance"]["total"] == 1
    assert [x["caregiver_id"] for x in body["caregiver_compliance"]["rows"]] == ["cg-FL"]
    assert len(body["client_authorizations"]["rows"]) == 1
    assert body["client_authorizations"]["rows"][0]["state_code"] == "FL"
    assert body["website_inquiries"]["total"] == 1

    for row in body["caregiver_compliance"]["rows"]:
        assert row["state_code"] == "FL"
    for row in body["expiring_credentials"]["rows"]:
        assert row["state_code"] == "FL"


def test_super_admin_report_spans_all_states(client):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, SUPER, "/api/v1/admin/reports")
    assert r.status_code == 200, r.text
    body = r.json()

    assert body["caregiver_compliance"]["total"] == 3
    assert len(body["client_authorizations"]["rows"]) == 3
    assert {row["state_code"] for row in body["client_authorizations"]["rows"]} == {"FL", "IN", "GA"}
    assert body["website_inquiries"]["total"] == 3


def test_report_training_completion_is_scoped_to_permitted_caregivers(client):
    """training_enrollments has no state_id, so scoping runs through caregiver_id."""
    c, db, _ = client
    seed_three_states(db)
    db["training_courses"].append({"id": "crs-1", "state_id": None, "name": "Company Wide", "active": True})
    db["training_enrollments"].append({"id": "e-fl", "course_id": "crs-1", "caregiver_id": "cg-FL", "status": "completed"})
    db["training_enrollments"].append({"id": "e-in", "course_id": "crs-1", "caregiver_id": "cg-IN", "status": "completed"})

    fl = get(c, FL, "/api/v1/admin/reports").json()
    row = next(x for x in fl["training_completion"]["rows"] if x["course_id"] == "crs-1")
    assert row["enrolled"] == 1, "Indiana enrollment leaked into a Florida report"

    sup = get(c, SUPER, "/api/v1/admin/reports").json()
    row = next(x for x in sup["training_completion"]["rows"] if x["course_id"] == "crs-1")
    assert row["enrolled"] == 2


# ---------------------------------------------------------------- client-supplied filters


def test_state_admin_cannot_filter_referrals_to_another_state(client):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, FL, "/api/v1/admin/referrals?state_id=2")
    assert r.status_code == 403, r.text


def test_state_admin_can_filter_referrals_to_own_state(client):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, FL, "/api/v1/admin/referrals?state_id=1")
    assert r.status_code == 200, r.text
    assert [x["id"] for x in r.json()["referrals"]] == ["ref-FL"]


def test_state_admin_cannot_request_another_state_dashboard(client):
    c, db, _ = client
    seed_three_states(db)
    assert get(c, FL, "/api/v1/admin/dashboard?state=georgia").status_code == 403
    assert get(c, FL, "/api/v1/admin/dashboard?state=florida").status_code == 200


def test_dashboard_counts_are_scoped_even_without_a_filter(client):
    """Omitting the state param must not widen the result to all states."""
    c, db, _ = client
    seed_three_states(db)
    fl = get(c, FL, "/api/v1/admin/dashboard").json()["metrics"]
    sup = get(c, SUPER, "/api/v1/admin/dashboard").json()["metrics"]
    assert fl["total_caregivers"] == 1
    assert sup["total_caregivers"] == 3


# ---------------------------------------------------------------- announcements


def test_state_admin_cannot_post_announcement_to_another_state(client):
    c, db, _ = client
    seed_three_states(db)
    r = c.post(
        "/api/v1/admin/announcements",
        json={"title": "t", "body": "b", "audience": "all", "state_id": 2},
        headers=auth_headers(FL),
    )
    assert r.status_code == 403, r.text


def test_state_admin_announcement_is_pinned_to_own_state(client):
    """An omitted state must not publish company-wide from a scoped admin."""
    c, db, _ = client
    seed_three_states(db)
    r = c.post(
        "/api/v1/admin/announcements",
        json={"title": "t", "body": "b", "audience": "all"},
        headers=auth_headers(FL),
    )
    assert r.status_code == 200, r.text
    assert r.json()["announcement"]["state_id"] == 1


def test_super_admin_may_post_global_announcement(client):
    c, db, _ = client
    seed_three_states(db)
    r = c.post(
        "/api/v1/admin/announcements",
        json={"title": "t", "body": "b", "audience": "all"},
        headers=auth_headers(SUPER),
    )
    assert r.status_code == 200, r.text
    assert r.json()["announcement"]["state_id"] is None


def test_state_admin_cannot_delete_other_state_announcement(client):
    c, db, _ = client
    seed_three_states(db)
    db["announcements"].append({"id": "ann-in", "title": "t", "body": "b", "state_id": 2, "audience": "all"})
    assert c.delete("/api/v1/admin/announcements/ann-in", headers=auth_headers(FL)).status_code == 403
    assert any(a["id"] == "ann-in" for a in db["announcements"])


def test_state_admin_cannot_retarget_announcement_to_global(client):
    """An explicit null must not widen an announcement's reach."""
    c, db, _ = client
    seed_three_states(db)
    db["announcements"].append({"id": "ann-fl", "title": "t", "body": "b", "state_id": 1, "audience": "all"})
    r = c.patch(
        "/api/v1/admin/announcements/ann-fl",
        json={"state_id": None},
        headers=auth_headers(FL),
    )
    assert r.status_code == 200, r.text
    row = next(a for a in db["announcements"] if a["id"] == "ann-fl")
    assert row["state_id"] == 1, "announcement was made global by a scoped admin"


# ---------------------------------------------------------------- self-service escalation


def test_caregiver_cannot_change_own_state_via_profile(client):
    c, db, _ = client
    seed_three_states(db)
    db["caregivers"].append({"id": "u-caregiver", "state_id": 1, "first_name": "Sarah", "last_name": "Jenkins"})
    r = c.patch(
        "/api/v1/caregivers/me/profile",
        json={"state_id": 2, "first_name": "Sarah", "last_name": "Jenkins"},
        headers=auth_headers("u-caregiver"),
    )
    assert r.status_code == 403, r.text
    row = next(u for u in db["users"] if u["id"] == "u-caregiver")
    assert row["state_id"] == 1, "self-service payload moved the user to another state"


def test_caregiver_can_still_edit_profile_without_changing_state(client):
    c, db, _ = client
    seed_three_states(db)
    db["caregivers"].append({"id": "u-caregiver", "state_id": 1, "first_name": "Sarah", "last_name": "Jenkins"})
    r = c.patch(
        "/api/v1/caregivers/me/profile",
        json={"state_id": 1, "first_name": "Sarah", "last_name": "Jenkins", "phone": "555-0100"},
        headers=auth_headers("u-caregiver"),
    )
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------- ownership preserved


def test_caregiver_cannot_read_another_caregivers_document(client):
    """Ownership isolation must survive the admin fix."""
    c, db, _ = client
    seed_three_states(db)
    db["caregivers"].append({"id": "u-caregiver", "state_id": 1, "first_name": "Me", "last_name": "Myself"})
    db["documents"].append({
        "id": "doc-mine", "owner_id": "u-caregiver", "state_id": 1,
        "document_type_id": 1, "storage_path": "mine/doc.pdf", "status": "pending_review",
    })
    assert get(c, "u-caregiver", "/api/v1/documents/doc-mine/download-url").status_code == 200
    assert get(c, "u-caregiver", "/api/v1/documents/doc-FL/download-url").status_code == 403


def test_caregiver_cannot_read_another_state_admin_only_resource(client):
    c, db, _ = client
    seed_three_states(db)
    assert get(c, "u-caregiver", "/api/v1/admin/clients/cl-FL").status_code == 403
    assert get(c, "u-client", "/api/v1/admin/reports").status_code == 403


# ---------------------------------------------------------------- fail-closed


def test_administrator_without_a_state_is_denied_everything(client):
    """A misconfigured admin must not silently become unrestricted."""
    c, db, fake = client
    seed_three_states(db)
    db["users"].append({
        "id": "u-admin-null", "email": "null@test.com", "role_id": 4,
        "state_id": None, "status": "active", "roles": {"name": "administrator"},
    })
    fake.auth.token_map["token-u-admin-null"] = {
        "id": "u-admin-null", "email": "null@test.com",
    }
    r = get(c, "u-admin-null", "/api/v1/admin/clients")
    assert r.status_code == 403, r.text
    assert "not assigned to a state" in r.json()["detail"]


def test_state_admin_dashboard_rejects_unknown_state_slug_without_widening(client):
    c, db, _ = client
    seed_three_states(db)
    r = get(c, FL, "/api/v1/admin/dashboard?state=not-a-state")
    assert r.status_code == 200, r.text
    assert r.json()["metrics"]["total_caregivers"] == 1


def test_referral_submission_notifies_state_admin_and_super_admin(client):
    """A referral in Florida notifies Florida admin and super_admin, never Indiana or Georgia admin."""
    c, db, _ = client
    payload = {
        "first_name": "Jane",
        "last_name": "Doe",
        "phone": "555-0199",
        "email": "jane@example.com",
        "referral_source": "Hospital Case Manager",
        "notes": "Needs care support in Miami",
    }
    res = c.post("/api/v1/states/florida/contact", json=payload)
    assert res.status_code == 200, res.text

    notified_user_ids = [n["user_id"] for n in db["notifications"] if n.get("type") == "new_referral"]
    assert "u-admin-fl" in notified_user_ids
    assert "u-admin" in notified_user_ids
    assert "u-admin-in" not in notified_user_ids
    assert "u-admin-ga" not in notified_user_ids

    # Audit log entry exists
    audit_logs = [log for log in db["audit_logs"] if log.get("table_name") == "client_referrals"]
    assert len(audit_logs) == 1
    assert audit_logs[0]["new_values"]["first_name"] == "Jane"

