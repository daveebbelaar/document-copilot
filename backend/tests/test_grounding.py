"""
Unit tests for GroundingValidator and citation integrity enforcement.
"""
from __future__ import annotations

import uuid

from app.assistant.outputs import CitationReference, GroundedAnswer
from app.grounding.validator import GroundingValidator
from app.retrieval.schemas import SourcePassage


def create_dummy_passage(idx: int = 1, text: str = "Test passage") -> SourcePassage:
    return SourcePassage(
        chunk_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        chunk_index=idx,
        chunk_text=text,
        score=0.03,
        section="Item 7",
        ticker="AAPL",
        company_name="Apple Inc.",
        form_type="10-K",
        filing_date="2025-10-31",
        report_date="2025-09-27",
    )


def test_validator_links_valid_citation() -> None:
    """Validator links chunk_id from retrieved passage to corresponding CitationReference."""
    passage = create_dummy_passage(1, "Apple net sales were $391B.")
    answer = GroundedAnswer(
        answer="Apple reported revenue of $391B [1].",
        citations=[
            CitationReference(
                citation_index=1,
                ticker="AAPL",
                filing_date="2025-10-31",
                section="Item 7",
                excerpt="$391B",
            )
        ],
    )

    validator = GroundingValidator()
    result = validator.validate(answer=answer, retrieved_passages=[passage])

    assert result.is_valid is True
    assert len(result.errors) == 0
    assert result.resolved_citations_count == 1
    assert result.answer.citations[0].chunk_id == passage.chunk_id


def test_validator_flags_out_of_bounds_citation() -> None:
    """Validator marks result invalid when answer references index beyond retrieved pool."""
    passage = create_dummy_passage(1)
    answer = GroundedAnswer(
        answer="Unfounded claim citing out-of-bounds passage [5].",
        citations=[
            CitationReference(
                citation_index=5,
                ticker="AAPL",
                filing_date="2025-10-31",
                excerpt="Ghost quote",
            )
        ],
    )

    validator = GroundingValidator()
    result = validator.validate(answer=answer, retrieved_passages=[passage])

    assert result.is_valid is False
    assert len(result.errors) == 1
    assert "index out of bounds" in result.errors[0]


def test_validator_synthesizes_missing_citation_ref() -> None:
    """When model omits citations array, validator recovers reference from passage."""
    passage = create_dummy_passage(1, "iPhone sales remained strong.")
    answer = GroundedAnswer(
        answer="Apple reported that iPhone sales remained strong [1].",
        citations=[],  # Empty array
    )

    validator = GroundingValidator()
    result = validator.validate(answer=answer, retrieved_passages=[passage])

    assert result.is_valid is True
    assert result.resolved_citations_count == 1
    recovered = result.answer.citations[0]
    assert recovered.citation_index == 1
    assert recovered.chunk_id == passage.chunk_id
    assert "iPhone sales" in recovered.excerpt
