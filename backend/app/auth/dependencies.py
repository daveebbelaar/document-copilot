"""
Supabase JWT verification and current user dependency for FastAPI.
"""
from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.schemas import AuthenticatedUser
from app.database.models import Profile
from app.database.session import get_db
from app.database.supabase import get_supabase_client

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> AuthenticatedUser:
    """
    FastAPI dependency that extracts and validates the Supabase JWT.

    Ensures:
      1. Authorization header with Bearer token is provided.
      2. Token is verified against Supabase Auth.
      3. A corresponding row exists in the `profiles` table for foreign key integrity.

    Raises:
      HTTPException(401) if token is missing, invalid, or expired.
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    supabase = await get_supabase_client()

    try:
        response = await supabase.auth.get_user(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if response is None or response.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found for provided token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_obj = response.user
    user_id = uuid.UUID(user_obj.id)
    email = user_obj.email or ""

    # Ensure profile row exists in local database
    profile = db.get(Profile, user_id)
    if profile is None:
        profile = Profile(id=user_id, email=email)
        db.add(profile)
        db.commit()

    return AuthenticatedUser(id=user_id, email=email)
