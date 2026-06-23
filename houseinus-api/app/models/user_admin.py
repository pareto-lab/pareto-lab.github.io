from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class UserAdmin(TimestampMixin, Base):
    """Admin-only profile slice for users with admin/owner role.

    A row exists iff the user has been granted admin or owner role at least
    once. Demotion does not delete the row — settings (telegram id, per-kind
    notification toggles) are preserved in case the user is re-promoted.
    """

    __tablename__ = "user_admins"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    telegram_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    notify_inquiry_house: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    notify_inquiry_metrics: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    notify_inquiry_portfolio: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    notify_open_house_inquiry: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    notify_inquiry_matched_property: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    notify_inquiry_delivery: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    notify_mbti: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    notify_delivery_publish: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    user: Mapped[User] = relationship("User", back_populates="admin_profile")
