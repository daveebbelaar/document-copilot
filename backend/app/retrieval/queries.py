"""
Raw database search queries: pgvector cosine similarity and Postgres full-text search.
"""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.models import DocumentChunk, SourceDocument
from app.retrieval.schemas import RetrievalFilter


def search_vector_chunks(
    db: Session,
    query_vector: list[float],
    limit: int = 20,
    filters: RetrievalFilter | None = None,
) -> list[tuple[DocumentChunk, SourceDocument]]:
    """
    Search chunks using pgvector cosine distance operator (<=>).

    Results are ordered by cosine distance ascending (closest / most similar first).
    Applies optional ticker, form_type, and section filters.
    """
    stmt = (
        select(DocumentChunk, SourceDocument)
        .join(SourceDocument, DocumentChunk.document_id == SourceDocument.id)
    )

    if filters:
        if filters.ticker:
            stmt = stmt.where(SourceDocument.ticker == filters.ticker.upper())
        if filters.form_type:
            stmt = stmt.where(SourceDocument.form_type == filters.form_type)
        if filters.section:
            stmt = stmt.where(
                DocumentChunk.chunk_metadata["section"].astext.ilike(f"%{filters.section}%")
            )

    # Order by cosine distance ascending (<=> operator)
    stmt = stmt.order_by(DocumentChunk.embedding.op("<=>")(query_vector)).limit(limit)

    return list(db.execute(stmt).all())


def search_full_text_chunks(
    db: Session,
    query_text: str,
    limit: int = 20,
    filters: RetrievalFilter | None = None,
) -> list[tuple[DocumentChunk, SourceDocument]]:
    """
    Search chunks using Postgres full-text search (websearch_to_tsquery against search_vector).

    Results are ordered by ts_rank descending (highest keyword match first).
    Applies optional ticker, form_type, and section filters.
    """
    if not query_text.strip():
        return []

    ts_query = func.websearch_to_tsquery("english", query_text)

    stmt = (
        select(DocumentChunk, SourceDocument)
        .join(SourceDocument, DocumentChunk.document_id == SourceDocument.id)
        .where(DocumentChunk.search_vector.op("@@")(ts_query))
    )

    if filters:
        if filters.ticker:
            stmt = stmt.where(SourceDocument.ticker == filters.ticker.upper())
        if filters.form_type:
            stmt = stmt.where(SourceDocument.form_type == filters.form_type)
        if filters.section:
            stmt = stmt.where(
                DocumentChunk.chunk_metadata["section"].astext.ilike(f"%{filters.section}%")
            )

    stmt = stmt.order_by(func.ts_rank(DocumentChunk.search_vector, ts_query).desc()).limit(limit)

    return list(db.execute(stmt).all())
