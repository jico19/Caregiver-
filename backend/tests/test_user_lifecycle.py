import pytest
from conftest import auth_headers


def test_suspended_user_is_denied_access(client):
    c, db, fake = client

    # Set user u-caregiver to suspended status
    for u in db["users"]:
        if u["id"] == "u-caregiver":
            u["status"] = "suspended"

    # Attempt to access an authenticated route with u-caregiver credentials
    res = c.get("/api/v1/caregivers/me", headers=auth_headers("u-caregiver"))
    assert res.status_code == 403
    assert res.json()["detail"] == "Account suspended"


def test_reactivation_restores_access(client):
    c, db, fake = client

    # Suspend then reactivate
    for u in db["users"]:
        if u["id"] == "u-caregiver":
            u["status"] = "suspended"

    res_suspended = c.get("/api/v1/caregivers/me", headers=auth_headers("u-caregiver"))
    assert res_suspended.status_code == 403

    # Reactivate via admin status update
    res_reactivate = c.post(
        "/api/v1/admin/users/u-caregiver/status",
        json={"status": "active"},
        headers=auth_headers("u-admin"),
    )
    assert res_reactivate.status_code == 200
    assert res_reactivate.json()["status"] == "active"

    # Access restored
    res_active = c.get("/api/v1/caregivers/me", headers=auth_headers("u-caregiver"))
    assert res_active.status_code != 403


def test_unscoped_administrator_denied(client):
    c, db, fake = client

    # Create an administrator user with state_id = None
    db["users"].append({
        "id": "u-admin-unscoped",
        "email": "unscoped@test.com",
        "role_id": 4,
        "state_id": None,
        "status": "active",
        "roles": {"name": "administrator"},
    })

    headers = {"Authorization": "Bearer token-u-admin-unscoped"}
    fake.auth.token_map["token-u-admin-unscoped"] = {
        "id": "u-admin-unscoped",
        "email": "unscoped@test.com",
    }

    # Denied user list
    res_list = c.get("/api/v1/admin/users", headers=headers)
    assert res_list.status_code == 403

    # Denied user read
    res_get = c.get("/api/v1/admin/users/u-caregiver", headers=headers)
    assert res_get.status_code == 403


def test_state_administrator_scoping(client):
    c, db, fake = client

    # u-admin-fl is state_id=1. u-admin-in is state_id=2.
    # Seed user in state 2
    db["users"].append({
        "id": "u-caregiver-in",
        "email": "caregiver.in@test.com",
        "role_id": 2,
        "state_id": 2,
        "status": "active",
        "roles": {"name": "caregiver"},
    })

    # u-admin-fl listed users - u-caregiver-in should not appear or fail state check
    res_list = c.get("/api/v1/admin/users", headers=auth_headers("u-admin-fl"))
    assert res_list.status_code == 200
    user_ids = [u["id"] for u in res_list.json()["users"]]
    assert "u-caregiver-in" not in user_ids

    # u-admin-fl single-user read for user in state 2 is denied
    res_get = c.get("/api/v1/admin/users/u-caregiver-in", headers=auth_headers("u-admin-fl"))
    assert res_get.status_code == 403

    # u-admin-fl cannot suspend user in state 2
    res_suspend = c.post(
        "/api/v1/admin/users/u-caregiver-in/status",
        json={"status": "suspended"},
        headers=auth_headers("u-admin-fl"),
    )
    assert res_suspend.status_code == 403


def test_state_administrator_cannot_change_role_or_state(client):
    c, db, fake = client

    # u-admin-fl (state admin) attempts role change
    res_role = c.post(
        "/api/v1/admin/users/u-caregiver/role",
        json={"role": "super_admin"},
        headers=auth_headers("u-admin-fl"),
    )
    assert res_role.status_code == 403

    # u-admin-fl attempts state change
    res_state = c.post(
        "/api/v1/admin/users/u-caregiver/state",
        json={"state_id": 2},
        headers=auth_headers("u-admin-fl"),
    )
    assert res_state.status_code == 403


