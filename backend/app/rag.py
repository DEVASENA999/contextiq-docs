"""LangChain + ChromaDB RAG pipeline. Per-user collections keep tenants isolated."""
from __future__ import annotations
import os
from pathlib import Path
from typing import Iterable

from langchain_chroma import Chroma
from langchain_core.documents import Document as LCDocument
from langchain_text_splitters import RecursiveCharacterTextSplitter

from .config import settings


def _embeddings():
    if settings.llm_provider == "openai":
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(model=settings.embedding_model_openai, api_key=settings.openai_api_key)
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    return GoogleGenerativeAIEmbeddings(model=settings.embedding_model_gemini, google_api_key=settings.google_api_key)


def _llm():
    if settings.llm_provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key, temperature=0.2)
    from langchain_google_genai import ChatGoogleGenerativeAI
    return ChatGoogleGenerativeAI(model=settings.gemini_model, google_api_key=settings.google_api_key, temperature=0.2)


def _store(user_id: str) -> Chroma:
    Path(settings.chroma_dir).mkdir(parents=True, exist_ok=True)
    return Chroma(
        collection_name=f"user_{user_id.replace('-', '')}",
        embedding_function=_embeddings(),
        persist_directory=settings.chroma_dir,
    )


def extract_text(path: str, mime: str) -> str:
    p = Path(path)
    ext = p.suffix.lower()
    if ext == ".pdf" or mime == "application/pdf":
        from pypdf import PdfReader
        reader = PdfReader(str(p))
        return "\n\n".join((page.extract_text() or "") for page in reader.pages)
    if ext == ".docx":
        from docx import Document as Docx
        d = Docx(str(p))
        return "\n".join(par.text for par in d.paragraphs)
    return p.read_text(encoding="utf-8", errors="ignore")


def index_document(user_id: str, document_id: str, filename: str, text: str) -> int:
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    chunks = splitter.split_text(text)
    if not chunks:
        return 0
    docs = [
        LCDocument(page_content=c, metadata={"document_id": document_id, "filename": filename, "chunk": i})
        for i, c in enumerate(chunks)
    ]
    store = _store(user_id)
    store.add_documents(docs, ids=[f"{document_id}:{i}" for i in range(len(docs))])
    return len(docs)


def delete_document(user_id: str, document_id: str) -> None:
    store = _store(user_id)
    try:
        store.delete(where={"document_id": document_id})
    except Exception:
        pass


def summarize(text: str) -> str:
    llm = _llm()
    prompt = (
        "Write a concise executive summary (5-8 bullet points) of the following document. "
        "Focus on key facts, decisions, and entities.\n\nDOCUMENT:\n"
        + text[:15000]
    )
    return llm.invoke(prompt).content  # type: ignore[return-value]


def search(user_id: str, query: str, k: int = 6) -> list[dict]:
    store = _store(user_id)
    results = store.similarity_search_with_score(query, k=k)
    return [
        {
            "content": d.page_content,
            "score": float(s),
            "document_id": d.metadata.get("document_id"),
            "filename": d.metadata.get("filename"),
            "chunk": d.metadata.get("chunk"),
        }
        for d, s in results
    ]


def answer(user_id: str, question: str, k: int = 6) -> dict:
    hits = search(user_id, question, k=k)
    context = "\n\n---\n\n".join(
        f"[{i+1}] ({h['filename']} #chunk {h['chunk']})\n{h['content']}" for i, h in enumerate(hits)
    )
    prompt = (
        "You are an assistant answering strictly from the provided context. "
        "Cite sources inline using [n] matching the context blocks. "
        "If the answer is not in the context, say so.\n\n"
        f"CONTEXT:\n{context}\n\nQUESTION: {question}\n\nANSWER:"
    )
    llm = _llm()
    text = llm.invoke(prompt).content  # type: ignore[assignment]
    return {"answer": text, "sources": hits}
