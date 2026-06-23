from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.config import settings


def utcnow() -> datetime:
    """Current time as an aware UTC datetime. Always store this in the DB."""
    return datetime.now(tz=timezone.utc)


def app_tz() -> ZoneInfo:
    return ZoneInfo(settings.timezone)


def to_app_tz(dt: datetime) -> datetime:
    """Convert an aware datetime to the configured application timezone."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(app_tz())
