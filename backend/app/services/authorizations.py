"""Authorization domain service: unit conversion, burn-down calculations, and balance tracking."""


def compute_auth_units(auth: dict) -> dict:
    """Calculate remaining units, remaining hours, total hours, and hours used for an authorization.

    Supports:
    - 15_min billing units (4 units = 1 hour, standard Medicaid waiver billing)
    - hourly billing units (1 unit = 1 hour)
    - visit billing units (1 unit = 1 visit, treated as 1:1 units)
    """
    total_units = auth.get("total_units_authorized")
    total_units = int(total_units) if total_units is not None else 0
    units_used = auth.get("units_used")
    units_used = int(units_used) if units_used is not None else 0
    units_remaining = total_units - units_used
    unit_type = auth.get("unit_type") or "15_min"

    if unit_type == "15_min":
        remaining_hours = round(units_remaining * 0.25, 2)
        total_hours = round(total_units * 0.25, 2)
        hours_used = round(units_used * 0.25, 2)
    else:
        remaining_hours = round(float(units_remaining), 2)
        total_hours = round(float(total_units), 2)
        hours_used = round(float(units_used), 2)

    return {
        **auth,
        "hcpcs_code": auth.get("hcpcs_code") or "T1019",
        "service_description": auth.get("service_description") or "Personal Care Services",
        "total_units_authorized": total_units,
        "units_used": units_used,
        "units_remaining": units_remaining,
        "remaining_hours": remaining_hours,
        "total_hours": total_hours,
        "hours_used": hours_used,
        "unit_type": unit_type,
    }
