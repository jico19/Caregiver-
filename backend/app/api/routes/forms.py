from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_forms():
    return {"message": "TODO: implement forms", "forms": []}
