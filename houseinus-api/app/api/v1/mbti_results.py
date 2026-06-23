from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, Request, status

from app.api.deps import CurrentAdmin, DbSession
from app.schemas.mbti import MbtiResultCreate, MbtiResultListResponse, MbtiResultRead
from app.services import mbti_service, telegram_service

router = APIRouter(tags=["mbti-results"])


@router.post(
    "/mbti-results",
    response_model=MbtiResultRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_mbti_result(
    payload: MbtiResultCreate,
    request: Request,
    db: DbSession,
    background_tasks: BackgroundTasks,
) -> MbtiResultRead:
    result = await mbti_service.create_result(
        db,
        payload,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(result)

    background_tasks.add_task(
        telegram_service.notify_admins,
        notify_field="notify_mbti",
        text=telegram_service.format_mbti(
            email=result.email,
            source=result.source,
            age=result.age,
            gender=result.gender,
            family_type=result.family_type,
        ),
    )

    return MbtiResultRead.model_validate(result)


@router.get("/admin/mbti-results", response_model=MbtiResultListResponse)
async def admin_list_mbti_results(
    admin: CurrentAdmin,
    db: DbSession,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> MbtiResultListResponse:
    items, total = await mbti_service.list_results(db, skip=skip, limit=limit)
    return MbtiResultListResponse(
        items=[MbtiResultRead.model_validate(item) for item in items],
        total=total,
        skip=skip,
        limit=limit,
    )