def test_super_admin_can_act_across_states_and_change_role_state(client):
    c, db, fake = client

    # Seed user in state 2
    db["users"].append({
        "id": "u-caregiver-in2",
        "email": "caregiver.in2@test.com",
        "role_id": 2,
        "state_id": 2,
        "status": "active",
        "roles": {"name": "caregiver"},
    })

    # super_admin can read user in state 2
    res_get = c.get("/api/v1/admin/users/u-caregiver-in2", headers=auth_headers("u-admin"))
    assert res_get.status_code == 200

    # super_admin can change role
    res_role = c.post(
        "/api/v1/admin/users/u-caregiver-in2/role",
        json={"role": "administrator"},
        headers=auth_headers("u-admin"),
    )
    assert res_role.status_code == 200

    # super_admin can change state
    res_state = c.post(
        "/api/v1/admin/users/u-caregiver-in2/state",
        json={"state_id": 3},
        headers=auth_headers("u-admin"),
    )
    assert res_state.status_code == 200


def test_user_cannot_offboard_themself(client):
    c, db, fake = client

    res = c.delete("/api/v1/admin/users/u-admin", headers=auth_headers("u-admin"))
    assert res.status_code == 400
    assert "cannot offboard yourself" in res.json()["detail"].lower()


def test_offboard_soft_delete_retains_rows_and_revokes_auth(client):
    c, db, fake = client

    # Seed client user, profile, care plan, schedule, document, and immutable agreement
    db["clients"].append({"id": "u-client", "state_id": 1, "first_name": "Test", "last_name": "Client"})
    db["documents"].append({"id": "doc-1", "owner_id": "u-client", "name": "Agreement Doc"})
    db["care_plans"].append({"id": "plan-1", "client_id": "u-client", "status": "active"})
    db["care_schedules"].append({"id": "sched-1", "client_id": "u-client", "day_of_week": "Monday"})
    db["client_agreements"].append({"id": "ag-1", "client_id": "u-client", "agreement_type": "terms"})

    # Perform offboarding by super admin
    res_offboard = c.delete("/api/v1/admin/users/u-client", headers=auth_headers("u-admin"))
    assert res_offboard.status_code == 200

    # 1. User row physical presence retained with deleted_at set and status='inactive'
    user_row = next(u for u in db["users"] if u["id"] == "u-client")
    assert user_row["status"] == "inactive"
    assert user_row.get("deleted_at") is not None
    assert user_row.get("deleted_by") == "u-admin"

    # 2. Profile and document rows physical presence retained with deleted_at set
    cl_row = next(cl for cl in db["clients"] if cl["id"] == "u-client")
    assert cl_row.get("deleted_at") is not None

    doc_row = next(d for d in db["documents"] if d["id"] == "doc-1")
    assert doc_row.get("deleted_at") is not None

    # 3. Clinical dependent rows soft-deleted
    plan_row = next(p for p in db["care_plans"] if p["id"] == "plan-1")
    assert plan_row.get("deleted_at") is not None

    sched_row = next(s for s in db["care_schedules"] if s["id"] == "sched-1")
    assert sched_row.get("deleted_at") is not None

    # 4. Immutable agreement table untouched
    ag_row = next(a for a in db["client_agreements"] if a["id"] == "ag-1")
    assert ag_row.get("deleted_at") is None

    # 5. User authentication attempt fails (revoked at app layer)
    res_auth = c.get("/api/v1/caregivers/me", headers=auth_headers("u-client"))
    assert res_auth.status_code == 403


def test_re_offboarding_returns_409_conflict(client):
    c, db, fake = client

    # Seed caregiver profile
    db["caregivers"].append({"id": "cg-1", "user_id": "u-caregiver", "state_id": 1})

    # First offboard call
    res1 = c.delete("/api/v1/admin/users/u-caregiver", headers=auth_headers("u-admin"))
    assert res1.status_code == 200

    # Second offboard call
    res2 = c.delete("/api/v1/admin/users/u-caregiver", headers=auth_headers("u-admin"))
    assert res2.status_code == 409
    assert "already offboarded" in res2.json()["detail"].lower()


def test_offboard_nonexistent_user_returns_404(client):
    c, db, fake = client

    res = c.delete("/api/v1/admin/users/nonexistent-user-id", headers=auth_headers("u-admin"))
    assert res.status_code == 404


def test_audit_logs_recorded_for_user_actions(client):
    c, db, fake = client

    # Update status
    c.post(
        "/api/v1/admin/users/u-caregiver/status",
        json={"status": "suspended"},
        headers=auth_headers("u-admin"),
    )

    audit_status = [a for a in db["audit_logs"] if a.get("action") == "user.status.suspended"]
    assert len(audit_status) == 1

    # Offboard
    c.delete("/api/v1/admin/users/u-caregiver", headers=auth_headers("u-admin"))
    audit_offboard = [a for a in db["audit_logs"] if a.get("action") == "user.offboard"]
    assert len(audit_offboard) == 1
