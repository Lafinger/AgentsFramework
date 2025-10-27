"""RAG related API endpoints."""

from fastapi import APIRouter

from app.schemas.rag import (
    RagDocument,
    RagQuery,
    RagResponse,
)
from app.services.rag import rag_service

router = APIRouter()


@router.get("/documents", response_model=list[RagDocument], summary="List knowledge base documents")
async def list_documents() -> list[RagDocument]:
    """Return the static knowledge base documents used for retrieval."""
    return rag_service.list_documents()


@router.post("/query", response_model=RagResponse, summary="Query the knowledge base")
async def query_rag(payload: RagQuery) -> RagResponse:
    """Retrieve the most relevant documents and build a lightweight answer."""
    return rag_service.query(question=payload.question, top_k=payload.top_k)
