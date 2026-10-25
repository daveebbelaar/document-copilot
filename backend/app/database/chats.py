"""
Chat thread, message, and citation persistence operations using SQLAlchemy.
"""
from __future__ import annotations

import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.database.models import ChatMessage, ChatThread, MessageCitation


def create_thread(
    db: Session,
    user_id: UUID,
    title: str | None = None,
) -> ChatThread:
    """Create a new chat thread for a user."""
    thread = ChatThread(
        user_id=user_id,
        title=title or "New Research Thread",
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


def get_user_threads(
    db: Session,
    user_id: UUID,
    limit: int = 50,
) -> list[ChatThread]:
    """List threads belonging to a user, newest updated first."""
    stmt = (
        select(ChatThread)
        .where(ChatThread.user_id == user_id)
        .order_by(ChatThread.updated_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def get_thread_by_id(
    db: Session,
    thread_id: UUID,
    user_id: UUID,
) -> ChatThread | None:
    """Get a specific thread by ID, enforcing user ownership."""
    stmt = (
        select(ChatThread)
        .where(ChatThread.id == thread_id, ChatThread.user_id == user_id)
    )
    return db.scalars(stmt).first()


def update_thread_title(
    db: Session,
    thread_id: UUID,
    user_id: UUID,
    title: str,
) -> ChatThread | None:
    """Update a thread's title and updated_at timestamp."""
    thread = get_thread_by_id(db, thread_id=thread_id, user_id=user_id)
    if thread is None:
        return None
    thread.title = title
    thread.updated_at = datetime.datetime.now(datetime.UTC)
    db.commit()
    db.refresh(thread)
    return thread


def delete_thread(
    db: Session,
    thread_id: UUID,
    user_id: UUID,
) -> bool:
    """Delete a thread and all associated messages/citations (via cascade)."""
    thread = get_thread_by_id(db, thread_id=thread_id, user_id=user_id)
    if thread is None:
        return False
    db.delete(thread)
    db.commit()
    return True


def create_message(
    db: Session,
    thread_id: UUID,
    role: str,
    content: str,
    message_json: dict | None = None,
    position: int | None = None,
) -> ChatMessage:
    """
    Append a message to a chat thread.

    If position is None, sets position to (current max position + 1).
    Updates thread.updated_at to reflect activity.
    """
    if position is None:
        max_pos_stmt = (
            select(func.coalesce(func.max(ChatMessage.position), 0))
            .where(ChatMessage.thread_id == thread_id)
        )
        current_max = db.scalar(max_pos_stmt) or 0
        position = current_max + 1

    message = ChatMessage(
        thread_id=thread_id,
        role=role,
        content=content,
        message_json=message_json,
        position=position,
    )
    db.add(message)

    # Touch thread updated_at
    thread = db.get(ChatThread, thread_id)
    if thread is not None:
        thread.updated_at = datetime.datetime.now(datetime.UTC)

    db.commit()
    db.refresh(message)
    return message


def get_thread_messages(
    db: Session,
    thread_id: UUID,
    user_id: UUID,
) -> list[ChatMessage] | None:
    """
    Get all messages in a thread in chronological position order, eager-loading citations.

    Returns None if the thread does not exist or does not belong to the user.
    """
    thread = get_thread_by_id(db, thread_id=thread_id, user_id=user_id)
    if thread is None:
        return None

    stmt = (
        select(ChatMessage)
        .options(joinedload(ChatMessage.citations))
        .where(ChatMessage.thread_id == thread_id)
        .order_by(ChatMessage.position.asc())
    )
    return list(db.scalars(stmt).unique().all())


def create_citations(
    db: Session,
    message_id: UUID,
    citations_data: list[dict],
) -> list[MessageCitation]:
    """
    Persist citation records linked to a specific assistant message.

    Each dict in citations_data should contain:
      - chunk_id: UUID (or None)
      - citation_index: int
      - excerpt: str (optional)
      - citation_metadata: dict (optional)
    """
    citations: list[MessageCitation] = []
    for item in citations_data:
        cit = MessageCitation(
            message_id=message_id,
            chunk_id=item.get("chunk_id"),
            citation_index=item.get("citation_index", 0),
            excerpt=item.get("excerpt"),
            citation_metadata=item.get("citation_metadata") or {},
        )
        db.add(cit)
        citations.append(cit)

    db.commit()
    for cit in citations:
        db.refresh(cit)
    return citations
