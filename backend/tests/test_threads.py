"""
Unit tests for the Threads API endpoints using FastAPI dependency overrides and SQLite in-memory.
"""
from __future__ import annotations

import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

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

# SQLite in-memory database shared across single thread
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Create only the non-pgvector tables in SQLite
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
other_user_id = uuid.uuid4()
mock_user = AuthenticatedUser(id=test_user_id, email="analyst@driftwood.com")


def override_get_db() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def override_get_current_user() -> AuthenticatedUser:
    return mock_user


@pytest.fixture(autouse=True)
def setup_overrides_and_profile() -> Generator[None, None, None]:
    """Register dependency overrides and ensure test profile exists."""
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    db = TestingSessionLocal()
    if not db.get(Profile, test_user_id):
        db.add(Profile(id=test_user_id, email="analyst@driftwood.com"))
        db.commit()
    if not db.get(Profile, other_user_id):
        db.add(Profile(id=other_user_id, email="other@driftwood.com"))
        db.commit()
    db.close()

    yield

    app.dependency_overrides.clear()


client = TestClient(app)


def test_create_and_list_threads() -> None:
    """User can create a thread and list their threads."""
    create_resp = client.post("/api/threads", json={"title": "Apple 10-K Analysis"})
    assert create_resp.status_code == 201
    thread_data = create_resp.json()
    assert thread_data["title"] == "Apple 10-K Analysis"
    thread_id = thread_data["id"]

    list_resp = client.get("/api/threads")
    assert list_resp.status_code == 200
    threads = list_resp.json()
    assert any(t["id"] == thread_id for t in threads)


def test_get_thread_by_id() -> None:
    """User can retrieve their own thread by ID."""
    create_resp = client.post("/api/threads", json={"title": "Tesla Q3 2024"})
    thread_id = create_resp.json()["id"]

    get_resp = client.get(f"/api/threads/{thread_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == thread_id


def test_update_thread_title() -> None:
    """User can rename a thread."""
    create_resp = client.post("/api/threads", json={"title": "Old Title"})
    thread_id = create_resp.json()["id"]

    patch_resp = client.patch(f"/api/threads/{thread_id}", json={"title": "Updated Title"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["title"] == "Updated Title"


def test_delete_thread() -> None:
    """User can delete their own thread."""
    create_resp = client.post("/api/threads", json={"title": "To Delete"})
    thread_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/threads/{thread_id}")
    assert del_resp.status_code == 204

    get_resp = client.get(f"/api/threads/{thread_id}")
    assert get_resp.status_code == 404


def test_get_messages_with_citations() -> None:
    """Messages and citations are returned in chronological order."""
    from app.database.chats import create_citations, create_message

    create_resp = client.post("/api/threads", json={"title": "Conversation with Citations"})
    thread_id = uuid.UUID(create_resp.json()["id"])

    db = TestingSessionLocal()
    # Add user query message
    create_message(db, thread_id=thread_id, role="user", content="What was Apple's gross margin?")
    create_message(
        db,
        thread_id=thread_id,
        role="assistant",
        content="Apple's gross margin was 46.2% [1].",
    )
    asst_msg = db.query(ChatMessage).filter_by(role="assistant").first()
    create_citations(db, message_id=asst_msg.id, citations_data=[{
        "citation_index": 1,
        "excerpt": "Gross margin was 46.2 percent for fiscal year 2024.",
        "citation_metadata": {"ticker": "AAPL", "form": "10-K"},
    }])
    db.close()

    resp = client.get(f"/api/threads/{thread_id}/messages")
    assert resp.status_code == 200
    messages = resp.json()
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    assert len(messages[1]["citations"]) == 1
    assert messages[1]["citations"][0]["citation_index"] == 1
    assert "46.2" in messages[1]["citations"][0]["excerpt"]


def test_cannot_access_other_users_thread() -> None:
    """Users cannot view or delete threads belonging to another user."""
    from app.database.chats import create_thread

    db = TestingSessionLocal()
    other_thread = create_thread(db, user_id=other_user_id, title="Secret Other Thread")
    other_thread_id = other_thread.id
    db.close()

    # Current user tries to access other user's thread
    get_resp = client.get(f"/api/threads/{other_thread_id}")
    assert get_resp.status_code == 404

    del_resp = client.delete(f"/api/threads/{other_thread_id}")
    assert del_resp.status_code == 404

    msg_resp = client.get(f"/api/threads/{other_thread_id}/messages")
    assert msg_resp.status_code == 404
