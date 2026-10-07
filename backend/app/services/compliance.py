from datetime import date, datetime
from typing import Optional

from app.core.soft_delete import active_only


def _parse_date(value) -> Optional[date]:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not value:
        return None
    s = str(value).strip()
    if len(s) >= 10:
        s_part = s[:10]
        try:
            return date.fromisoformat(s_part)
        except (TypeError, ValueError):
            pass
        try:
            return datetime.strptime(s_part, "%Y/%m/%d").date()
        except (TypeError, ValueError):
            pass
        try:
            return datetime.strptime(s_part, "%m/%d/%Y").date()
        except (TypeError, ValueError):
            pass
    return None


def check_caregiver_assignment_compliance(
    supabase,
    caregiver_id: str,
    state_id: int,
) -> tuple[bool, list[str]]:
    """
    Evaluates whether a caregiver meets all mandatory credential requirements for their state.
    Returns (is_compliant, list_of_blocking_reasons).
    """
    today = date.today()
    blocking_reasons: list[str] = []

    actual_cg_id = caregiver_id
    try:
        app_res = (
            active_only(
                supabase.table("caregiver_applications").select("caregiver_id, state_id"),
                "caregiver_applications",
            )
            .eq("id", caregiver_id)
            .execute()
        )
        if app_res.data and app_res.data[0].get("caregiver_id"):
            actual_cg_id = app_res.data[0].get("caregiver_id")
            if state_id is None:
                state_id = app_res.data[0].get("state_id")
    except Exception:
        pass

    # 1. Fetch mandatory document requirements for the state
    req_res = (
        supabase.table("document_requirements")
        .select("state_id, document_type_id, required, for_role")
        .eq("state_id", state_id)
        .execute()
    )
    raw_reqs = req_res.data or []
    reqs = [
        r
        for r in raw_reqs
        if r.get("required") and (r.get("for_role") in ("caregiver", "both", None))
    ]

    # Fetch document types to obtain display names and role scoping
    dt_res = (
        supabase.table("document_types")
        .select("id, name, for_role, requires_expiration")
        .execute()
    )
    doc_types = {d["id"]: d for d in (dt_res.data or [])}

    caregiver_req_type_ids = []
    for r in reqs:
        tid = r.get("document_type_id")
        dt_info = doc_types.get(tid, {})
        if dt_info.get("for_role") != "client":
            caregiver_req_type_ids.append(tid)

    # 2. Fetch caregiver's uploaded documents with statuses and expiration dates
    doc_res = (
        active_only(
            supabase.table("documents").select(
                "id, owner_id, document_type_id, state_id, status, expiration_date, uploaded_at, created_at"
            ),
            "documents",
        )
        .eq("owner_id", actual_cg_id)
        .execute()
    )
    raw_docs = doc_res.data or []
    docs = [
        d
        for d in raw_docs
        if d.get("state_id") is None or d.get("state_id") == state_id
    ]

    # Group documents by document_type_id
    docs_by_type: dict[int, list[dict]] = {}
    for d in docs:
        tid = d.get("document_type_id")
        if tid is not None:
            docs_by_type.setdefault(tid, []).append(d)

    # 3. Check for missing or rejected required documents
    for tid in caregiver_req_type_ids:
        doc_name = doc_types.get(tid, {}).get("name") or f"Document #{tid}"
        uploaded_docs = docs_by_type.get(tid, [])
        if not uploaded_docs:
            blocking_reasons.append(f"Missing required document: {doc_name}")
            continue

        all_rejected = all(d.get("status") == "rejected" for d in uploaded_docs)
        if all_rejected:
            blocking_reasons.append(f"Rejected required document: {doc_name}")

    # 4. Check for documents with status == 'expired' or expiration_date < today
    for tid, type_docs in docs_by_type.items():
        dt_info = doc_types.get(tid, {})
        if dt_info.get("for_role") == "client":
            continue

        doc_name = dt_info.get("name") or f"Document #{tid}"
        has_valid_replacement = False
        expired_entry = None

        for d in type_docs:
            exp_date = _parse_date(d.get("expiration_date"))
            is_expired = (d.get("status") == "expired") or (
                exp_date is not None and exp_date < today
            )
            is_rejected = d.get("status") == "rejected"

            if not is_expired and not is_rejected:
                has_valid_replacement = True
            elif is_expired:
                if not expired_entry:
                    expired_entry = d
                else:
                    d_exp = _parse_date(d.get("expiration_date"))
                    cur_exp = _parse_date(expired_entry.get("expiration_date"))
                    if d_exp and (cur_exp is None or d_exp > cur_exp):
                        expired_entry = d

        if not has_valid_replacement and expired_entry:
            exp_date = _parse_date(expired_entry.get("expiration_date"))
            exp_str = (
                f" (expired on {exp_date.isoformat()})"
                if exp_date
                else " (expired)"
            )
            reason = f"Expired credential: {doc_name}{exp_str}"
            if reason not in blocking_reasons:
                blocking_reasons.append(reason)

    blocking_reasons = sorted(list(dict.fromkeys(blocking_reasons)))
    is_compliant = len(blocking_reasons) == 0
    return is_compliant, blocking_reasons


