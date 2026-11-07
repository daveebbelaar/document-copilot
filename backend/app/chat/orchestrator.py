"""
Chat turn orchestrator coordinating persistence, agent execution, and grounding validation.
"""
from __future__ import annotations

import asyncio
import json
import time
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

import structlog
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.schemas import MessageResponse
from app.assistant.agent import document_agent
from app.assistant.deps import DocumentAgentDeps
from app.assistant.outputs import GroundedAnswer
from app.auth.schemas import AuthenticatedUser
from app.database.chats import (
    create_citations,
    create_message,
    get_thread_by_id,
    update_thread_title,
)
from app.database.models import ChatMessage
from app.grounding.validator import GroundingValidator
from app.retrieval.retriever import DocumentRetriever

logger = structlog.get_logger(__name__)


async def execute_chat_turn(
    db: Session,
    user: AuthenticatedUser,
    thread_id: UUID,
    user_content: str,
) -> ChatMessage:
    """
    Execute one full interactive chat turn end-to-end:
      1. Verifies thread exists and belongs to the authenticated user.
      2. Persists the user message.
      3. Invokes the PydanticAI document agent with retriever dependencies.
      4. Validates grounding and links citation references to document chunks.
      5. Persists the assistant message and associated citations to the database.
      6. Returns the persisted ChatMessage with populated citations.
    """
    clean_content = user_content.strip()
    if not clean_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty",
        )

    thread = get_thread_by_id(db, thread_id=thread_id, user_id=user.id)
    if thread is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found",
        )

    # 1. Persist user message
    create_message(
        db=db,
        thread_id=thread_id,
        role="user",
        content=clean_content,
    )

    # Auto-generate thread title if it's the initial turn
    if thread.title in (None, "", "New Research Thread"):
        snippet = clean_content[:40] + ("..." if len(clean_content) > 40 else "")
        update_thread_title(db, thread_id=thread_id, user_id=user.id, title=snippet)

    # 2. Prepare agent runtime dependencies
    retriever = DocumentRetriever(db=db)
    deps = DocumentAgentDeps(
        user_id=user.id,
        thread_id=thread_id,
        retriever=retriever,
    )

    # 3. Execute agent turn
    logger.info("Executing agent turn", thread_id=str(thread_id), user_id=str(user.id))
    try:
        agent_result = await document_agent.run(clean_content, deps=deps)
        raw_output = agent_result.output
        if isinstance(raw_output, str):
            grounded_answer = GroundedAnswer(answer=raw_output, citations=[])
        else:
            grounded_answer = raw_output
    except Exception as e:
        logger.error("Agent execution error", error=str(e))
        # Provide graceful error message
        asst_msg = create_message(
            db=db,
            thread_id=thread_id,
            role="assistant",
            content="An error occurred while generating a response from the filings corpus.",
        )
        return asst_msg

    # 4. Validate grounding and resolve chunk_ids
    validator = GroundingValidator()
    val_result = validator.validate(
        answer=grounded_answer,
        retrieved_passages=deps.retrieved_passages,
    )
    validated_answer = val_result.answer

    # 5. Persist assistant message
    asst_msg = create_message(
        db=db,
        thread_id=thread_id,
        role="assistant",
        content=validated_answer.answer,
    )

    # 6. Persist citations
    if validated_answer.citations:
        citations_data = [
            {
                "chunk_id": c.chunk_id,
                "citation_index": c.citation_index,
                "excerpt": c.excerpt,
                "citation_metadata": {
                    "ticker": c.ticker,
                    "filing_date": c.filing_date,
                    "section": c.section,
                },
            }
            for c in validated_answer.citations
        ]
        created_citations = create_citations(
            db=db,
            message_id=asst_msg.id,
            citations_data=citations_data,
        )
        asst_msg.citations = created_citations
    else:
        asst_msg.citations = []

    return asst_msg


