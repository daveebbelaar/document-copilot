"""
Structured output models for the Grounded AI Agent.
"""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class CitationReference(BaseModel):
    """A single citation referencing a retrieved filing passage."""

    citation_index: int = Field(
        ...,
        description="The 1-based numeric index corresponding to [N] in the answer text",
    )
    ticker: str = Field(..., description="The ticker of the cited company, e.g. AAPL")
    filing_date: str = Field(..., description="Filing date of the cited filing, e.g. 2025-10-31")
    section: str | None = Field(
        default=None, description="Filing section name, e.g. Item 1A. Risk Factors"
    )
    excerpt: str = Field(
        ...,
        description="Textual excerpt from the retrieved passage supporting the claim",
    )
    chunk_id: UUID | None = Field(
        default=None,
        description="Resolved database UUID of the cited chunk (linked by validator)",
    )


class GroundedAnswer(BaseModel):
    """The complete grounded response returned by the investment analyst agent."""

    answer: str = Field(
        ...,
        description=(
            "The comprehensive response to the analyst's question. Every factual claim "
            "and numerical figure MUST be cited using bracketed markers like [1], [2]."
        ),
    )
    citations: list[CitationReference] = Field(
        default_factory=list,
        description="All citation references mapping to the [N] markers in the answer text.",
    )
