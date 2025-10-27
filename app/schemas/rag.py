"""Schemas for the simple RAG module."""

from typing import List

from pydantic import BaseModel, Field


class RagDocument(BaseModel):
    """Document stored in the lightweight knowledge base."""

    id: str = Field(..., description="Unique identifier for the document")
    title: str = Field(..., description="Short display title")
    content: str = Field(..., description="Plain text body of the document")
    tags: List[str] = Field(default_factory=list, description="Optional tags for filtering and display")


class RagQuery(BaseModel):
    """Incoming query payload."""

    question: str = Field(..., min_length=3, max_length=1_000, description="User question to search against the KB")
    top_k: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Number of documents to retrieve from the knowledge base",
    )


class RagSource(BaseModel):
    """Single retrieved document entry returned to the client."""

    id: str
    title: str
    score: float
    snippet: str
    tags: List[str] = Field(default_factory=list)


class RagResponse(BaseModel):
    """RAG response payload sent back to the caller."""

    question: str
    answer: str
    sources: List[RagSource] = Field(default_factory=list)

