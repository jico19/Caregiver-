from conftest import auth_headers


def test_caregiver_list_empty_on_nonmatching_status(client):
    """When status filter is provided and matches 0 applications, do not synthesize approved caregivers."""
    c, db, _ = client
    # Seed a caregiver without applications
    db["caregivers"].append({
        "id": "cg-1",
        "first_name": "Jane",
        "last_name": "Doe",
        "state_id": 1,
        "created_at": "2026-01-01T00:00:00Z",
    })
    # Filter on status=pending: must return empty applications list
    r = c.get("/api/v1/admin/caregivers?status=pending", headers=auth_headers("u-admin"))
    assert r.status_code == 200
    data = r.json()
    assert data["applications"] == []
    assert data["total"] == 0

    # Unfiltered: still synthesizes approved caregiver for backward-compatibility
    r_unfiltered = c.get("/api/v1/admin/caregivers", headers=auth_headers("u-admin"))
    assert r_unfiltered.status_code == 200
    assert len(r_unfiltered.json()["applications"]) == 1
    assert r_unfiltered.json()["applications"][0]["status"] == "approved"


def test_client_agreements_omits_signature_blobs(client):
    """Client agreements list must not load raw signature_data across the wire."""
    c, db, _ = client
    db["client_agreements"].append({
        "id": "agr-1",
        "client_id": "u-client",
        "agreement_key": "care_agreement",
        "version": 1,
        "signed_at": "2026-01-01T00:00:00Z",
        "signed_name": "Client User",
        "signature_data": "data:image/png;base64,VERY_LARGE_IMAGE_BLOB",
    })
    r = c.get("/api/v1/clients/me/agreements", headers=auth_headers("u-client"))
    assert r.status_code == 200
    agreements = r.json()["agreements"]
    matching = next(a for a in agreements if a["agreement_key"] == "care_agreement")
    assert matching["signed"] is True
    assert "signature_data" not in matching
