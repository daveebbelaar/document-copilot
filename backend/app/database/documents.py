"""
Database operations for source documents and document chunks.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.database.models import DocumentChunk, SourceDocument
from app.ingest.schemas import ChunkData, ParsedDocument


def upsert_source_document(db: Session, doc: ParsedDocument) -> SourceDocument:
    """
    Insert or update a source document by its unique accession number.

    Idempotent: Re-ingesting a filing updates its metadata without creating duplicates.
    """
    stmt = select(SourceDocument).where(
        SourceDocument.accession_number == doc.accession_number
    )
    existing = db.scalars(stmt).first()

    if existing:
        existing.ticker = doc.ticker
        existing.company_name = doc.company_name
        existing.form_type = doc.form_type
        existing.filing_date = doc.filing_date
        existing.report_date = doc.report_date
        existing.source_url = doc.source_url
        existing.content_markdown = doc.content_markdown
        existing.filing_metadata = doc.filing_metadata
        db.commit()
        db.refresh(existing)
        return existing

    record = SourceDocument(
        accession_number=doc.accession_number,
        ticker=doc.ticker,
        company_name=doc.company_name,
        form_type=doc.form_type,
        filing_date=doc.filing_date,
        report_date=doc.report_date,
        source_url=doc.source_url,
        content_markdown=doc.content_markdown,
        filing_metadata=doc.filing_metadata,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def store_document_chunks(
    db: Session,
    document_id: UUID,
    chunks: list[ChunkData],
    embeddings: list[list[float]],
) -> int:
    """
    Persist chunks and their vector embeddings for a given source document.

    Deletes any existing chunks for the document to guarantee idempotency.
    The generated search_vector column is populated automatically by Postgres.
    """
    if len(chunks) != len(embeddings):
        raise ValueError(
            f"Chunks count ({len(chunks)}) and embeddings count ({len(embeddings)}) must match"
        )

    # Clean existing chunks for this document if re-ingesting
    del_stmt = delete(DocumentChunk).where(DocumentChunk.document_id == document_id)
    db.execute(del_stmt)

    chunk_models: list[DocumentChunk] = []
    for chunk, embedding in zip(chunks, embeddings, strict=True):
        model = DocumentChunk(
            document_id=document_id,
            chunk_index=chunk.chunk_index,
            chunk_text=chunk.chunk_text,
            token_count=chunk.token_count,
            embedding=embedding,
            chunk_metadata=chunk.chunk_metadata,
        )
        chunk_models.append(model)

    db.add_all(chunk_models)
    db.commit()
    return len(chunk_models)


def get_document_by_accession(
    db: Session, accession_number: str
) -> SourceDocument | None:
    """Retrieve a source document by its SEC accession number."""
    stmt = select(SourceDocument).where(
        SourceDocument.accession_number == accession_number
    )
    return db.scalars(stmt).first()


def count_corpus(db: Session) -> dict[str, int]:
    """Return total counts of ingested documents and chunks."""
    doc_count = db.scalar(select(func.count(SourceDocument.id))) or 0
    chunk_count = db.scalar(select(func.count(DocumentChunk.id))) or 0
    return {"documents": doc_count, "chunks": chunk_count}
