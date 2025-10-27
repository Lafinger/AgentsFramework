"""Lightweight retrieval augmented generation helpers."""

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List

from app.core.logging import logger
from app.schemas.rag import (
    RagDocument,
    RagResponse,
    RagSource,
)


_TOKEN_PATTERN = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> List[str]:
    """Normalize text into comparable tokens."""
    return _TOKEN_PATTERN.findall(text.lower())


@dataclass
class _ScoredDocument:
    """Internal helper to keep track of scored documents."""

    document: RagDocument
    score: float


class RagService:
    """Simple in-memory RAG helper around a JSON knowledge base."""

    def __init__(self, data_path: Path | None = None):
        self.data_path = data_path or Path(__file__).resolve().parent.parent / "rag" / "documents.json"
        self._documents: List[RagDocument] = []
        self._load_documents()

    def _load_documents(self) -> None:
        if not self.data_path.exists():
            logger.warning("rag_documents_missing", path=str(self.data_path))
            self._documents = []
            return

        try:
            with self.data_path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
            self._documents = [RagDocument(**item) for item in payload]
            logger.info("rag_documents_loaded", count=len(self._documents))
        except Exception as exc:
            logger.error("rag_documents_load_failed", error=str(exc), path=str(self.data_path))
            self._documents = []

    def refresh(self) -> None:
        """Reload documents from disk."""
        self._load_documents()

    def list_documents(self) -> List[RagDocument]:
        """Return the knowledge base documents."""
        return list(self._documents)

    def _score_documents(self, query_tokens: List[str]) -> Iterable[_ScoredDocument]:
        query_token_set = set(query_tokens)
        if not query_token_set:
            return []

        scored: List[_ScoredDocument] = []
        for document in self._documents:
            content_tokens = _tokenize(f"{document.title} {document.content}")
            if not content_tokens:
                score = 0.0
            else:
                content_token_set = set(content_tokens)
                intersection = query_token_set.intersection(content_token_set)
                union = query_token_set.union(content_token_set)
                jaccard = len(intersection) / len(union) if union else 0.0
                title_tokens = _tokenize(document.title)
                title_overlap = query_token_set.intersection(set(title_tokens))
                title_bonus = len(title_overlap) * 0.2
                score = jaccard + title_bonus
            scored.append(_ScoredDocument(document=document, score=score))
        scored.sort(key=lambda item: item.score, reverse=True)
        return scored

    def _build_answer(self, question: str, documents: List[_ScoredDocument]) -> RagResponse:
        if not documents or documents[0].score == 0:
            return RagResponse(
                question=question,
                answer="No relevant information was found in the knowledge base. Try rephrasing your question.",
                sources=[],
            )

        sources: List[RagSource] = []
        summary_lines: List[str] = ["Based on the knowledge base we found:"]
        for scored_doc in documents:
            doc = scored_doc.document
            snippet = doc.content[:240]
            if len(doc.content) > 240:
                snippet += "..."
            sources.append(
                RagSource(
                    id=doc.id,
                    title=doc.title,
                    score=round(scored_doc.score, 3),
                    snippet=snippet,
                    tags=doc.tags,
                )
            )
            summary_lines.append(f"- {doc.title}: {snippet}")

        return RagResponse(question=question, answer="\n".join(summary_lines), sources=sources)

    def query(self, question: str, top_k: int = 3) -> RagResponse:
        """Execute a lightweight retrieval over the knowledge base."""
        query_tokens = _tokenize(question)
        scored_documents = list(self._score_documents(query_tokens))
        top_documents = [item for item in scored_documents[:top_k] if item.score > 0]
        return self._build_answer(question=question, documents=top_documents)


# Shared singleton
rag_service = RagService()

__all__ = ["rag_service", "RagService"]
