from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole, UserStatus


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    email_verified_at: datetime | None
    display_name: str
    phone_number: str | None
    phone_verified_at: datetime | None
    profile_image_url: str | None
    status: UserStatus
    role: UserRole
    timezone: str | None
    locale: str | None
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime
    terms_agreed_at: datetime | None
    terms_version: str | None


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    phone_number: str | None = Field(default=None, max_length=32)
    profile_image_url: str | None = Field(default=None, max_length=1024)
    timezone: str | None = Field(default=None, max_length=64)
    locale: str | None = Field(default=None, max_length=16)


class AdminMeRead(BaseModel):
    """Admin-only profile fields (telegram + per-kind notification toggles)."""

    model_config = ConfigDict(from_attributes=True)

    telegram_user_id: str | None
    notify_inquiry_house: bool
    notify_inquiry_metrics: bool
    notify_inquiry_portfolio: bool
    notify_open_house_inquiry: bool
    notify_inquiry_matched_property: bool
    notify_inquiry_delivery: bool
    notify_mbti: bool
    notify_delivery_publish: bool


class AdminMeUpdate(BaseModel):
    telegram_user_id: str | None = Field(default=None, max_length=64)
    notify_inquiry_house: bool | None = None
    notify_inquiry_metrics: bool | None = None
    notify_inquiry_portfolio: bool | None = None
    notify_open_house_inquiry: bool | None = None
    notify_inquiry_matched_property: bool | None = None
    notify_inquiry_delivery: bool | None = None
    notify_mbti: bool | None = None
    notify_delivery_publish: bool | None = None
