"""
Unit tests for the embedding generator and document database storage.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.documents import (
    count_corpus,
    get_document_by_accession,
    store_document_chunks,
    upsert_source_document,
)
from app.database.models import Base, DocumentChunk, SourceDocument
from app.ingest.embedder import EmbeddingGenerator
from app.ingest.schemas import ChunkData, ParsedDocument

# In-memory test engine for fast, isolated document operations
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(
    test_engine,
    tables=[SourceDocument.__table__, DocumentChunk.__table__],
)


def test_embedder_batching_and_dimension_verification() -> None:
    """EmbeddingGenerator splits inputs into batches and verifies output vector dimensions."""
    embedder = EmbeddingGenerator(
        api_key="mock-key",
        base_url="https://mock.base.url",
        model="mock-embedding-model",
        expected_dimensions=1536,
        batch_size=2,
    )

    # 3 items with batch_size=2 -> 2 calls to client.embeddings.create
    mock_item = MagicMock()
    mock_item.embedding = [0.1] * 1536

    mock_usage = MagicMock()
    mock_usage.total_tokens = 15

    mock_response = MagicMock()
    mock_response.data = [mock_item, mock_item]
    mock_response.usage = mock_usage

    embedder._client.embeddings.create = MagicMock(return_value=mock_response)

    texts = ["Text chunk 1", "Text chunk 2", "Text chunk 3"]
    results = embedder.generate_embeddings(texts)

    assert len(results) == 4  # 2 batches of 2 mock items
    assert len(results[0]) == 1536
    assert embedder._client.embeddings.create.call_count == 2
    assert embedder.total_tokens_used == 30


def test_embedder_raises_on_dimension_mismatch() -> None:
    """EmbeddingGenerator raises ValueError if model returns wrong dimensions."""
    embedder = EmbeddingGenerator(
        api_key="mock-key",
        expected_dimensions=1536,
        batch_size=1,
    )

    mock_item = MagicMock()
    mock_item.embedding = [0.1] * 768  # 768 instead of 1536

    mock_response = MagicMock()
    mock_response.data = [mock_item]
    mock_response.usage = None

    embedder._client.embeddings.create = MagicMock(return_value=mock_response)

    with pytest.raises(RuntimeError) as exc_info:
        embedder.generate_embeddings(["Short text"])

    assert "Embedding dimension mismatch" in str(exc_info.value)


def test_upsert_source_document_and_chunks() -> None:
    """Verifies storing and re-ingesting documents and chunks idempotently."""
    db: Session = TestingSessionLocal()

    doc = ParsedDocument(
        accession_number="0000320193-25-000079",
        ticker="AAPL",
        company_name="Apple Inc.",
        form_type="10-K",
        filing_date="2025-10-31",
        report_date="2025-09-27",
        source_url="https://sec.gov/test",
        content_markdown="# Apple Inc. Form 10-K\nContent...",
        filing_metadata={"cik": "0000320193"},
    )

    # 1. First upsert
    doc_record = upsert_source_document(db, doc)
    assert doc_record.id is not None
    assert doc_record.accession_number == "0000320193-25-000079"

    # 2. Re-upsert (idempotent update)
    doc.company_name = "Apple Incorporated"
    updated_record = upsert_source_document(db, doc)
    assert updated_record.id == doc_record.id
    assert updated_record.company_name == "Apple Incorporated"

    # 3. Store chunks
    chunks = [
        ChunkData(
            chunk_index=0,
            chunk_text="First chunk of Apple filing",
            token_count=6,
            section="Item 1. Business",
            chunk_metadata={"ticker": "AAPL"},
        ),
        ChunkData(
            chunk_index=1,
            chunk_text="Second chunk of Apple filing",
            token_count=6,
            section="Item 1A. Risk Factors",
            chunk_metadata={"ticker": "AAPL"},
        ),
    ]
    mock_embeddings = [[0.05] * 1536, [0.08] * 1536]

    stored_count = store_document_chunks(
        db=db,
        document_id=doc_record.id,
        chunks=chunks,
        embeddings=mock_embeddings,
    )
    assert stored_count == 2

    # 4. Count and verify lookup
    counts = count_corpus(db)
    assert counts["documents"] == 1
    assert counts["chunks"] == 2

    found = get_document_by_accession(db, "0000320193-25-000079")
    assert found is not None
    assert found.ticker == "AAPL"

    db.close()
