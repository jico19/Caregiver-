from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
import hashlib
from app.core.dependencies import require_caregiver, get_current_user
from app.core.supabase import get_supabase
from app.utils.notifications import notify

router = APIRouter()


@router.get("/courses")
async def list_courses(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    user_id = user.get("sub")

    # Fetch active courses
    courses_res = (
        supabase.table("training_courses")
        .select("*")
        .eq("active", True)
        .order("name")
        .execute()
    )
    courses = courses_res.data or []

    # Fetch caregiver enrollments if user is caregiver
    enrollment_map = {}
    if user.get("role") in ["caregiver", "administrator"]:
        enr_res = (
            supabase.table("training_enrollments")
            .select("*")
            .eq("caregiver_id", user_id)
            .execute()
        )
        for e in enr_res.data or []:
            enrollment_map[e["course_id"]] = e

    result = []
    for c in courses:
        enr = enrollment_map.get(c["id"])
        result.append({
            **c,
            "enrollment_status": enr["status"] if enr else "not_started",
            "enrolled_at": enr["enrolled_at"] if enr else None,
            "completed_at": enr["completed_at"] if enr else None,
            "enrollment_id": enr["id"] if enr else None,
        })

    return {"courses": result}


@router.get("/my-enrollments")
async def get_my_enrollments(user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        supabase.table("training_enrollments")
        .select("*, training_courses(*)")
        .eq("caregiver_id", user_id)
        .order("enrolled_at", desc=True)
        .execute()
    )

    return {"enrollments": res.data or []}


@router.post("/courses/{course_id}/enroll")
async def enroll_in_course(course_id: str, user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    # Check if course exists
    course = supabase.table("training_courses").select("id, name").eq("id", course_id).single().execute()
    if not course.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training course not found.")

    # Check existing enrollment
    existing = (
        supabase.table("training_enrollments")
        .select("*")
        .eq("course_id", course_id)
        .eq("caregiver_id", user_id)
        .execute()
    )
    if existing.data:
        return {"message": "Already enrolled", "enrollment": existing.data[0]}

    # Create enrollment
    enr_data = {
        "course_id": course_id,
        "caregiver_id": user_id,
        "status": "in_progress",
    }
    ins = supabase.table("training_enrollments").insert(enr_data).execute()
    if not ins.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to enroll in course.")

    return {"message": "Enrolled successfully", "enrollment": ins.data[0]}


@router.post("/courses/{course_id}/complete")
async def complete_course(course_id: str, user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    course = supabase.table("training_courses").select("id, name").eq("id", course_id).single().execute()
    if not course.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training course not found.")

    now_iso = datetime.now(timezone.utc).isoformat()

    # Check existing enrollment or create if not present
    existing = (
        supabase.table("training_enrollments")
        .select("*")
        .eq("course_id", course_id)
        .eq("caregiver_id", user_id)
        .execute()
    )

    if existing.data:
        res = (
            supabase.table("training_enrollments")
            .update({"status": "completed", "completed_at": now_iso})
            .eq("id", existing.data[0]["id"])
            .execute()
        )
        record = res.data[0] if res.data else existing.data[0]
    else:
        ins = supabase.table("training_enrollments").insert({
            "course_id": course_id,
            "caregiver_id": user_id,
            "status": "completed",
            "completed_at": now_iso,
        }).execute()
        record = ins.data[0] if ins.data else {}

    # Create notification
    notify(
        supabase,
        user_id,
        "training_completed",
        "Training Completed",
        f"Congratulations! You completed the in-service course: {course.data['name']}.",
    )

    return {"message": "Course marked as completed", "enrollment": record}


@router.get("/courses/{course_id}/certificate")
async def get_course_certificate(course_id: str, user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    course = (
        supabase.table("training_courses")
        .select("id, name")
        .eq("id", course_id)
        .single()
        .execute()
    )
    if not course.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training course not found.",
        )

    enrollment = (
        supabase.table("training_enrollments")
        .select("*")
        .eq("course_id", course_id)
        .eq("caregiver_id", user_id)
        .single()
        .execute()
    )
    if not enrollment.data or enrollment.data.get("status") != "completed" or not enrollment.data.get("completed_at"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A certificate is available only after you complete the course.",
        )

    profile = (
        supabase.table("caregivers")
        .select("first_name, last_name")
        .eq("id", user_id)
        .single()
        .execute()
    )
    prof = profile.data or {}
    caregiver_name = f"{prof.get('first_name', '')} {prof.get('last_name', '')}".strip() or "Caregiver"

    cert_number = hashlib.sha1(
        f"{enrollment.data['id']}::{course_id}".encode()
    ).hexdigest()[:10].upper()

    return {
        "certificate": {
            "certificate_number": cert_number,
            "course_id": course_id,
            "course_name": course.data["name"],
            "caregiver_name": caregiver_name,
            "completed_at": enrollment.data.get("completed_at"),
        }
    }
