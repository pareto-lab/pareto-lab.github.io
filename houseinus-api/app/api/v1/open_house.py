from __future__ import annotations

import uuid
from datetime import date as Date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.api.deps import CurrentAdmin, DbSession
from app.models import OpenHouseEventStatus
from app.schemas.open_house import (
    OpenHouseEventCreate,
    OpenHouseEventListResponse,
    OpenHouseEventRead,
    OpenHouseEventUpdate,
    OpenHouseReservationCreate,
    OpenHouseReservationListResponse,
    OpenHouseReservationRead,
    OpenHouseReservationUpdate,
)
from app.services import open_house_service, property_service

router = APIRouter(tags=["open-house"])


@router.post(
    "/open-house-events/{event_id}/reservations",
    response_model=OpenHouseReservationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_open_house_reservation(
    event_id: uuid.UUID,
    payload: OpenHouseReservationCreate,
    request: Request,
    db: DbSession,
) -> OpenHouseReservationRead:
    event = await open_house_service.get_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Open house event not found")
    prop = await property_service.get_published(db, event.property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    if event.status != OpenHouseEventStatus.scheduled:
        raise HTTPException(status_code=400, detail="This open house is not available")

    count = await open_house_service.reservation_count_for_event(db, event.id)
    if event.capacity > 0 and count >= event.capacity:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Open house is full")

    reservation = await open_house_service.create_reservation(
        db,
        event=event,
        payload=payload,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(reservation)
    return OpenHouseReservationRead.model_validate(
        open_house_service.reservation_to_payload(
            reservation,
            property_title=prop.title,
            event=event,
        )
    )


@router.get(
    "/admin/open-house-events",
    response_model=OpenHouseEventListResponse,
)
async def admin_list_all_open_house_events(
    admin: CurrentAdmin,
    db: DbSession,
    date_from: Annotated[Date | None, Query()] = None,
    date_to: Annotated[Date | None, Query()] = None,
) -> OpenHouseEventListResponse:
    items, total = await open_house_service.list_all_events(
        db, date_from=date_from, date_to=date_to
    )
    return OpenHouseEventListResponse(
        items=[OpenHouseEventRead.model_validate(item) for item in items],
        total=total,
    )


@router.get(
    "/admin/properties/{property_id}/open-house-events",
    response_model=OpenHouseEventListResponse,
)
async def admin_list_open_house_events(
    property_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
) -> OpenHouseEventListResponse:
    prop = await property_service.get_by_id(db, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    items, total = await open_house_service.list_events_for_property(db, property_id)
    return OpenHouseEventListResponse(
        items=[OpenHouseEventRead.model_validate(item) for item in items],
        total=total,
    )


@router.post(
    "/admin/properties/{property_id}/open-house-events",
    response_model=OpenHouseEventRead,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_open_house_event(
    property_id: uuid.UUID,
    payload: OpenHouseEventCreate,
    admin: CurrentAdmin,
    db: DbSession,
) -> OpenHouseEventRead:
    prop = await property_service.get_by_id(db, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    event = await open_house_service.create_event(db, property_id=property_id, payload=payload)
    await db.commit()
    await db.refresh(event)
    return OpenHouseEventRead.model_validate(
        open_house_service.event_to_payload(event, 0, property_title=prop.title)
    )


@router.patch(
    "/admin/properties/{property_id}/open-house-events/{event_id}",
    response_model=OpenHouseEventRead,
)
async def admin_update_open_house_event(
    property_id: uuid.UUID,
    event_id: uuid.UUID,
    payload: OpenHouseEventUpdate,
    admin: CurrentAdmin,
    db: DbSession,
) -> OpenHouseEventRead:
    prop = await property_service.get_by_id(db, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    event = await open_house_service.get_event(db, event_id)
    if event is None or event.property_id != property_id:
        raise HTTPException(status_code=404, detail="Open house event not found")
    await open_house_service.update_event(db, event=event, payload=payload)
    await db.commit()
    await db.refresh(event)
    count = await open_house_service.reservation_count_for_event(db, event.id)
    return OpenHouseEventRead.model_validate(
        open_house_service.event_to_payload(event, count, property_title=prop.title)
    )


@router.delete(
    "/admin/properties/{property_id}/open-house-events/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def admin_delete_open_house_event(
    property_id: uuid.UUID,
    event_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
) -> None:
    event = await open_house_service.get_event(db, event_id)
    if event is None or event.property_id != property_id:
        raise HTTPException(status_code=404, detail="Open house event not found")
    await open_house_service.delete_event(db, event)
    await db.commit()


@router.get(
    "/admin/properties/{property_id}/open-house-events/{event_id}/reservations",
    response_model=OpenHouseReservationListResponse,
)
async def admin_list_open_house_reservations(
    property_id: uuid.UUID,
    event_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
) -> OpenHouseReservationListResponse:
    event = await open_house_service.get_event(db, event_id)
    if event is None or event.property_id != property_id:
        raise HTTPException(status_code=404, detail="Open house event not found")
    items, total = await open_house_service.list_reservations_for_event(db, event_id)
    return OpenHouseReservationListResponse(
        items=[OpenHouseReservationRead.model_validate(item) for item in items],
        total=total,
    )


@router.patch(
    "/admin/properties/{property_id}/open-house-events/{event_id}/reservations/{reservation_id}",
    response_model=OpenHouseReservationRead,
)
async def admin_update_open_house_reservation(
    property_id: uuid.UUID,
    event_id: uuid.UUID,
    reservation_id: uuid.UUID,
    payload: OpenHouseReservationUpdate,
    admin: CurrentAdmin,
    db: DbSession,
) -> OpenHouseReservationRead:
    event = await open_house_service.get_event(db, event_id)
    if event is None or event.property_id != property_id:
        raise HTTPException(status_code=404, detail="Open house event not found")
    reservation = await open_house_service.get_reservation(db, reservation_id)
    if reservation is None or reservation.event_id != event_id:
        raise HTTPException(status_code=404, detail="Reservation not found")
    await open_house_service.update_reservation(db, reservation=reservation, payload=payload)
    await db.commit()
    await db.refresh(reservation)
    prop = await property_service.get_by_id(db, property_id)
    return OpenHouseReservationRead.model_validate(
        open_house_service.reservation_to_payload(
            reservation,
            property_title=prop.title if prop else None,
            event=event,
        )
    )
