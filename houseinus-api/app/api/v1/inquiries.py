from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, status

from app.api.deps import CurrentAdmin, DbSession
from app.models import InquiryType
from app.schemas.inquiry import InquiryCreate, InquiryListResponse, InquiryRead
from app.services import inquiry_service, property_service, telegram_service

router = APIRouter(tags=["inquiries"])


@router.post(
    "/inquiries",
    response_model=InquiryRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_inquiry(
    payload: InquiryCreate,
    request: Request,
    db: DbSession,
    background_tasks: BackgroundTasks,
) -> InquiryRead:
    property_title = None
    if payload.property_id:
        prop = await property_service.get_published(db, payload.property_id)
        if prop is None:
            raise HTTPException(status_code=404, detail="Property not found")
        property_title = prop.title

    inquiry = await inquiry_service.create_inquiry(
        db,
        payload,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(inquiry)

    notify_field = telegram_service.field_for_inquiry(inquiry.type)
    if notify_field is not None:
        background_tasks.add_task(
            telegram_service.notify_admins,
            notify_field=notify_field,
            text=telegram_service.format_inquiry(
                inquiry_type=inquiry.type,
                property_title=property_title,
                name=inquiry.name,
                question=inquiry.question,
                contact_type=inquiry.contact_type,
                contact_value=inquiry.contact_value,
                city=inquiry.city,
                district=inquiry.district,
            ),
        )

    return InquiryRead.model_validate(
        inquiry_service.inquiry_to_payload(inquiry, property_title)
    )


@router.get("/admin/inquiries", response_model=InquiryListResponse)
async def admin_list_inquiries(
    admin: CurrentAdmin,
    db: DbSession,
    type: Annotated[InquiryType | None, Query()] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> InquiryListResponse:
    items, total = await inquiry_service.list_inquiries(
        db, inquiry_type=type, skip=skip, limit=limit
    )
    return InquiryListResponse(
        items=[InquiryRead.model_validate(item) for item in items],
        total=total,
        skip=skip,
        limit=limit,
    )
