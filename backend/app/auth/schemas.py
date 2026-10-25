"""
Authentication schemas.
"""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, EmailStr


class AuthenticatedUser(BaseModel):
    """Represents a validated Supabase authenticated user."""

    id: UUID
    email: EmailStr
