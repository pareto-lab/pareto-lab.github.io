from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.types import IntegerEnum, IntStrEnum


class InquiryType(IntStrEnum):
    house_question = ("house_question", 0)
    metrics_question = ("metrics_question", 1)
    portfolio_request = ("portfolio_request", 2)
    matched_property_subscribe = ("matched_property_subscribe", 3)
    delivery_question = ("delivery_question", 4)


class Inquiry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "inquiries"

    type: Mapped[InquiryType] = mapped_column(
        IntegerEnum(InquiryType),
        index=True,
        nullable=False,
    )
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )

    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    question: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contact_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)

    privacy_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(80), nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
