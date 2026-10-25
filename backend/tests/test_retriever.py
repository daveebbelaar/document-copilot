"""
Unit tests for DocumentRetriever and SourcePassage schemas.
"""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

from app.database.models import DocumentChunk, SourceDocument
from app.retrieval.retriever import DocumentRetriever
from app.retrieval.schemas import SourcePassage


def test_source_passage_format_citation_header() -> None:
    """format_citation_header generates clean standard citation strings."""
    passage = SourcePassage(
        chunk_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        chunk_index=2,
        chunk_text="Some text about Apple products.",
        score=0.032,
        section="Item 1. Business",
        ticker="AAPL",
        company_name="Apple Inc.",
        form_type="10-K",
        filing_date="2025-10-31",
        report_date="2025-09-27",
        source_url="https://sec.gov/test",
    )
    header = passage.format_citation_header(1)
    assert header == "[1] AAPL 10-K (2025-10-31) | Item 1. Business"


def test_document_retriever_empty_query_returns_empty() -> None:
    """Empty or whitespace queries must immediately return an empty list without database calls."""
    mock_db = MagicMock()
    retriever = DocumentRetriever(db=mock_db, embedder=MagicMock())
    assert retriever.retrieve("") == []
    assert retriever.retrieve("   ") == []
    assert mock_db.execute.call_count == 0


def test_document_retriever_fuses_results() -> None:
    """DocumentRetriever embeds query, calls search queries, and applies RRF."""
    doc_id = uuid.uuid4()
    mock_doc = SourceDocument(
        id=doc_id,
        ticker="AAPL",
        company_name="Apple Inc.",
        form_type="10-K",
        filing_date="2025-10-31",
        report_date="2025-09-27",
    )

    chunk1 = DocumentChunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        chunk_index=1,
        chunk_text="iPhone revenue was strong.",
        chunk_metadata={"section": "Item 7"},
    )
    chunk2 = DocumentChunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        chunk_index=2,
        chunk_text="Services gross margin expanded.",
        chunk_metadata={"section": "Item 7"},
    )

    mock_embedder = MagicMock()
    mock_embedder.generate_embeddings.return_value = [[0.1] * 1536]

    with patch("app.retrieval.retriever.search_vector_chunks") as mock_v_search, \
         patch("app.retrieval.retriever.search_full_text_chunks") as mock_fts_search:

        # Vector search finds chunk1 first, then chunk2
        mock_v_search.return_value = [(chunk1, mock_doc), (chunk2, mock_doc)]
        # FTS search finds chunk2 first
        mock_fts_search.return_value = [(chunk2, mock_doc)]

        retriever = DocumentRetriever(db=MagicMock(), embedder=mock_embedder)
        passages = retriever.retrieve("Apple iPhone revenue", limit=2)

        assert len(passages) == 2
        # chunk2 appeared in BOTH lists (rank 2 in vector + rank 1 in FTS), so it should rank #1!
        assert passages[0].chunk_id == chunk2.id
        assert passages[0].score > passages[1].score
        assert passages[0].ticker == "AAPL"
        assert passages[0].section == "Item 7"
