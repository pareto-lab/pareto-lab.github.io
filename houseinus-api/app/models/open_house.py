from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.types import IntegerEnum, IntStrEnum


class OpenHouseEventStatus(IntStrEnum):
    scheduled = ("scheduled", 0)
    closed = ("closed", 1)
    cancelled = ("cancelled", 2)


class OpenHouseReservationStatus(IntStrEnum):
    reserved = ("reserved", 0)
    cancelled = ("cancelled", 1)
    attended = ("attended", 2)
    no_show = ("no_show", 3)


class OpenHouseEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "open_house_events"

    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    time: Mapped[str] = mapped_column(String(120), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[OpenHouseEventStatus] = mapped_column(
        IntegerEnum(OpenHouseEventStatus),
        default=OpenHouseEventStatus.scheduled,
        index=True,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    reservations: Mapped[list[OpenHouseReservation]] = relationship(
        "OpenHouseReservation",
        back_populates="event",
        cascade="all, delete-orphan",
    )


class OpenHouseReservation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "open_house_reservations"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("open_house_events.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(80), nullable=False)
    privacy_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[OpenHouseReservationStatus] = mapped_column(
        IntegerEnum(OpenHouseReservationStatus),
        default=OpenHouseReservationStatus.reserved,
        index=True,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(80), nullable=True)

    event: Mapped[OpenHouseEvent] = relationship(
        "OpenHouseEvent",
        back_populates="reservations",
    )
