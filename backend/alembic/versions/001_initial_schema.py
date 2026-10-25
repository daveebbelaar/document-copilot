"""Initial schema: pgvector extension, all application tables, indexes, and RLS stubs.

Revision ID: 001
Revises:
Create Date: 2026-10-26

Applies:
  - pgvector extension (required before any vector() column exists)
  - profiles, chat_threads, chat_messages, message_citations tables
  - source_documents, document_chunks tables
  - Generated tsvector column on document_chunks.chunk_text for full-text search
  - HNSW vector index on document_chunks.embedding for semantic retrieval
  - GIN index on the tsvector column for full-text retrieval
  - GIN index on document_chunks.chunk_metadata JSONB for metadata filtering
  - Row Level Security enabled on all user-data tables (policies stub — expand in Phase 2)

Review every section before applying. Run with:
  uv run alembic upgrade head
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: str | None = None
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Enable the pgvector extension.
    #    Must run before any vector() column is created.
    # ------------------------------------------------------------------
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ------------------------------------------------------------------
    # 2. profiles
    # ------------------------------------------------------------------
    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    # ------------------------------------------------------------------
    # 3. chat_threads
    # ------------------------------------------------------------------
    op.create_table(
        "chat_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_threads_user_id", "chat_threads", ["user_id"])

    # ------------------------------------------------------------------
    # 4. chat_messages
    # ------------------------------------------------------------------
    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("message_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("position", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["thread_id"], ["chat_threads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_chat_messages_thread_position",
        "chat_messages",
        ["thread_id", "position"],
    )

    # ------------------------------------------------------------------
    # 5. source_documents
    # ------------------------------------------------------------------
    op.create_table(
        "source_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("accession_number", sa.String(length=40), nullable=False),
        sa.Column("ticker", sa.String(length=16), nullable=False),
        sa.Column("company_name", sa.String(length=256), nullable=True),
        sa.Column("form_type", sa.String(length=16), nullable=False),
        sa.Column("filing_date", sa.String(length=20), nullable=True),
        sa.Column("report_date", sa.String(length=20), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("content_markdown", sa.Text(), nullable=True),
        sa.Column(
            "filing_metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("accession_number"),
    )
    op.create_index(
        "ix_source_documents_ticker_form",
        "source_documents",
        ["ticker", "form_type"],
    )
    op.create_index("ix_source_documents_ticker", "source_documents", ["ticker"])

    # ------------------------------------------------------------------
    # 6. document_chunks
    #    The embedding column uses the vector() type from pgvector.
    #    Autogenerate cannot express this — we use op.execute() directly.
    # ------------------------------------------------------------------
    op.create_table(
        "document_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=True),
        # embedding column added below with explicit DDL
        sa.Column(
            "chunk_metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["document_id"], ["source_documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_id", "chunk_index", name="uq_document_chunks_doc_idx"),
    )
    op.create_index(
        "ix_document_chunks_document_index",
        "document_chunks",
        ["document_id", "chunk_index"],
    )
    op.create_index(
        "ix_document_chunks_document_id",
        "document_chunks",
        ["document_id"],
    )

    # Add the pgvector embedding column (1536 dims = text-embedding-3-small).
    # pgvector HNSW indexes enforce a maximum limit of 2,000 dimensions.
    op.execute(
        "ALTER TABLE document_chunks ADD COLUMN embedding vector(1536)"
    )

    # Generated tsvector column for Postgres full-text search.
    # GENERATED ALWAYS AS ... STORED means Postgres updates it automatically on insert/update.
    op.execute(
        """
        ALTER TABLE document_chunks
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
            to_tsvector('english', coalesce(chunk_text, ''))
        ) STORED
        """
    )

    # ------------------------------------------------------------------
    # 7. message_citations
    # ------------------------------------------------------------------
    op.create_table(
        "message_citations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "citation_metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("excerpt", sa.Text(), nullable=True),
        sa.Column("citation_index", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["chunk_id"], ["document_chunks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["message_id"], ["chat_messages.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_message_citations_message_id", "message_citations", ["message_id"])
    op.create_index("ix_message_citations_chunk_id", "message_citations", ["chunk_id"])

    # ------------------------------------------------------------------
    # 8. Performance indexes
    # ------------------------------------------------------------------

    # HNSW index on the embedding column for approximate nearest-neighbor search.
    # ef_construction=64 and m=16 are conservative defaults suitable for a learning project.
    # Increase ef_construction for higher recall at the cost of slower index builds.
    op.execute(
        """
        CREATE INDEX ix_document_chunks_embedding_hnsw
        ON document_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
        """
    )

    # GIN index on the generated tsvector column for efficient full-text search.
    op.execute(
        "CREATE INDEX ix_document_chunks_search_vector ON document_chunks USING gin (search_vector)"
    )

    # GIN index on chunk_metadata JSONB for fast metadata filtering.
    op.execute(
        "CREATE INDEX ix_document_chunks_metadata ON document_chunks USING gin (chunk_metadata)"
    )

    # ------------------------------------------------------------------
    # 9. Row Level Security stubs
    #    Enable RLS on all user-scoped tables. Policies are added in Phase 2
    #    when the auth layer is wired. Enabling RLS now means the tables are
    #    secure by default (no rows visible) until explicit policies are added.
    # ------------------------------------------------------------------
    for table in ("profiles", "chat_threads", "chat_messages", "message_citations"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

    # source_documents and document_chunks are read by all authenticated users —
    # open policies will be added in Phase 2.
    op.execute("ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    # Drop in reverse dependency order.
    op.drop_table("message_citations")
    op.drop_table("document_chunks")
    op.drop_table("source_documents")
    op.drop_table("chat_messages")
    op.drop_table("chat_threads")
    op.drop_table("profiles")
    op.execute("DROP EXTENSION IF EXISTS vector")