def get_caregiver_compliance_summary(
    supabase,
    caregiver_id: str,
    state_id: int,
) -> dict:
    """
    Returns structured compliance status dictionary for UI and API consumers.
    """
    is_compliant, blocking_reasons = check_caregiver_assignment_compliance(
        supabase, caregiver_id, state_id
    )
    if is_compliant:
        status_label = "Compliant"
    elif any("Expired" in r for r in blocking_reasons):
        status_label = "Credentials Expired"
    elif any("Missing" in r for r in blocking_reasons):
        status_label = "Missing Documents"
    else:
        status_label = "Non-Compliant"

    return {
        "caregiver_id": caregiver_id,
        "state_id": state_id,
        "compliant": is_compliant,
        "status": status_label,
        "blocking_reasons": blocking_reasons,
    }


def batch_check_caregivers_compliance(
    supabase,
    caregiver_records: list[dict],
) -> dict[str, dict]:
    """
    Batch evaluates compliance for multiple caregivers without N+1 queries.
    caregiver_records: list of dicts with 'id' (caregiver_id) and 'state_id'.
    Returns {caregiver_id: compliance_summary_dict}.
    """
    if not caregiver_records:
        return {}

    today = date.today()
    cg_ids = [c["id"] for c in caregiver_records if c.get("id")]
    state_ids = list(
        {c.get("state_id") for c in caregiver_records if c.get("state_id") is not None}
    )

    if state_ids:
        req_res = (
            supabase.table("document_requirements")
            .select("state_id, document_type_id, required, for_role")
            .in_("state_id", state_ids)
            .execute()
        )
        all_reqs = req_res.data or []
    else:
        all_reqs = []

    dt_res = (
        supabase.table("document_types")
        .select("id, name, for_role, requires_expiration")
        .execute()
    )
    doc_types = {d["id"]: d for d in (dt_res.data or [])}

    if cg_ids:
        doc_res = (
            active_only(
                supabase.table("documents").select(
                    "id, owner_id, document_type_id, state_id, status, expiration_date"
                ),
                "documents",
            )
            .in_("owner_id", cg_ids)
            .execute()
        )
        all_docs = doc_res.data or []
    else:
        all_docs = []

    reqs_by_state: dict[int, list[int]] = {}
    for r in all_reqs:
        sid = r.get("state_id")
        tid = r.get("document_type_id")
        dt_info = doc_types.get(tid, {})
        if (
            r.get("required")
            and (r.get("for_role") in ("caregiver", "both", None))
            and dt_info.get("for_role") != "client"
        ):
            reqs_by_state.setdefault(sid, []).append(tid)

    docs_by_owner: dict[str, dict[int, list[dict]]] = {}
    for d in all_docs:
        owner = d.get("owner_id")
        tid = d.get("document_type_id")
        if owner and tid is not None:
            docs_by_owner.setdefault(owner, {}).setdefault(tid, []).append(d)

    results: dict[str, dict] = {}
    for cg in caregiver_records:
        cid = cg.get("id")
        sid = cg.get("state_id")
        if not cid:
            continue

        reasons = []
        required_tids = reqs_by_state.get(sid, [])
        owner_docs_all = docs_by_owner.get(cid, {})

        owner_docs: dict[int, list[dict]] = {}
        for tid, type_docs in owner_docs_all.items():
            filtered = [
                d for d in type_docs
                if d.get("state_id") is None or d.get("state_id") == sid
            ]
            if filtered:
                owner_docs[tid] = filtered

        for tid in required_tids:
            doc_name = doc_types.get(tid, {}).get("name") or f"Document #{tid}"
            uploaded = owner_docs.get(tid, [])
            if not uploaded:
                reasons.append(f"Missing required document: {doc_name}")
            elif all(d.get("status") == "rejected" for d in uploaded):
                reasons.append(f"Rejected required document: {doc_name}")

        for tid, type_docs in owner_docs.items():
            dt_info = doc_types.get(tid, {})
            if dt_info.get("for_role") == "client":
                continue

            doc_name = dt_info.get("name") or f"Document #{tid}"
            has_valid = False
            expired_d = None
            for d in type_docs:
                exp_date = _parse_date(d.get("expiration_date"))
                is_exp = (d.get("status") == "expired") or (
                    exp_date is not None and exp_date < today
                )
                is_rej = d.get("status") == "rejected"
                if not is_exp and not is_rej:
                    has_valid = True
                elif is_exp:
                    if not expired_d:
                        expired_d = d
                    else:
                        d_exp = _parse_date(d.get("expiration_date"))
                        cur_exp = _parse_date(expired_d.get("expiration_date"))
                        if d_exp and (cur_exp is None or d_exp > cur_exp):
                            expired_d = d

            if not has_valid and expired_d:
                exp_date = _parse_date(expired_d.get("expiration_date"))
                exp_str = (
                    f" (expired on {exp_date.isoformat()})"
                    if exp_date
                    else " (expired)"
                )
                r_str = f"Expired credential: {doc_name}{exp_str}"
                if r_str not in reasons:
                    reasons.append(r_str)

        reasons = sorted(list(dict.fromkeys(reasons)))
        is_compliant = len(reasons) == 0
        if is_compliant:
            status_label = "Compliant"
        elif any("Expired" in r for r in reasons):
            status_label = "Credentials Expired"
        elif any("Missing" in r for r in reasons):
            status_label = "Missing Documents"
        else:
            status_label = "Non-Compliant"

        results[cid] = {
            "caregiver_id": cid,
            "state_id": sid,
            "compliant": is_compliant,
            "status": status_label,
            "blocking_reasons": reasons,
        }

    return results
