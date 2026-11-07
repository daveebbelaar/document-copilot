"""
Runtime dependency dataclass injected into PydanticAI agent turns.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any
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
      event_callback: Optional callable to receive real-time execution events during agent runs
    """

    user_id: UUID
    thread_id: UUID
    retriever: DocumentRetriever
    retrieved_passages: list[SourcePassage] = field(default_factory=list)
    event_callback: Callable[[str, dict[str, Any]], Any] | None = None
