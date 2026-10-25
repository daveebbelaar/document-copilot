"""
API Request and Response schemas for Chat Threads and Messages.
"""
from __future__ import annotations

import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ThreadCreateRequest(BaseModel):
    """Payload to create a new chat thread."""

    title: str | None = Field(default=None, max_length=512, description="Optional thread title")


class ThreadUpdateRequest(BaseModel):
    """Payload to update an existing thread's title."""

    title: str = Field(..., min_length=1, max_length=512, description="New thread title")


class MessageCreateRequest(BaseModel):
    """Payload to send a message in a chat thread."""

    content: str = Field(..., min_length=1, description="Analyst research question or prompt")


class ThreadResponse(BaseModel):
    """Chat thread summary response."""

    id: UUID
    user_id: UUID
    title: str | None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = {"from_attributes": True}


class CitationResponse(BaseModel):
    """Citation response associated with a message."""

    id: UUID
    chunk_id: UUID | None
    citation_index: int
    excerpt: str | None
    citation_metadata: dict
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    """Chat message response with nested citations."""

    id: UUID
    thread_id: UUID
    role: str
    content: str
    message_json: dict | None
    position: int
    created_at: datetime.datetime
    citations: list[CitationResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}
