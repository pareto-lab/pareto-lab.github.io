from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.types import IntegerEnum, IntStrEnum

if TYPE_CHECKING:
    from app.models.auth_token import AuthToken
    from app.models.oauth_account import OAuthAccount
    from app.models.user_admin import UserAdmin


class UserStatus(IntStrEnum):
    active = ("active", 0)
    suspended = ("suspended", 1)
    deleted = ("deleted", 2)


class UserRole(IntStrEnum):
    user = ("user", 0)
    admin = ("admin", 1)
    owner = ("owner", 2)


# Hierarchical privilege ranking. Higher number = higher privilege.
# Future fine-grained perms can layer on top via a separate table; this rank
# stays the simple "is at least X" check.
ROLE_RANK: dict[UserRole, int] = {
    UserRole.user: 0,
    UserRole.admin: 1,
    UserRole.owner: 2,
}


def role_at_least(role: UserRole, minimum: UserRole) -> bool:
    return ROLE_RANK[role] >= ROLE_RANK[minimum]


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Null when the user only signed up via OAuth.
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    phone_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    profile_image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    status: Mapped[UserStatus] = mapped_column(
        IntegerEnum(UserStatus),
        default=UserStatus.active,
        nullable=False,
    )
    role: Mapped[UserRole] = mapped_column(
        IntegerEnum(UserRole),
        default=UserRole.user,
        nullable=False,
    )

    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    locale: Mapped[str | None] = mapped_column(String(16), nullable=True)

    terms_agreed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    terms_version: Mapped[str | None] = mapped_column(String(50), nullable=True)

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Soft ban — admin-controlled. Setting banned_at != NULL blocks login and
    # invalidates existing sessions. Independent of `status`/`deleted_at`.
    banned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ban_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    banned_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    oauth_accounts: Mapped[list[OAuthAccount]] = relationship(
        "OAuthAccount",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    auth_tokens: Mapped[list[AuthToken]] = relationship(
        "AuthToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    admin_profile: Mapped[UserAdmin | None] = relationship(
        "UserAdmin",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def has_password(self) -> bool:
        return self.password_hash is not None

    @property
    def is_banned(self) -> bool:
        return self.banned_at is not None

    @property
    def is_active(self) -> bool:
        return (
            self.status == UserStatus.active
            and self.deleted_at is None
            and self.banned_at is None
        )
