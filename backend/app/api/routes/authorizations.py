from fastapi import APIRouter, Depends
from app.core.dependencies import require_admin, require_client

router = APIRouter()


@router.get("/")
async def list_authorizations(user: dict = Depends(require_admin)):
    return {"message": "TODO: implement authorizations", "authorizations": []}


@router.post("/")
async def create_authorization(user: dict = Depends(require_admin)):
    return {"message": "TODO: implement authorization creation"}
