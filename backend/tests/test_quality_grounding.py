"""
Automated Quality and Grounding Evaluation Test Suite.

Verifies:
1. Grounded Answer Schema and Invariants
2. Citation Precision: Every [N] badge has an associated cited passage
3. Anti-Hallucination: Out-of-corpus questions result in graceful rejection, not fake numbers
4. Multi-Filing Citation Disambiguation across distinct companies (AAPL and MSFT)
"""
from __future__ import annotations

import re
import uuid

from app.assistant.outputs import CitationReference, GroundedAnswer
from app.grounding.validator import GroundingValidator
from app.retrieval.schemas import SourcePassage


def make_passage(
    idx: int,
    ticker: str,
    company: str,
    text: str,
    section: str = "Item 8",
) -> SourcePassage:
    return SourcePassage(
        chunk_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        chunk_index=idx,
        chunk_text=text,
        score=0.035,
        section=section,
        ticker=ticker,
        company_name=company,
        form_type="10-K",
        filing_date="2025-10-31" if ticker == "AAPL" else "2025-07-30",
        report_date="2025-09-27" if ticker == "AAPL" else "2025-06-30",
        source_url=f"https://www.sec.gov/edgar/{ticker.lower()}",
    )


def test_grounded_answer_citation_integrity() -> None:
    """Ensure answers with citations have strict 1-to-1 matching indices."""
    passage = make_passage(1, "AAPL", "Apple Inc.", "Total net sales were $391,035 million in 2024.")

    answer_text = "Apple recorded total net sales of $391,035 million in 2024 [1]."
    citations = [
        CitationReference(
            citation_index=1,
            ticker="AAPL",
            filing_date="2025-10-31",
            section="Item 8 - Financial Statements",
            excerpt="Total net sales were $391,035 million in 2024.",
        )
    ]

    answer = GroundedAnswer(
        answer=answer_text,
        citations=citations,
        confidence_assessment="High confidence based on audited financial statements.",
    )

    validator = GroundingValidator()
    result = validator.validate(answer=answer, retrieved_passages=[passage])

    assert result.is_valid is True
    assert result.resolved_citations_count == 1
    assert result.answer.citations[0].chunk_id == passage.chunk_id

    # Citation indices in text must match citations array
    badge_indices = [int(m) for m in re.findall(r"\[(\d+)\]", result.answer.answer)]
    citation_indices = [c.citation_index for c in result.answer.citations]
    assert badge_indices == citation_indices == [1]


def test_validator_detects_unsupported_claims() -> None:
    """The validator should flag if an index in text was never returned by retrieval."""
    validator = GroundingValidator()
    retrieved_passages = [
        make_passage(1, "MSFT", "Microsoft Corp.", "Commercial Cloud revenue exceeded $135 billion.")
    ]

    # LLM hallucinates [5] when only 1 passage was retrieved
    answer = GroundedAnswer(
        answer="Revenue grew significantly [5].",
        citations=[],
        confidence_assessment="Uncertain",
    )
    result = validator.validate(answer=answer, retrieved_passages=retrieved_passages)

    assert result.is_valid is False
    assert len(result.errors) >= 1
    assert any("index out of bounds" in err for err in result.errors)


def test_out_of_corpus_rejection_pattern() -> None:
    """Verify standard rejection template for queries not covered by the SEC corpus."""
    empty_passages: list[SourcePassage] = []

    answer = GroundedAnswer(
        answer=(
            "The available SEC 10-K filings in this corpus do not contain information for Tesla (TSLA). "
            "The current corpus only covers AAPL, MSFT, and NVDA."
        ),
        citations=[],
        confidence_assessment="Not in corpus.",
    )

    validator = GroundingValidator()
    result = validator.validate(answer=answer, retrieved_passages=empty_passages)

    assert result.is_valid is True
    assert result.resolved_citations_count == 0
    assert len(result.answer.citations) == 0
    assert "do not contain information" in result.answer.answer


def test_multi_firm_citation_attribution() -> None:
    """Verify citations correctly distinguish between multiple distinct companies."""
    passages = [
        make_passage(1, "AAPL", "Apple Inc.", "Total net sales were $391,035 million."),
        make_passage(2, "MSFT", "Microsoft Corp.", "Total revenue was $245,123 million."),
    ]

    validator = GroundingValidator()
    text = "Apple recorded $391,035M in sales [1], while Microsoft generated $245,123M in revenue [2]."
    citations = [
        CitationReference(
            citation_index=1,
            ticker="AAPL",
            filing_date="2025-10-31",
            section="Item 8",
            excerpt="$391,035 million",
        ),
        CitationReference(
            citation_index=2,
            ticker="MSFT",
            filing_date="2025-07-30",
            section="Item 8",
            excerpt="$245,123 million",
        ),
    ]

    answer = GroundedAnswer(
        answer=text,
        citations=citations,
        confidence_assessment="Comparative cross-filing analysis.",
    )

    result = validator.validate(answer=answer, retrieved_passages=passages)

    assert result.is_valid is True
    assert result.resolved_citations_count == 2
    assert result.answer.citations[0].ticker == "AAPL"
    assert result.answer.citations[0].chunk_id == passages[0].chunk_id
    assert result.answer.citations[1].ticker == "MSFT"
    assert result.answer.citations[1].chunk_id == passages[1].chunk_id
