from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentAdmin, CurrentUser, DbSession
from app.schemas.user import (
    AdminMeRead,
    AdminMeUpdate,
    UserRead,
    UserUpdate,
)
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def get_me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)


@router.patch("/me", response_model=UserRead)
async def update_me(
    payload: UserUpdate,
    user: CurrentUser,
    db: DbSession,
) -> UserRead:
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


@router.get("/me/admin-settings", response_model=AdminMeRead)
async def get_admin_me(admin: CurrentAdmin, db: DbSession) -> AdminMeRead:
    profile = await user_service.ensure_admin_profile(db, user=admin)
    await db.commit()
    return AdminMeRead.model_validate(profile)


@router.patch("/me/admin-settings", response_model=AdminMeRead)
async def update_admin_me(
    payload: AdminMeUpdate,
    admin: CurrentAdmin,
    db: DbSession,
) -> AdminMeRead:
    profile = await user_service.ensure_admin_profile(db, user=admin)
    data = payload.model_dump(exclude_unset=True)
    if "telegram_user_id" in data and data["telegram_user_id"] is not None:
        cleaned = data["telegram_user_id"].strip()
        data["telegram_user_id"] = cleaned or None
    for key, value in data.items():
        setattr(profile, key, value)
    await db.commit()
    await db.refresh(profile)
    return AdminMeRead.model_validate(profile)
