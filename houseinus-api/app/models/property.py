from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.types import IntegerEnum, IntStrEnum


class PropertyStatus(IntStrEnum):
    draft = ("draft", 0)
    published = ("published", 1)
    archived = ("archived", 2)


class PropertyImage(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "property_images"

    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    byte_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    caption: Mapped[str | None] = mapped_column(String(500), nullable=True)
    alt: Mapped[str | None] = mapped_column(String(500), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    property: Mapped["Property"] = relationship(
        "Property", back_populates="images", foreign_keys=[property_id]
    )


class Property(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "properties"

    slug: Mapped[str | None] = mapped_column(
        String(120), unique=True, index=True, nullable=True
    )
    delivery_token: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    delivery_birthdate: Mapped[str | None] = mapped_column(String(8), nullable=True)
    status: Mapped[PropertyStatus] = mapped_column(
        IntegerEnum(PropertyStatus),
        default=PropertyStatus.draft,
        index=True,
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(
        Integer, default=0, index=True, nullable=False
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(500), nullable=True)
    location: Mapped[str] = mapped_column(String(200), nullable=False)
    price: Mapped[int] = mapped_column(BigInteger, nullable=False)

    hero_image_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("property_images.id", ondelete="SET NULL"),
        nullable=True,
    )
    portfolio_thumb_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("property_images.id", ondelete="SET NULL"),
        nullable=True,
    )

    lifestyle_story: Mapped[str | None] = mapped_column(Text, nullable=True)
    lifestyle_story_overlay: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    lifestyle_layout: Mapped[str | None] = mapped_column(Text, nullable=True)

    # JSONB columns — see docs/EditFormat below.
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    lifestyle_highlights: Mapped[list[str]] = mapped_column(
        JSONB, default=list, nullable=False
    )
    specs: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    loan_info: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, nullable=False
    )
    house_plan_specs: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=lambda: {"main": [], "collapsed": []},
        nullable=False,
    )
    nearby_places: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, nullable=False
    )
    evaluation_metrics: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, nullable=False
    )
    interior_photos: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, nullable=False
    )
    floorplans: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, nullable=False
    )
    lifestyle_scenarios: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, nullable=False
    )

    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    images: Mapped[list[PropertyImage]] = relationship(
        "PropertyImage",
        back_populates="property",
        cascade="all, delete-orphan",
        foreign_keys="PropertyImage.property_id",
    )
