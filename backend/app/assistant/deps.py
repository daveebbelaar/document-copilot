"""
Runtime dependency dataclass injected into PydanticAI agent turns.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from app.retrieval.retriever import DocumentRetriever
from app.retrieval.schemas import SourcePassage


@dataclass
class DocumentAgentDeps:
    """
    Explicit runtime dependencies supplied to each turn of the document copilot agent.

    Attributes:
      user_id: Authenticated user executing the query
      thread_id: Chat thread identifier
      retriever: DocumentRetriever instance for hybrid search
      retrieved_passages: Accumulator of all passages retrieved by tools in this turn
    """

    user_id: UUID
    thread_id: UUID
    retriever: DocumentRetriever
    retrieved_passages: list[SourcePassage] = field(default_factory=list)
