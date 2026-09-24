from pydantic import BaseModel


class StateResponse(BaseModel):
    id: int
    code: str
    name: str
    slug: str
    active: bool
