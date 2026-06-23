from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PropertyPrintJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tracks an async Playwright-based PDF generation job for a property's print page."""

    __tablename__ = "property_print_jobs"

    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    # "pending" | "ready" | "failed"
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    # Path relative to storage base_dir — set at creation, file written when ready.
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    # Snapshot of property.updated_at when this job was created.
    # Used to detect staleness: if prop.updated_at > this value, the job is stale.
    property_snapshot_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    property: Mapped["Property"] = relationship(  # noqa: F821
        "Property", foreign_keys=[property_id]
    )
