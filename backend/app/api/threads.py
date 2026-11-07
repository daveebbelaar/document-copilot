"""
API router for chat thread management and message history.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.schemas import (
    MessageCreateRequest,
    MessageResponse,
    ThreadCreateRequest,
    ThreadResponse,
    ThreadUpdateRequest,
)
from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthenticatedUser
from app.chat.orchestrator import execute_chat_turn, execute_chat_turn_stream
from app.database.chats import (
    create_thread,
    delete_thread,
    get_thread_by_id,
    get_thread_messages,
    get_user_threads,
    update_thread_title,
)
from app.database.session import get_db

router = APIRouter(prefix="/api/threads", tags=["threads"])


@router.get("", response_model=list[ThreadResponse])
async def list_threads(
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ThreadResponse]:
    """List all chat threads belonging to the authenticated user."""
    threads = get_user_threads(db, user_id=user.id)
    return [ThreadResponse.model_validate(t) for t in threads]


@router.post("", response_model=ThreadResponse, status_code=status.HTTP_201_CREATED)
async def new_thread(
    payload: ThreadCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ThreadResponse:
    """Create a new chat thread for the authenticated user."""
    thread = create_thread(db, user_id=user.id, title=payload.title)
    return ThreadResponse.model_validate(thread)


@router.get("/{thread_id}", response_model=ThreadResponse)
async def get_thread(
    thread_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ThreadResponse:
    """Get a specific thread by ID. Returns 404 if not found or unauthorized."""
    thread = get_thread_by_id(db, thread_id=thread_id, user_id=user.id)
    if thread is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found",
        )
    return ThreadResponse.model_validate(thread)


@router.patch("/{thread_id}", response_model=ThreadResponse)
async def update_thread(
    thread_id: UUID,
    payload: ThreadUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ThreadResponse:
    """Update a thread's title."""
    thread = update_thread_title(db, thread_id=thread_id, user_id=user.id, title=payload.title)
    if thread is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found",
        )
    return ThreadResponse.model_validate(thread)


@router.delete("/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_thread(
    thread_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete a thread and its messages."""
    deleted = delete_thread(db, thread_id=thread_id, user_id=user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found",
        )


@router.get("/{thread_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    thread_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MessageResponse]:
    """
    Get the chronological message history for a thread, including citations.
    Returns 404 if the thread is not found or not owned by user.
    """
    messages = get_thread_messages(db, thread_id=thread_id, user_id=user.id)
    if messages is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found",
        )
    return [MessageResponse.model_validate(m) for m in messages]


@router.post(
    "/{thread_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    thread_id: UUID,
    payload: MessageCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Submit a user message, run the grounded agent turn, and return the assistant response.
    """
    asst_msg = await execute_chat_turn(
        db=db,
        user=user,
        thread_id=thread_id,
        user_content=payload.content,
    )
    return MessageResponse.model_validate(asst_msg)


@router.post(
    "/{thread_id}/messages/stream",
    status_code=status.HTTP_200_OK,
)
async def stream_message(
    thread_id: UUID,
    payload: MessageCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """
    Submit a user message and stream SSE events including agent activity trace and grounded answer.
    Returns 404 if thread not found.
    """
    thread = get_thread_by_id(db, thread_id=thread_id, user_id=user.id)
    if thread is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found",
        )

    event_generator = execute_chat_turn_stream(
        db=db,
        user=user,
        thread_id=thread_id,
        user_content=payload.content,
    )

    return StreamingResponse(
        event_generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
