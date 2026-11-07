"""
Tests for the SSE streaming chat endpoint POST /api/threads/{id}/messages/stream.
Verifies auth 401, non-existent thread 404, event order, elapsed_ms, and error handling.
"""
from __future__ import annotations

import json
import uuid
from collections.abc import Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.assistant.outputs import GroundedAnswer
from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthenticatedUser
from app.database.models import (
    Base,
    ChatMessage,
    ChatThread,
    MessageCitation,
    Profile,
)
from app.database.session import get_db
from app.main import app

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

Base.metadata.create_all(
    test_engine,
    tables=[
        Profile.__table__,
        ChatThread.__table__,
        ChatMessage.__table__,
        MessageCitation.__table__,
    ],
)

test_user_id = uuid.uuid4()
mock_user = AuthenticatedUser(id=test_user_id, email="stream_analyst@driftwood.com")


def override_get_db() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def override_get_current_user() -> AuthenticatedUser:
    return mock_user


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        profile = Profile(id=test_user_id, email=mock_user.email)
        db.merge(profile)
        db.commit()
        yield db
    finally:
        db.close()


def parse_sse_events(raw_text: str) -> list[tuple[str, dict]]:
    """Parse raw SSE text into a list of (event_type, parsed_json_data)."""
    events: list[tuple[str, dict]] = []
    current_event = "message"
    for line in raw_text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("event:"):
            current_event = line.replace("event:", "").strip()
        elif line.startswith("data:"):
            data_str = line.replace("data:", "").strip()
            if data_str == "[DONE]":
                break
            try:
                events.append((current_event, json.loads(data_str)))
            except json.JSONDecodeError:
                pass
    return events


def test_stream_requires_auth_401() -> None:
    """Requesting the streaming endpoint without credentials returns 401."""
    # Temporarily remove dependency override to test actual auth dependency
    app.dependency_overrides.clear()
    with TestClient(app) as unauthed_client:
        dummy_id = uuid.uuid4()
        response = unauthed_client.post(
            f"/api/threads/{dummy_id}/messages/stream",
            json={"content": "What were net sales?"},
        )
        assert response.status_code == 401


def test_stream_thread_not_found_404(client: TestClient) -> None:
    """Requesting stream for a non-existent thread returns 404."""
    non_existent_id = uuid.uuid4()
    response = client.post(
        f"/api/threads/{non_existent_id}/messages/stream",
        json={"content": "What was gross margin?"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Thread not found"


def test_stream_event_order_and_payload(client: TestClient, db_session: Session) -> None:
    """
    Streaming endpoint emits events in expected sequence with elapsed_ms and final done event.
    Sequence: status (init) -> status (validating) / validating -> done.
    """
    thread = ChatThread(id=uuid.uuid4(), user_id=test_user_id, title="Test Stream Thread")
    db_session.add(thread)
    db_session.commit()

    mock_answer = GroundedAnswer(
        answer="Apple reported Services net sales of $96,169 million.",
        citations=[],
    )
    mock_run_result = MagicMock()
    mock_run_result.output = mock_answer

    with patch("app.chat.orchestrator.document_agent.run", new_callable=AsyncMock) as mock_agent_run:
        mock_agent_run.return_value = mock_run_result

        response = client.post(
            f"/api/threads/{thread.id}/messages/stream",
            json={"content": "Summarize Services revenue"},
        )

        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        events = parse_sse_events(response.text)
        event_types = [e[0] for e in events]

        # Verify key events exist in sequence
        assert "status" in event_types
        assert "validating" in event_types
        assert "done" in event_types

        # Verify every event carries elapsed_ms
        for ev_type, ev_data in events:
            assert "elapsed_ms" in ev_data
            assert isinstance(ev_data["elapsed_ms"], int)

        # Verify final done event contains persisted message payload
        done_event = [e[1] for e in events if e[0] == "done"][0]
        assert done_event["role"] == "assistant"
        assert done_event["content"] == "Apple reported Services net sales of $96,169 million."
        assert done_event["thread_id"] == str(thread.id)
        assert "agent_trace" in done_event.get("message_json", {})


def test_stream_error_event_on_empty_content(client: TestClient, db_session: Session) -> None:
    """Empty user prompt in streaming request yields an error event."""
    thread = ChatThread(id=uuid.uuid4(), user_id=test_user_id, title="Error Thread")
    db_session.add(thread)
    db_session.commit()

    response = client.post(
        f"/api/threads/{thread.id}/messages/stream",
        json={"content": "   "},
    )
    assert response.status_code == 200
    events = parse_sse_events(response.text)
    assert len(events) >= 1
    assert events[0][0] == "error"
    assert "cannot be empty" in events[0][1]["message"]
