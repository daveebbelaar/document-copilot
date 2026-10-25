"""
Unit tests for app.config.

Tests that:
  - Settings loads without error when all required env vars are present.
  - cors_origins property parses correctly.
  - Agent execution limits are set to conservative defaults.

These tests do NOT call any external API or database. They rely only on the
environment file being present and parseable. Mark with 'not integration' to
run in CI without real credentials.
"""
from __future__ import annotations


def test_settings_loads_successfully() -> None:
    """Settings should load without raising if .env is populated correctly."""
    # If this import fails, the test fails with a clear ImportError / ValidationError.
    from app.config import settings

    assert settings.supabase_url.startswith("http"), "SUPABASE_URL should be a URL"
    assert len(settings.supabase_anon_key) > 20, "SUPABASE_ANON_KEY should be a non-trivial key"
    assert len(settings.openai_api_key) > 10, "OPENAI_API_KEY should be non-trivial"


def test_cors_origins_parsed_as_list() -> None:
    """cors_origins should always return a list, even from a comma-separated string."""
    from app.config import settings

    origins = settings.cors_origins
    assert isinstance(origins, list), "cors_origins should be a list"
    assert all(o.startswith("http") for o in origins), "each origin should be a URL"


def test_conservative_agent_defaults() -> None:
    """Agent execution limits should be set to conservative free-tier values by default."""
    from app.config import settings

    assert settings.agent_max_tool_calls <= 10, "max_tool_calls should be conservative"
    assert settings.agent_max_iterations <= 10, "max_iterations should be conservative"
    assert settings.retrieval_max_chunks <= 20, "max_chunks should be bounded"
    assert settings.llm_max_output_tokens <= 4096, "max_output_tokens should be bounded"


def test_embedding_dimensions_positive() -> None:
    """Embedding dimensions must be a positive integer matching a known model."""
    from app.config import settings

    assert settings.openai_embedding_dimensions > 0
    # Known dimension sets for common models:
    #   768  — smaller models
    #   1024 — medium models
    #   1536 — openai/text-embedding-3-small
    #   2048 — nvidia/nemotron-3-embed-1b:free  ← current OpenRouter free default
    #   3072 — openai/text-embedding-3-large
    #   4096 — nvidia/nemotron-3.5-embed-8b:free
    valid_dims = {768, 1024, 1536, 2048, 3072, 4096}
    assert settings.openai_embedding_dimensions in valid_dims, (
        f"Unexpected embedding dims {settings.openai_embedding_dimensions} — "
        "verify this matches your pgvector column before running migrations"
    )
