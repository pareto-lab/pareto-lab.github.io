from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MbtiResult(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mbti_results"

    participant_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    email_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    age: Mapped[str] = mapped_column(String(50), nullable=False)
    gender: Mapped[str] = mapped_column(String(50), nullable=False)
    family_type: Mapped[str] = mapped_column(String(80), nullable=False)
    driving: Mapped[bool] = mapped_column(Boolean, nullable=False)
    plants: Mapped[bool] = mapped_column(Boolean, nullable=False)
    pets: Mapped[bool] = mapped_column(Boolean, nullable=False)
    camping: Mapped[bool] = mapped_column(Boolean, nullable=False)
    hobbies: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    dreams: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    source: Mapped[str] = mapped_column(String(40), default="anonymous", nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(80), nullable=True)