async def execute_chat_turn_stream(
    db: Session,
    user: AuthenticatedUser,
    thread_id: UUID,
    user_content: str,
) -> AsyncGenerator[str, None]:
    """
    Execute one full interactive chat turn yielding Server-Sent Events (SSE) in real time:
      1. status {step, label, elapsed_ms}
      2. retrieval_started {query, filters, elapsed_ms}
      3. retrieved {vector_hits, keyword_hits, merged, passages, elapsed_ms}
      4. validating {elapsed_ms}
      5. done {full MessageResponse, elapsed_ms}
      6. error {message, elapsed_ms}
    """
    t0 = time.perf_counter()

    def elapsed_ms() -> int:
        return int((time.perf_counter() - t0) * 1000)

    def format_sse(event: str, data: dict[str, Any]) -> str:
        payload = {"elapsed_ms": elapsed_ms(), **data}
        return f"event: {event}\ndata: {json.dumps(payload)}\n\n"

    clean_content = user_content.strip()
    if not clean_content:
        yield format_sse("error", {"message": "Message content cannot be empty"})
        return

    thread = get_thread_by_id(db, thread_id=thread_id, user_id=user.id)
    if thread is None:
        yield format_sse("error", {"message": "Thread not found"})
        return

    # 1. Initial status event
    yield format_sse("status", {"step": "init", "label": "Searching SEC filings corpus"})

    # 2. Persist user message
    create_message(
        db=db,
        thread_id=thread_id,
        role="user",
        content=clean_content,
    )

    if thread.title in (None, "", "New Research Thread"):
        snippet = clean_content[:40] + ("..." if len(clean_content) > 40 else "")
        update_thread_title(db, thread_id=thread_id, user_id=user.id, title=snippet)

    # 3. Setup event queue and dependencies
    event_queue: asyncio.Queue[tuple[str, dict[str, Any]]] = asyncio.Queue()

    def on_event(event_name: str, payload: dict[str, Any]) -> None:
        event_queue.put_nowait((event_name, payload))

    retriever = DocumentRetriever(db=db)
    deps = DocumentAgentDeps(
        user_id=user.id,
        thread_id=thread_id,
        retriever=retriever,
        event_callback=on_event,
    )

    logger.info("Executing streaming agent turn", thread_id=str(thread_id), user_id=str(user.id))

    # Run agent in background task
    agent_task = asyncio.create_task(document_agent.run(clean_content, deps=deps))

    try:
        while not agent_task.done():
            try:
                event_name, payload = await asyncio.wait_for(event_queue.get(), timeout=0.1)
                yield format_sse(event_name, payload)
            except asyncio.TimeoutError:
                pass

        # Flush any remaining queued events
        while not event_queue.empty():
            event_name, payload = event_queue.get_nowait()
            yield format_sse(event_name, payload)

        agent_result = await agent_task
        raw_output = agent_result.output
        if isinstance(raw_output, str):
            grounded_answer = GroundedAnswer(answer=raw_output, citations=[])
        else:
            grounded_answer = raw_output
    except Exception as e:
        logger.error("Streaming agent execution error", error=str(e))
        yield format_sse("error", {"message": f"Agent error: {str(e)}"})
        return

    # 4. Status: writing answer & validating
    yield format_sse("status", {"step": "validating", "label": "Verifying citations against SEC chunks"})
    yield format_sse("validating", {})

    # 5. Validate grounding
    validator = GroundingValidator()
    val_result = validator.validate(
        answer=grounded_answer,
        retrieved_passages=deps.retrieved_passages,
    )
    validated_answer = val_result.answer

    # 6. Build trace metadata and persist assistant message
    passages_summary = [
        {
            "n": idx + 1,
            "ticker": p.ticker,
            "fiscal_year": getattr(p, "fiscal_year", None) or (int(p.filing_date[:4]) if p.filing_date and p.filing_date[:4].isdigit() else None),
            "section": p.section or "General Section",
        }
        for idx, p in enumerate(deps.retrieved_passages)
    ]
    trace_data = {
        "total_elapsed_ms": elapsed_ms(),
        "retrieved_count": len(deps.retrieved_passages),
        "passages": passages_summary,
    }

    asst_msg = create_message(
        db=db,
        thread_id=thread_id,
        role="assistant",
        content=validated_answer.answer,
        message_json={"agent_trace": trace_data},
    )

    # 7. Persist citations
    if validated_answer.citations:
        citations_data = [
            {
                "chunk_id": c.chunk_id,
                "citation_index": c.citation_index,
                "excerpt": c.excerpt,
                "citation_metadata": {
                    "ticker": c.ticker,
                    "filing_date": c.filing_date,
                    "section": c.section,
                },
            }
            for c in validated_answer.citations
        ]
        created_citations = create_citations(
            db=db,
            message_id=asst_msg.id,
            citations_data=citations_data,
        )
        asst_msg.citations = created_citations
    else:
        asst_msg.citations = []

    # 8. Emit done event with the full MessageResponse payload
    msg_response = MessageResponse.model_validate(asst_msg)
    yield format_sse("done", msg_response.model_dump(mode="json"))

    # Final stream terminal
    yield "data: [DONE]\n\n"
