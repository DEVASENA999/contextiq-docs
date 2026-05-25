from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .auth import current_user
from .db import User
from . import rag

router = APIRouter(tags=["chat"])


class AskRequest(BaseModel):
    question: str
    k: int = 6


class SearchRequest(BaseModel):
    query: str
    k: int = 8


@router.post("/chat/ask")
async def ask(body: AskRequest, user: User = Depends(current_user)):
    return rag.answer(user.id, body.question, k=body.k)


@router.post("/search")
async def search(body: SearchRequest, user: User = Depends(current_user)):
    return {"results": rag.search(user.id, body.query, k=body.k)}
