"""
SQLAlchemy table definitions for Document Copilot.

These models are the source of truth for Alembic autogenerate.
Postgres/Supabase-specific features (pgvector extension, generated tsvector columns,
HNSW/GIN indexes, RLS policies) are handled explicitly in migration files — they are
not representable in plain SQLAlchemy type mappings.

Table ownership:
  profiles           — one row per Supabase auth user
  chat_threads       — a named conversation thread owned by a user
  chat_messages      — ordered messages within a thread (user + assistant turns)
  message_citations  — normalized citation records tied to assistant messages
  source_documents   — full normalized Markdown content of each ingested SEC filing
  document_chunks    — retrieval-ready text passages with embeddings + search vectors
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    DateTime,
    FetchedValue,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# profiles
# ---------------------------------------------------------------------------


class Profile(Base):
    """
    One row per Supabase Auth user.

    The primary key mirrors auth.users.id exactly so that JOINs and
    foreign keys can reference it without a separate sequence.
    """

    __tablename__ = "profiles"

    # Matches auth.users.id — set by the application on first sign-in, not auto-generated.
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    threads: Mapped[list[ChatThread]] = relationship(back_populates="profile")


# ---------------------------------------------------------------------------
# chat_threads
# ---------------------------------------------------------------------------


class ChatThread(Base):
    """A named conversation thread owned by exactly one user."""

    __tablename__ = "chat_threads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    profile: Mapped[Profile] = relationship(back_populates="threads")
    messages: Mapped[list[ChatMessage]] = relationship(back_populates="thread")


# ---------------------------------------------------------------------------
# chat_messages
# ---------------------------------------------------------------------------


class ChatMessage(Base):
    """
    A single user or assistant turn within a thread.

    `role` is "user" or "assistant".
    `content` stores the display text.
    `message_json` optionally stores the full AI-SDK-compatible message payload
    for round-trip fidelity when resuming threads.
    """

    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Full AI-SDK message payload — useful for streaming resume and round-trips.
    message_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Ordering index within the thread (monotonically increasing per thread).
    position: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    thread: Mapped[ChatThread] = relationship(back_populates="messages")
    citations: Mapped[list[MessageCitation]] = relationship(back_populates="message")

    __table_args__ = (
        # Guarantees strict ordering queries stay fast per thread.
        Index("ix_chat_messages_thread_position", "thread_id", "position"),
    )


# ---------------------------------------------------------------------------
# message_citations
# ---------------------------------------------------------------------------


class MessageCitation(Base):
    """
    One citation attached to an assistant message.

    Each row links the assistant's answer to the exact document chunk that
    supported the cited claim. The frontend uses this to render source cards.
    """

    __tablename__ = "message_citations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_chunks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Denormalized for display without a join: company, filing, page.
    citation_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # The specific excerpt the model cited (may be a sub-string of chunk text).
    excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    citation_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    message: Mapped[ChatMessage] = relationship(back_populates="citations")
    chunk: Mapped[DocumentChunk | None] = relationship(back_populates="citations")


# ---------------------------------------------------------------------------
# source_documents
# ---------------------------------------------------------------------------


class SourceDocument(Base):
    """
    One row per ingested SEC filing.

    `content_markdown` holds the full normalized Markdown extraction of the filing.
    Having the full text here lets us re-chunk or re-index without re-fetching.
    `filing_metadata` carries ticker, CIK, form type, dates, accession number, etc.
    """

    __tablename__ = "source_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Unique filing identifier — prevents re-ingesting the same filing twice.
    accession_number: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    ticker: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    company_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    form_type: Mapped[str] = mapped_column(String(16), nullable=False)  # e.g. "10-K"
    filing_date: Mapped[str | None] = mapped_column(String(20), nullable=True)  # ISO date string
    report_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Full normalized Markdown of the filing, stored for re-processing.
    content_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Arbitrary extra metadata (CIK, local_path, etc.).
    filing_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    chunks: Mapped[list[DocumentChunk]] = relationship(back_populates="document")

    __table_args__ = (
        Index("ix_source_documents_ticker_form", "ticker", "form_type"),
    )


# ---------------------------------------------------------------------------
# document_chunks
# ---------------------------------------------------------------------------


class DocumentChunk(Base):
    """
    A single retrieval-ready passage from a source document.

    The `embedding` column stores a pgvector vector.  Its dimension must match
    the OPENAI_EMBEDDING_DIMENSIONS setting and the pgvector column declaration
    written explicitly in the Alembic migration (autogenerate cannot infer it).

    The `search_vector` tsvector column is also written explicitly in the migration
    as a GENERATED ALWAYS AS ... STORED column — it cannot be represented in
    SQLAlchemy models directly.
    """

    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("source_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Position of this chunk within its parent document (0-indexed).
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Embedding vector — column type written explicitly in migration.
    # 1536 dims = text-embedding-3-small (pgvector HNSW index max is 2000).
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(1536), nullable=True
    )
    # Generated tsvector column populated by Postgres for full-text search.
    search_vector: Mapped[str | None] = mapped_column(
        TSVECTOR().with_variant(Text, "sqlite"),
        server_default=FetchedValue(),
        nullable=True,
    )
    # Per-chunk metadata: page, section, ticker, company, filing_date, etc.
    chunk_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    document: Mapped[SourceDocument] = relationship(back_populates="chunks")
    citations: Mapped[list[MessageCitation]] = relationship(back_populates="chunk")

    __table_args__ = (
        # Guarantees chunk order queries stay fast per document.
        Index("ix_document_chunks_document_index", "document_id", "chunk_index"),
        # Deduplication: a document cannot have two chunks at the same position.
        UniqueConstraint("document_id", "chunk_index", name="uq_document_chunks_doc_idx"),
    )
