from datetime import date


def days_until(target: date) -> int:
    return (target - date.today()).days


def is_expiring_soon(target: date, threshold_days: int = 30) -> bool:
    return 0 <= days_until(target) <= threshold_days
