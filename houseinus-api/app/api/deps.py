from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import SessionData, load_session, touch_session
from app.database import get_db
from app.models import User
from app.models.user import UserRole, role_at_least
from app.services import user_service

# Swagger UI's Authorize button posts to this URL with username/password
# form fields and expects {access_token, token_type} back.
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/token",
    auto_error=False,
)


async def get_current_session(
    token: Annotated[str | None, Depends(oauth2_scheme)] = None,
) -> SessionData:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    session = await load_session(token)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    await touch_session(token)
    return session


async def get_current_user(
    session: Annotated[SessionData, Depends(get_current_session)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    user = await user_service.get_user_by_id(db, session.user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive"
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentSession = Annotated[SessionData, Depends(get_current_session)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


def require_role(minimum: UserRole):
    """Dependency factory: ensure the current user has at least `minimum` role."""

    async def _check(user: CurrentUser) -> User:
        if not role_at_least(user.role, minimum):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient privileges",
            )
        return user

    return _check


CurrentAdmin = Annotated[User, Depends(require_role(UserRole.admin))]
CurrentOwner = Annotated[User, Depends(require_role(UserRole.owner))]
