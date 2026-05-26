import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import current_user
from .config import settings
from .db import Document, User, get_session
from . import rag

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/plain": ".txt",
}


class DocumentOut(BaseModel):
    id: str
    filename: str
    mime_type: str
    size_bytes: int
    status: str
    summary: str | None = None
    error: str | None = None

    class Config:
        from_attributes = True


@router.get("", response_model=list[DocumentOut])
async def list_docs(user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    rows = (await db.execute(select(Document).where(Document.user_id == user.id).order_by(Document.created_at.desc()))).scalars().all()
    return rows


@router.post("/upload", response_model=DocumentOut)
async def upload(
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_session),
):
    import logging
    logger = logging.getLogger(__name__)

    mime = file.content_type or "application/octet-stream"
    if mime not in ALLOWED and not (file.filename or "").lower().endswith((".pdf", ".docx", ".txt")):
        raise HTTPException(400, "Unsupported file type. Use PDF, DOCX, or TXT.")
    doc_id = str(uuid.uuid4())
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    ext = ALLOWED.get(mime) or Path(file.filename or "").suffix or ".bin"
    dest = Path(settings.upload_dir) / f"{doc_id}{ext}"

    # Enforce server-side size limit (20 MB) to prevent memory exhaustion
    MAX_BYTES = 20 * 1024 * 1024
    contents = await file.read(MAX_BYTES + 1)
    if len(contents) > MAX_BYTES:
        raise HTTPException(413, "File exceeds 20 MB limit")
    dest.write_bytes(contents)

    doc = Document(
        id=doc_id, user_id=user.id, filename=file.filename or f"document{ext}",
        mime_type=mime, size_bytes=len(contents), status="processing",
    )
    db.add(doc)
    await db.commit()

    try:
        text = rag.extract_text(str(dest), mime)
        if not text.strip():
            raise ValueError("No extractable text")
        rag.index_document(user.id, doc.id, doc.filename, text)
        doc.summary = rag.summarize(text)
        doc.status = "ready"
    except Exception:
        logger.exception("Processing failed for doc %s", doc_id)
        doc.status = "error"
        doc.error = "Processing failed. Please try again or contact support."
    await db.commit()
    await db.refresh(doc)
    return doc


@router.delete("/{doc_id}")
async def delete_doc(doc_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    doc = (await db.execute(select(Document).where(Document.id == doc_id, Document.user_id == user.id))).scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Not found")
    rag.delete_document(user.id, doc.id)
    for f in Path(settings.upload_dir).glob(f"{doc.id}.*"):
        try:
            os.remove(f)
        except OSError:
            pass
    await db.delete(doc)
    await db.commit()
    return {"ok": True}
