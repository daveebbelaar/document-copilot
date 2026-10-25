"""
Single source of truth for all environment configuration.

All application code imports from here; nothing else reads os.environ directly.
Pydantic-settings reads the .env file automatically (via env_file = ".env").
The app will fail fast at startup if a required variable is missing or blank.
"""
from __future__ import annotations

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Looks for .env relative to the working directory (i.e. backend/).
        # env_file is ignored in production where vars come from the environment directly.
        env_file=".env",
        env_file_encoding="utf-8",
        # Extra fields in .env that are not declared here are silently ignored.
        extra="ignore",
    )

    # ------------------------------------------------------------------
    # Supabase
    # ------------------------------------------------------------------
    supabase_url: str = Field(..., description="Supabase project URL, e.g. https://<ref>.supabase.co")
    supabase_anon_key: str = Field(..., description="Supabase anon/public key (browser-safe)")
    supabase_service_role_key: str = Field(
        ..., description="Supabase service-role secret key (backend only)"
    )

    # ------------------------------------------------------------------
    # Postgres / Alembic (direct session connection, NOT transaction pooler)
    # ------------------------------------------------------------------
    database_url: str = Field(
        ...,
        description="Direct postgresql:// connection string for Alembic and SQLAlchemy.",
    )

    # ------------------------------------------------------------------
    # LLM / Embeddings (OpenAI SDK — can point at OpenRouter base URL)
    # ------------------------------------------------------------------
    # Your OpenRouter API key (starts with sk-or-...) goes in OPENAI_API_KEY.
    # The OpenAI Python SDK reads this field regardless of which provider is used.
    openai_api_key: str = Field(..., description="API key — OpenRouter sk-or-... or OpenAI sk-...")

    # Set to https://openrouter.ai/api/v1 when using OpenRouter.
    # The OpenAI SDK uses this as its base URL for all requests.
    openai_base_url: str = Field(
        default="https://openrouter.ai/api/v1",
        description="Base URL for the OpenAI-compatible API. OpenRouter default.",
    )

    # Chat model used by the PydanticAI agent.
    # openrouter/free auto-routes to the best available free model with tool calling.
    openai_chat_model: str = Field(
        default="openrouter/free",
        description="Chat model identifier. Must support tool calling.",
    )

    # Embedding model and dimensions — BOTH must match the pgvector column size.
    # openai/text-embedding-3-small produces 1536-dim vectors (under pgvector's 2000 HNSW limit).
    openai_embedding_model: str = Field(
        default="openai/text-embedding-3-small",
        description="Embedding model identifier (can be routed via OpenRouter or direct OpenAI).",
    )
    openai_embedding_dimensions: int = Field(
        default=1536,
        description="Embedding vector dimensions. Must match the pgvector column (1536).",
    )

    # ------------------------------------------------------------------
    # Agent execution limits (conservative free-tier defaults)
    # ------------------------------------------------------------------
    agent_max_tool_calls: int = Field(
        default=5,
        description="Maximum tool calls the agent may make per user turn.",
    )
    agent_max_iterations: int = Field(
        default=6,
        description="Maximum agent reasoning iterations per user turn.",
    )
    retrieval_max_chunks: int = Field(
        default=8,
        description="Maximum number of document chunks retrieved per query.",
    )
    retrieval_max_neighbors: int = Field(
        default=2,
        description="Neighboring chunks fetched around each selected chunk for grounding context.",
    )
    llm_max_output_tokens: int = Field(
        default=1024,
        description="Maximum tokens the LLM may produce per assistant turn.",
    )
    http_timeout_seconds: float = Field(
        default=60.0,
        description="Timeout (seconds) for outbound HTTP requests to LLM/embedding providers.",
    )
    max_retries: int = Field(
        default=2,
        description="Maximum retries on rate-limit or transient LLM errors before giving up.",
    )

    # ------------------------------------------------------------------
    # Server
    # ------------------------------------------------------------------
    allowed_origins: str = Field(
        default="http://localhost:5173",
        description="Comma-separated list of browser origins allowed by CORS.",
    )

    @field_validator("supabase_url", "supabase_anon_key", "supabase_service_role_key",
                     "database_url", "openai_api_key", "openai_base_url", mode="before")
    @classmethod
    def _must_be_non_empty(cls, value: str, info: object) -> str:
        """Fail fast if a required credential is empty or whitespace."""
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{info} must not be empty")
        return value

    @property
    def cors_origins(self) -> list[str]:
        """Parse allowed_origins into a list for FastAPI CORSMiddleware."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


# Module-level singleton. Import this object everywhere instead of calling os.getenv.
settings = Settings()
