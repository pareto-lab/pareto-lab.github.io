from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole, UserStatus


class AdminUserRead(BaseModel):
    """User payload returned to admins — includes ban + role + audit fields."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    email_verified_at: datetime | None
    display_name: str
    phone_number: str | None
    profile_image_url: str | None
    status: UserStatus
    role: UserRole
    timezone: str | None
    locale: str | None
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    banned_at: datetime | None
    ban_reason: str | None
    banned_by_id: uuid.UUID | None


class AdminUserListResponse(BaseModel):
    items: list[AdminUserRead]
    total: int
    skip: int
    limit: int


class BanUserRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class SetRoleRequest(BaseModel):
    """Owner-only. Promotion to `owner` is disallowed via API on purpose —
    use `cli.py create-owner` or change directly in the DB."""

    role: UserRole = Field(description="Target role: 'user' or 'admin'")
