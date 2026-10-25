"""
Data schemas for document ingestion and chunking pipeline.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ParsedDocument(BaseModel):
    """Normalized SEC filing ready for storage and chunking."""

    accession_number: str
    ticker: str
    company_name: str
    form_type: str = "10-K"
    filing_date: str
    report_date: str
    source_url: str
    content_markdown: str
    filing_metadata: dict[str, Any] = Field(default_factory=dict)


class ChunkData(BaseModel):
    """A single semantically coherent text passage ready for embedding and storage."""

    chunk_index: int
    chunk_text: str
    token_count: int
    section: str | None = None
    chunk_metadata: dict[str, Any] = Field(default_factory=dict)
    document_id: UUID | None = None
