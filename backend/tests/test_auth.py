"""
Unit tests for Supabase JWT verification and get_current_user dependency.
"""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.auth.schemas import AuthenticatedUser
from app.main import app

client = TestClient(app)


def test_missing_auth_header_returns_401() -> None:
    """Requests without Authorization header must return 401."""
    response = client.get("/api/threads")
    assert response.status_code == 401
    assert "Missing Authorization header" in response.json()["detail"]


def test_malformed_token_returns_401() -> None:
    """Requests with malformed token must return 401."""
    response = client.get(
        "/api/threads",
        headers={"Authorization": "Bearer not-a-valid-jwt-token"},
    )
    assert response.status_code == 401
    assert "Invalid or expired" in response.json()["detail"]


def test_valid_token_resolves_authenticated_user() -> None:
    """Mocking a valid Supabase response should resolve AuthenticatedUser."""
    import asyncio

    test_user_id = uuid.uuid4()
    test_email = "analyst@driftwood.com"

    mock_user_obj = MagicMock()
    mock_user_obj.id = str(test_user_id)
    mock_user_obj.email = test_email

    mock_auth_response = MagicMock()
    mock_auth_response.user = mock_user_obj

    mock_supabase = MagicMock()
    mock_supabase.auth.get_user = AsyncMock(return_value=mock_auth_response)

    async def run() -> None:
        with patch("app.auth.dependencies.get_supabase_client", return_value=mock_supabase):
            from app.auth.dependencies import get_current_user

            mock_db = MagicMock()
            mock_db.get.return_value = MagicMock()  # profile exists

            mock_creds = MagicMock()
            mock_creds.credentials = "valid.mocked.jwt"

            user = await get_current_user(credentials=mock_creds, db=mock_db)
            assert isinstance(user, AuthenticatedUser)
            assert user.id == test_user_id
            assert user.email == test_email

    asyncio.run(run())
