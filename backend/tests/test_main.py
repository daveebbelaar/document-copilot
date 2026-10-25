"""
Unit tests for the FastAPI application.

Tests the /health endpoint using FastAPI's TestClient (no real server started,
no database connections, no LLM calls — httpx runs in-process against the ASGI app).
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_200() -> None:
    response = client.get("/health")
    assert response.status_code == 200


def test_health_returns_ok_body() -> None:
    response = client.get("/health")
    body = response.json()
    assert body == {"status": "ok"}, f"Unexpected body: {body}"


def test_health_content_type_json() -> None:
    response = client.get("/health")
    assert "application/json" in response.headers["content-type"]
