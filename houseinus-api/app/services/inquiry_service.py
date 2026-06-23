from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Inquiry, InquiryType, Property
from app.schemas.inquiry import InquiryCreate


async def create_inquiry(
    db: AsyncSession,
    payload: InquiryCreate,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> Inquiry:
    inquiry = Inquiry(
        type=payload.type,
        property_id=payload.property_id,
        name=payload.name.strip() if payload.name else None,
        question=payload.question.strip() if payload.question else None,
        contact_type=payload.contact_type,
        contact_value=payload.contact_value.strip() if payload.contact_value else None,
        city=payload.city.strip() if payload.city else None,
        district=payload.district.strip() if payload.district else None,
        privacy_consent=payload.privacy_consent,
        source_url=payload.source_url,
        user_agent=user_agent,
        ip_address=ip_address,
        extra=payload.extra,
    )
    db.add(inquiry)
    await db.flush()
    return inquiry


async def list_inquiries(
    db: AsyncSession,
    *,
    inquiry_type: InquiryType | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict], int]:
    stmt = (
        select(Inquiry, Property.title)
        .outerjoin(Property, Inquiry.property_id == Property.id)
        .order_by(Inquiry.created_at.desc())
    )
    count_stmt = select(func.count()).select_from(Inquiry)
    if inquiry_type:
        stmt = stmt.where(Inquiry.type == inquiry_type)
        count_stmt = count_stmt.where(Inquiry.type == inquiry_type)

    total = (await db.execute(count_stmt)).scalar_one()
    rows = (await db.execute(stmt.offset(skip).limit(limit))).all()
    return [
        inquiry_to_payload(inquiry, property_title) for inquiry, property_title in rows
    ], int(total)


def inquiry_to_payload(inquiry: Inquiry, property_title: str | None = None) -> dict:
    return {
        "id": inquiry.id,
        "type": inquiry.type,
        "property_id": inquiry.property_id,
        "property_title": property_title,
        "name": inquiry.name,
        "question": inquiry.question,
        "contact_type": inquiry.contact_type,
        "contact_value": inquiry.contact_value,
        "city": inquiry.city,
        "district": inquiry.district,
        "privacy_consent": inquiry.privacy_consent,
        "source_url": inquiry.source_url,
        "extra": inquiry.extra,
        "created_at": inquiry.created_at,
        "updated_at": inquiry.updated_at,
    }
