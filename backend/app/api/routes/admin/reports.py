from datetime import datetime, timezone, date, timedelta
from app.core.dependencies import (
    AdminScope,
    require_admin_scoped,
    scope_query,
)
from app.core.supabase import get_supabase
from app.core.soft_delete import (
    SOFT_DELETE_TABLES,
    active_only,
)
from typing import Any
from fastapi import APIRouter, Depends
import time
from app.schemas.reports import AdminReportsResponse

router = APIRouter()

# Memoize static reference data (states, document_types) with a short 60s TTL
_REF_CACHE: dict[str, tuple[float, Any]] = {}
_REF_TTL = 60.0


def invalidate_reports_cache():
    """Clear memoized static reference data (for tests and cache flushes)."""
    global _REF_CACHE
    _REF_CACHE.clear()


def _get_cached_ref(key: str, fetcher):
    now = time.time()
    if key in _REF_CACHE:
        ts, data = _REF_CACHE[key]
        if now - ts < _REF_TTL:
            return data
    data = fetcher()
    _REF_CACHE[key] = (now, data)
    return data


def _parse_iso_date(value):
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


@router.get("/reports", response_model=AdminReportsResponse)
def generate_reports(scope: AdminScope = Depends(require_admin_scoped)):
    """Aggregate snapshot across all SOW reports with explicit column projections and reference cache."""
    supabase = get_supabase()
    today = date.today()
    soon_through = today + timedelta(days=30)

    def _fetch_all(table, cols, state_scoped=True):
        query = supabase.table(table).select(cols)
        if table in SOFT_DELETE_TABLES:
            query = active_only(query, table)
        if state_scoped:
            query = scope_query(query, scope)
        return (query.execute().data) or []

    states = _get_cached_ref(
        "states",
        lambda: {s["id"]: s for s in _fetch_all("states", "id, code, name", state_scoped=False)}
    )
    doc_types = _get_cached_ref(
        "doc_types",
        lambda: {d["id"]: d for d in _fetch_all("document_types", "id, name", state_scoped=False)}
    )
    users = {u["id"]: u for u in _fetch_all("users", "id, email, status", state_scoped=False)}
    caregivers = _fetch_all("caregivers", "id, state_id, first_name, last_name")
    clients = {c["id"]: c for c in _fetch_all("clients", "id, state_id, first_name, last_name")}
    requirements = _fetch_all("document_requirements", "state_id, document_type_id, required")
    docs = _fetch_all("documents", "id, owner_id, document_type_id, status, expiration_date")
    authorizations = _fetch_all("authorizations", "client_id, state_id, authorization_number, start_date, end_date, status")
    courses = {c["id"]: c for c in _fetch_all("training_courses", "id, name, state_id", state_scoped=False)}

    enrollments = _fetch_all("training_enrollments", "caregiver_id, course_id, status", state_scoped=False)
    if scope.states is not None:
        allowed_caregiver_ids = {c.get("id") for c in caregivers}
        enrollments = [e for e in enrollments if e.get("caregiver_id") in allowed_caregiver_ids]
    referrals = _fetch_all("client_referrals", "id, state_id, first_name, last_name, phone, email, status, referral_source, created_at")

    def state_code(sid):
        return states.get(sid, {}).get("code") or "—"

    # 1 & 2: Caregiver compliance + expiring credentials
    req_by_state = {}
    for r in requirements:
        req_by_state.setdefault(r.get("state_id"), []).append(r)

    compliance_rows = []
    cred_rows = []
    for cg in caregivers:
        cg_id = cg.get("id")
        cg_state = cg.get("state_id")
        user = users.get(cg_id, {})
        name = f"{cg.get('first_name', '')} {cg.get('last_name', '')}".strip() or "Caregiver"
        required = [r for r in req_by_state.get(cg_state, []) if r.get("required")]
        cg_docs = [d for d in docs if d.get("owner_id") == cg_id]
        uploaded_ids = {d.get("document_type_id") for d in cg_docs}

        missing = []
        for r in required:
            tid = r.get("document_type_id")
            if tid not in uploaded_ids:
                missing.append({
                    "document_type_id": tid,
                    "name": doc_types.get(tid, {}).get("name", "Required document"),
                })

        expired = []
        expiring_soon = []
        valid = []
        for d in cg_docs:
            did = d.get("document_type_id")
            dname = doc_types.get(did, {}).get("name", "Document")
            base = {"name": dname, "status": d.get("status"), "expiration_date": d.get("expiration_date")}
            if d.get("status") == "expired":
                expired.append(base)
                continue
            exp = _parse_iso_date(d.get("expiration_date"))
            if exp is None or exp > soon_through:
                valid.append(base)
            elif exp < today:
                expired.append(base)
            else:
                expiring_soon.append(base)

            if exp is not None:
                days = (exp - today).days
                if days < 0 or 0 <= days <= 30:
                    cred_rows.append({
                        "caregiver_id": cg_id,
                        "caregiver_name": name,
                        "state_code": state_code(cg_state),
                        "document_name": dname,
                        "expiration_date": d.get("expiration_date"),
                        "days_remaining": days,
                        "status": "expired" if days < 0 else "expiring_soon",
                    })

        compliance_rows.append({
            "caregiver_id": cg_id,
            "name": name,
            "email": user.get("email"),
            "state_code": state_code(cg_state),
            "missing": len(missing),
            "expired": len(expired),
            "expiring_soon": len(expiring_soon),
            "valid": len(valid),
            "missing_names": [m["name"] for m in missing][:5],
            "compliant": len(missing) == 0 and len(expired) == 0,
        })

    cred_rows.sort(key=lambda r: r["expiration_date"] or "9999")
    compliance_rows.sort(key=lambda r: r["name"].lower())

    # 3: Training completion
    course_stats = []
    for c in courses.values():
        enr = [e for e in enrollments if e.get("course_id") == c.get("id")]
        completed = [e for e in enr if e.get("status") == "completed"]
        enrolled = len(enr)
        course_stats.append({
            "course_id": c.get("id"),
            "name": c.get("name"),
            "state_code": state_code(c.get("state_id")),
            "enrolled": enrolled,
            "completed": len(completed),
            "completion_pct": round(len(completed) / enrolled * 100) if enrolled else 0,
        })
    course_stats.sort(key=lambda c: c["name"].lower())

    # 4: Client authorizations
    auth_rows = []
    for a in authorizations:
        cl = clients.get(a.get("client_id"), {})
        end = _parse_iso_date(a.get("end_date"))
        auth_rows.append({
            "authorization_number": a.get("authorization_number"),
            "client_name": f"{cl.get('first_name', '')} {cl.get('last_name', '')}".strip() or "Client",
            "state_code": state_code(a.get("state_id")),
            "start_date": a.get("start_date"),
            "end_date": a.get("end_date"),
            "status": a.get("status"),
            "days_left": None if end is None else (end - today).days,
        })
    auth_rows.sort(key=lambda a: a["end_date"] or "9999")
    auth_summary = {s: 0 for s in ("active", "expiring_soon", "expired", "pending", "rejected")}
    for a in auth_rows:
        auth_summary[a["status"]] = auth_summary.get(a["status"], 0) + 1

    # 5: Referral sources
    source_rows = {}
    for r in referrals:
        src = r.get("referral_source") or "Website Inquiry"
        item = source_rows.setdefault(src, {"source": src, "count": 0, "states": {}})
        item["count"] += 1
        code = state_code(r.get("state_id"))
        item["states"][code] = item["states"].get(code, 0) + 1
    source_list = sorted(source_rows.values(), key=lambda s: s["count"], reverse=True)
    for s in source_list:
        s["states"] = [{"code": code, "count": cnt} for code, cnt in sorted(s["states"].items())]

    # 6: Website inquiries
    inquiries = [r for r in referrals if (r.get("referral_source") or "Website Inquiry") == "Website Inquiry"]
    by_state = {}
    for r in inquiries:
        code = state_code(r.get("state_id"))
        by_state[code] = by_state.get(code, 0) + 1
    recent = sorted(inquiries, key=lambda r: r.get("created_at") or "", reverse=True)[:50]
    recent = [
        {
            "id": r.get("id"),
            "first_name": r.get("first_name"),
            "last_name": r.get("last_name"),
            "state_code": state_code(r.get("state_id")),
            "phone": r.get("phone"),
            "email": r.get("email"),
            "status": r.get("status"),
            "created_at": r.get("created_at"),
        }
        for r in recent
    ]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "caregiver_compliance": {
            "total": len(compliance_rows),
            "compliant": sum(1 for c in compliance_rows if c["compliant"]),
            "rows": compliance_rows,
        },
        "expiring_credentials": {
            "total": len(cred_rows),
            "rows": cred_rows,
        },
        "training_completion": {
            "total_courses": len(course_stats),
            "rows": course_stats,
        },
        "client_authorizations": {
            "summary": auth_summary,
            "rows": auth_rows,
        },
        "referral_sources": {
            "total": sum(s["count"] for s in source_list),
            "rows": source_list,
        },
        "website_inquiries": {
            "total": len(inquiries),
            "by_state": [{"code": code, "count": cnt} for code, cnt in sorted(by_state.items())],
            "recent": recent,
        },
    }
