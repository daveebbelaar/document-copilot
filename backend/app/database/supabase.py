"""
Supabase client helpers for Document Copilot.

Provides both:
  - Anon client: for client-equivalent user operations
  - Service-role client: for server-side privileged queries (document ingestion, RLS bypass)
"""
from __future__ import annotations

from supabase import AsyncClient, create_async_client

from app.config import settings

_async_anon_client: AsyncClient | None = None
_async_service_client: AsyncClient | None = None


async def get_supabase_client() -> AsyncClient:
    """Return a shared async Supabase client initialized with the anon key."""
    global _async_anon_client
    if _async_anon_client is None:
        _async_anon_client = await create_async_client(
            settings.supabase_url,
            settings.supabase_anon_key,
        )
    return _async_anon_client


async def get_supabase_service_client() -> AsyncClient:
    """
    Return a shared async Supabase client initialized with the service-role key.

    Only used server-side for privileged writes (like ingestion) or admin actions.
    Never exposed to client code or sent to the browser.
    """
    global _async_service_client
    if _async_service_client is None:
        _async_service_client = await create_async_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _async_service_client
