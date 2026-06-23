from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentAdmin, CurrentOwner, DbSession
from app.core.session import destroy_all_user_sessions
from app.models import User
from app.models.user import ROLE_RANK, UserRole
from app.schemas.admin import (
    AdminUserListResponse,
    AdminUserRead,
    BanUserRequest,
    SetRoleRequest,
)
from app.services import user_service

router = APIRouter(prefix="/admin", tags=["admin"])


def _ensure_can_act_on(actor: User, target: User) -> None:
    """Forbid acting on yourself or on a peer / superior."""
    if actor.id == target.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot perform admin action on your own account",
        )
    if ROLE_RANK[target.role] >= ROLE_RANK[actor.role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot perform admin action on a user with equal or higher role",
        )


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    admin: CurrentAdmin,
    db: DbSession,
    q: str | None = Query(default=None, description="Match email or display name"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> AdminUserListResponse:
    items, total = await user_service.search_users(db, query=q, skip=skip, limit=limit)
    return AdminUserListResponse(
        items=[AdminUserRead.model_validate(u) for u in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/users/{user_id}", response_model=AdminUserRead)
async def get_user(
    user_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
) -> AdminUserRead:
    user = await user_service.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return AdminUserRead.model_validate(user)


@router.post("/users/{user_id}/ban", response_model=AdminUserRead)
async def ban_user(
    user_id: uuid.UUID,
    payload: BanUserRequest,
    admin: CurrentAdmin,
    db: DbSession,
) -> AdminUserRead:
    target = await user_service.get_user_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    _ensure_can_act_on(admin, target)

    await user_service.ban_user(db, target=target, actor=admin, reason=payload.reason)
    await db.commit()
    await db.refresh(target)
    # Force-logout the banned user's existing sessions across all devices.
    await destroy_all_user_sessions(target.id)
    return AdminUserRead.model_validate(target)


@router.post("/users/{user_id}/unban", response_model=AdminUserRead)
async def unban_user(
    user_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
) -> AdminUserRead:
    target = await user_service.get_user_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    _ensure_can_act_on(admin, target)

    await user_service.unban_user(db, target=target)
    await db.commit()
    await db.refresh(target)
    return AdminUserRead.model_validate(target)


@router.post("/users/{user_id}/role", response_model=AdminUserRead)
async def set_role(
    user_id: uuid.UUID,
    payload: SetRoleRequest,
    owner: CurrentOwner,
    db: DbSession,
) -> AdminUserRead:
    """Owner-only: grant or revoke admin role on a user.

    Constraints:
      - Cannot change your own role (avoid self-coup).
      - Cannot change another Owner's role via API (DB only).
      - Cannot promote to Owner via API (use `cli.py` or DB).
    """
    if payload.role == UserRole.owner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Promotion to owner must be done via CLI or DB",
        )
    target = await user_service.get_user_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.id == owner.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot change your own role",
        )
    if target.role == UserRole.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot change another Owner's role via API",
        )

    if target.role == payload.role:
        return AdminUserRead.model_validate(target)

    target.role = payload.role
    if payload.role in (UserRole.admin, UserRole.owner):
        await user_service.ensure_admin_profile(db, user=target)
    await db.commit()
    await db.refresh(target)
    return AdminUserRead.model_validate(target)
