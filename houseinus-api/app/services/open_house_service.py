from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    OpenHouseEvent,
    OpenHouseEventStatus,
    OpenHouseReservation,
    OpenHouseReservationStatus,
    Property,
)
from app.schemas.open_house import (
    OpenHouseEventCreate,
    OpenHouseEventUpdate,
    OpenHouseReservationCreate,
    OpenHouseReservationUpdate,
)
from app.utils.time import app_tz

ACTIVE_RESERVATION_STATUSES = (OpenHouseReservationStatus.reserved,)


async def get_event(db: AsyncSession, event_id: uuid.UUID) -> OpenHouseEvent | None:
    return await db.get(OpenHouseEvent, event_id)


async def get_reservation(
    db: AsyncSession, reservation_id: uuid.UUID
) -> OpenHouseReservation | None:
    return await db.get(OpenHouseReservation, reservation_id)


async def create_event(
    db: AsyncSession,
    *,
    property_id: uuid.UUID,
    payload: OpenHouseEventCreate,
) -> OpenHouseEvent:
    event = OpenHouseEvent(
        property_id=property_id,
        date=payload.date,
        time=payload.time.strip(),
        capacity=payload.capacity,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(event)
    await db.flush()
    return event


async def update_event(
    db: AsyncSession,
    *,
    event: OpenHouseEvent,
    payload: OpenHouseEventUpdate,
) -> OpenHouseEvent:
    data = payload.model_dump(exclude_unset=True)
    if "time" in data and data["time"] is not None:
        data["time"] = data["time"].strip()
    for key, value in data.items():
        setattr(event, key, value)
    await db.flush()
    return event


async def delete_event(db: AsyncSession, event: OpenHouseEvent) -> None:
    await db.delete(event)
    await db.flush()


async def create_reservation(
    db: AsyncSession,
    *,
    event: OpenHouseEvent,
    payload: OpenHouseReservationCreate,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> OpenHouseReservation:
    reservation = OpenHouseReservation(
        event_id=event.id,
        property_id=event.property_id,
        name=payload.name.strip(),
        email=str(payload.email),
        phone=payload.phone.strip(),
        privacy_consent=payload.privacy_consent,
        source_url=payload.source_url,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(reservation)
    await db.flush()
    return reservation


async def update_reservation(
    db: AsyncSession,
    *,
    reservation: OpenHouseReservation,
    payload: OpenHouseReservationUpdate,
) -> OpenHouseReservation:
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(reservation, key, value)
    await db.flush()
    return reservation


async def reservation_count_for_event(db: AsyncSession, event_id: uuid.UUID) -> int:
    stmt = select(func.count()).select_from(OpenHouseReservation).where(
        OpenHouseReservation.event_id == event_id,
        OpenHouseReservation.status.in_(ACTIVE_RESERVATION_STATUSES),
    )
    return int((await db.execute(stmt)).scalar_one())


async def reservation_counts(
    db: AsyncSession, event_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    if not event_ids:
        return {}
    stmt = (
        select(OpenHouseReservation.event_id, func.count())
        .where(
            OpenHouseReservation.event_id.in_(event_ids),
            OpenHouseReservation.status.in_(ACTIVE_RESERVATION_STATUSES),
        )
        .group_by(OpenHouseReservation.event_id)
    )
    rows = (await db.execute(stmt)).all()
    return {event_id: int(count) for event_id, count in rows}


async def list_all_events(
    db: AsyncSession,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[list[dict], int]:
    stmt = (
        select(OpenHouseEvent, Property.title)
        .outerjoin(Property, OpenHouseEvent.property_id == Property.id)
        .order_by(OpenHouseEvent.date.asc(), OpenHouseEvent.created_at.asc())
    )
    if date_from is not None:
        stmt = stmt.where(OpenHouseEvent.date >= date_from)
    if date_to is not None:
        stmt = stmt.where(OpenHouseEvent.date <= date_to)
    rows = (await db.execute(stmt)).all()
    events = [event for event, _title in rows]
    counts = await reservation_counts(db, [e.id for e in events])
    return [
        event_to_payload(event, counts.get(event.id, 0), property_title=title)
        for event, title in rows
    ], len(rows)


async def list_events_for_property(
    db: AsyncSession, property_id: uuid.UUID
) -> tuple[list[dict], int]:
    stmt = (
        select(OpenHouseEvent)
        .where(OpenHouseEvent.property_id == property_id)
        .order_by(OpenHouseEvent.date.asc(), OpenHouseEvent.created_at.asc())
    )
    events = list((await db.execute(stmt)).scalars().all())
    counts = await reservation_counts(db, [e.id for e in events])
    prop = await db.get(Property, property_id)
    return [
        event_to_payload(e, counts.get(e.id, 0), property_title=prop.title if prop else None)
        for e in events
    ], len(events)


async def next_public_event(db: AsyncSession, property_id: uuid.UUID) -> dict | None:
    today = datetime.now(tz=app_tz()).date()

    stmt = (
        select(OpenHouseEvent)
        .where(
            OpenHouseEvent.property_id == property_id,
            OpenHouseEvent.status == OpenHouseEventStatus.scheduled,
            OpenHouseEvent.date >= today,
        )
        .order_by(OpenHouseEvent.date.asc(), OpenHouseEvent.created_at.asc())
        .limit(1)
    )
    event = (await db.execute(stmt)).scalar_one_or_none()
    if event is None:
        return None
    count = await reservation_count_for_event(db, event.id)
    return event_to_payload(event, count)


async def list_reservations_for_event(
    db: AsyncSession, event_id: uuid.UUID
) -> tuple[list[dict], int]:
    event = await get_event(db, event_id)
    if event is None:
        return [], 0
    prop = await db.get(Property, event.property_id)
    stmt = (
        select(OpenHouseReservation)
        .where(OpenHouseReservation.event_id == event_id)
        .order_by(OpenHouseReservation.created_at.desc())
    )
    reservations = list((await db.execute(stmt)).scalars().all())
    return [
        reservation_to_payload(
            r,
            property_title=prop.title if prop else None,
            event=event,
        )
        for r in reservations
    ], len(reservations)


def event_to_payload(
    event: OpenHouseEvent,
    reservation_count: int,
    *,
    property_title: str | None = None,
) -> dict:
    return {
        "id": event.id,
        "property_id": event.property_id,
        "property_title": property_title,
        "date": event.date,
        "time": event.time,
        "capacity": event.capacity,
        "available_spots": max(event.capacity - reservation_count, 0),
        "reservation_count": reservation_count,
        "status": event.status,
        "notes": event.notes,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
    }


def reservation_to_payload(
    reservation: OpenHouseReservation,
    *,
    property_title: str | None = None,
    event: OpenHouseEvent | None = None,
) -> dict:
    return {
        "id": reservation.id,
        "event_id": reservation.event_id,
        "property_id": reservation.property_id,
        "property_title": property_title,
        "event_date": event.date if event else None,
        "event_time": event.time if event else None,
        "name": reservation.name,
        "email": reservation.email,
        "phone": reservation.phone,
        "privacy_consent": reservation.privacy_consent,
        "status": reservation.status,
        "notes": reservation.notes,
        "source_url": reservation.source_url,
        "created_at": reservation.created_at,
        "updated_at": reservation.updated_at,
    }
