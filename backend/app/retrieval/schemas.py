"""
Data schemas for retrieval results and query filters.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class RetrievalFilter(BaseModel):
    """Optional metadata filters to narrow search scope."""

    ticker: str | None = Field(default=None, description="Company ticker, e.g. AAPL, NVDA")
    form_type: str | None = Field(default=None, description="SEC filing form type, e.g. 10-K")
    section: str | None = Field(default=None, description="Specific filing section name")


class SourcePassage(BaseModel):
    """
    A retrieved source chunk formatted for grounding, citation, and LLM context.
    """

    chunk_id: UUID
    document_id: UUID
    chunk_index: int
    chunk_text: str
    score: float = Field(..., description="Reciprocal Rank Fusion relevance score")
    section: str | None = None
    ticker: str
    company_name: str
    form_type: str
    filing_date: str
    report_date: str
    source_url: str | None = None
    chunk_metadata: dict[str, Any] = Field(default_factory=dict)

    def format_citation_header(self, index: int) -> str:
        """Format a clear header for prompt injection: [1] AAPL 10-K (2025-10-31) | Item 1."""
        sec = f" | {self.section}" if self.section else ""
        return f"[{index}] {self.ticker} {self.form_type} ({self.filing_date}){sec}"
