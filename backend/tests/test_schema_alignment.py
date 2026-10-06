"""Tests ensuring schema alignment and route mounting to prevent PostgREST 42703 / 404 errors."""
from unittest.mock import MagicMock
from app.jobs.retention_purge import run_retention_purge
from app.api.routes.admin.assignments import list_client_assignments
from app.core.dependencies import AdminScope


from tests.conftest import auth_headers


def test_admin_settings_document_requirements(client):
    api_client, db, fake = client
    res = api_client.get("/api/v1/admin/settings/document-requirements", headers=auth_headers("u-admin"))
    assert res.status_code == 200
    assert "requirements" in res.json()


def test_admin_notifications_route_is_mounted(client, monkeypatch):
    api_client, db, fake = client
    selected_cols = []
    orig_table = fake.table

    def tracking_table(name):
        tbl = orig_table(name)
        if name == "notifications":
            orig_select = tbl.select

            def tracking_select(columns="*", **kwargs):
                selected_cols.append(columns)
                return orig_select(columns, **kwargs)

            tbl.select = tracking_select
        return tbl

    monkeypatch.setattr(fake, "table", tracking_table)
    res = api_client.get("/api/v1/admin/notifications", headers=auth_headers("u-admin"))
    assert res.status_code == 200
    assert "notifications" in res.json()
    assert any("id" in cols for cols in selected_cols)
    assert not any("updated_at" in cols for cols in selected_cols)


def test_admin_referrals_list_schema(client):
    api_client, db, fake = client
    res = api_client.get("/api/v1/admin/referrals", headers=auth_headers("u-admin"))
    assert res.status_code == 200
    assert "referrals" in res.json()


def test_admin_documents_list_schema(client):
    api_client, db, fake = client
    res = api_client.get("/api/v1/admin/documents", headers=auth_headers("u-admin"))
    assert res.status_code == 200
    assert "documents" in res.json()


def test_retention_purge_job_runs_cleanly(client):
    api_client, db, fake = client
    result = run_retention_purge(fake)
    assert result["status"] == "completed"


def test_assignments_graceful_table_fallback(monkeypatch):
    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_table.select.side_effect = Exception("{'message': \"Could not find the table 'public.caregiver_client_assignments' in the schema cache\", 'code': 'PGRST205'}")
    mock_supabase.table.return_value = mock_table

    scope = AdminScope(user={"sub": "u-admin", "role": "super_admin"}, states=None)
    
    monkeypatch.setattr("app.api.routes.admin.assignments.get_supabase", lambda: mock_supabase)
    monkeypatch.setattr("app.api.routes.admin.assignments.get_client_or_404", lambda sb, cid, sc: {"id": cid, "state_id": 1})
    res = list_client_assignments("c-1", scope=scope)
    assert res == {"assignments": []}


def test_admin_client_schedule_schema(client, monkeypatch):
    api_client, db, fake = client
    db["clients"].append({"id": "u-client", "state_id": 1, "first_name": "Maya", "last_name": "Rivera"})
    selected_cols = []
    orig_table = fake.table

    def tracking_table(name):
        tbl = orig_table(name)
        if name == "care_schedules":
            orig_select = tbl.select

            def tracking_select(columns="*", **kwargs):
                selected_cols.append(columns)
                return orig_select(columns, **kwargs)

            tbl.select = tracking_select
        return tbl

    monkeypatch.setattr(fake, "table", tracking_table)
    res = api_client.get("/api/v1/admin/clients/u-client/schedule", headers=auth_headers("u-admin"))
    assert res.status_code == 200
    assert "schedule" in res.json()
    assert any("id" in cols for cols in selected_cols)
    assert not any("updated_at" in cols for cols in selected_cols)


def test_admin_client_care_plan_activities_schema(client, monkeypatch):
    api_client, db, fake = client
    db["clients"].append({"id": "u-client", "state_id": 1, "first_name": "Maya", "last_name": "Rivera"})
    # Seed care plan so activities query is triggered
    db["care_plans"].append({
        "id": "cp-1",
        "client_id": "u-client",
        "state_id": 1,
        "status": "active",
    })
    selected_cols = []
    orig_table = fake.table

    def tracking_table(name):
        tbl = orig_table(name)
        if name == "care_plan_activities":
            orig_select = tbl.select

            def tracking_select(columns="*", **kwargs):
                selected_cols.append(columns)
                return orig_select(columns, **kwargs)

            tbl.select = tracking_select
        return tbl

    monkeypatch.setattr(fake, "table", tracking_table)
    res = api_client.get("/api/v1/admin/clients/u-client/care-plan", headers=auth_headers("u-admin"))
    assert res.status_code == 200
    assert "care_plan" in res.json()
    assert any("id" in cols for cols in selected_cols)
    assert not any("updated_at" in cols for cols in selected_cols)


def test_admin_users_schema_filters(client, monkeypatch):
    api_client, db, fake = client
    # Seed caregiver and client
    db["users"].append({
        "id": "u-cg-test",
        "email": "cg@test.com",
        "role_id": 2,
        "state_id": 1,
        "status": "active",
        "deleted_at": None,
    })
    db["caregivers"].append({
        "id": "u-cg-test",
        "state_id": 1,
        "first_name": "Care",
        "last_name": "Giver",
        "deleted_at": None,
    })

    eq_filters = []
    orig_table = fake.table

    def tracking_table(name):
        tbl = orig_table(name)
        orig_update = tbl.update
        orig_select = tbl.select

        def tracking_update(*args, **kwargs):
            query = orig_update(*args, **kwargs)
            orig_eq = query.eq

            def tracking_eq(col, val):
                eq_filters.append((name, col, val))
                return orig_eq(col, val)

            query.eq = tracking_eq
            return query

        def tracking_select(*args, **kwargs):
            query = orig_select(*args, **kwargs)
            orig_eq = query.eq

            def tracking_eq(col, val):
                eq_filters.append((name, col, val))
                return orig_eq(col, val)

            query.eq = tracking_eq
            return query

        tbl.update = tracking_update
        tbl.select = tracking_select
        return tbl

    monkeypatch.setattr(fake, "table", tracking_table)

    # 1. Test GET /api/v1/admin/users/u-cg-test
    res_get = api_client.get("/api/v1/admin/users/u-cg-test", headers=auth_headers("u-admin"))
    assert res_get.status_code == 200

    # 2. Test DELETE /api/v1/admin/users/u-cg-test
    res_del = api_client.delete("/api/v1/admin/users/u-cg-test", headers=auth_headers("u-admin"))
    assert res_del.status_code == 200

    # Ensure no query targeted the non-existent column "user_id" on caregivers, clients, or documents
    for tbl_name, col_name, _ in eq_filters:
        if tbl_name in ("caregivers", "clients"):
            assert col_name != "user_id", f"Table {tbl_name} does not have column user_id"
        if tbl_name == "documents":
            assert col_name != "user_id", "Table documents uses owner_id, not user_id"


