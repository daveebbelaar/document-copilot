"""
Grounding validator to enforce the citation contract and prevent hallucinations.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.assistant.outputs import CitationReference, GroundedAnswer
from app.retrieval.schemas import SourcePassage

CITATION_REGEX = re.compile(r"\[(\d+)\]")


@dataclass
class ValidationResult:
    """The result of validating an agent's grounded answer against retrieved passages."""

    is_valid: bool
    answer: GroundedAnswer
    errors: list[str] = field(default_factory=list)
    resolved_citations_count: int = 0


class GroundingValidator:
    """
    Validates that:
      1. All bracketed citations [N] in the answer text map to an actual retrieved passage.
      2. No citations reference non-existent passage indices (out of bounds).
      3. Citation metadata (chunk_id, ticker, dates) is accurately resolved and attached.
    """

    def validate(
        self,
        answer: GroundedAnswer,
        retrieved_passages: list[SourcePassage],
    ) -> ValidationResult:
        """
        Validate and link citations from GroundedAnswer to retrieved passages.

        Args:
          answer: The GroundedAnswer produced by the agent.
          retrieved_passages: All passages accumulated across tool calls in this turn.
        """
        errors: list[str] = []

        # 1. Extract all [N] references from answer text
        inline_indices = {int(m) for m in CITATION_REGEX.findall(answer.answer)}

        # Build index mapping of retrieved passages (1-based: 1 -> passages[0], etc.)
        passage_map: dict[int, SourcePassage] = {
            i: passage for i, passage in enumerate(retrieved_passages, start=1)
        }

        # 2. Check for out-of-bounds inline citations
        for idx in inline_indices:
            if idx not in passage_map:
                errors.append(
                    f"Answer references citation [{idx}], but only {len(retrieved_passages)} "
                    f"passages were retrieved (index out of bounds)."
                )

        # 3. Align and resolve CitationReference objects
        citation_by_index: dict[int, CitationReference] = {
            c.citation_index: c for c in answer.citations
        }

        resolved_citations: list[CitationReference] = []

        # For every inline citation [N], ensure a CitationReference exists and link chunk_id
        for idx in sorted(inline_indices):
            passage = passage_map.get(idx)
            if passage is None:
                continue

            existing_ref = citation_by_index.get(idx)
            if existing_ref is not None:
                # Link database chunk_id
                existing_ref.chunk_id = passage.chunk_id
                if not existing_ref.ticker:
                    existing_ref.ticker = passage.ticker
                if not existing_ref.filing_date:
                    existing_ref.filing_date = passage.filing_date
                if not existing_ref.section:
                    existing_ref.section = passage.section
                resolved_citations.append(existing_ref)
            else:
                # Generate fallback reference from passage if model referenced [N] in text
                # but omitted from citations array
                fallback_ref = CitationReference(
                    citation_index=idx,
                    ticker=passage.ticker,
                    filing_date=passage.filing_date,
                    section=passage.section,
                    excerpt=passage.chunk_text[:200],
                    chunk_id=passage.chunk_id,
                )
                resolved_citations.append(fallback_ref)

        # Update answer's citation list with fully resolved and linked citations
        validated_answer = GroundedAnswer(
            answer=answer.answer,
            citations=resolved_citations,
        )

        is_valid = len(errors) == 0
        return ValidationResult(
            is_valid=is_valid,
            answer=validated_answer,
            errors=errors,
            resolved_citations_count=len(resolved_citations),
        )
