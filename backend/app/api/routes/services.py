from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_services():
    return {"message": "TODO: implement services", "services": []}
