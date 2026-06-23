"""Telegram bot notifications for admins.

Designed for fire-and-forget use from FastAPI ``BackgroundTasks``: any
network/auth error is logged and swallowed so it can never break the user
request that triggered it.
"""
from __future__ import annotations

import logging
from typing import Literal

import httpx
from sqlalchemy import select

from app.config import settings
from app.database import SessionFactory
from app.models import InquiryType, User, UserAdmin, UserRole, UserStatus

log = logging.getLogger(__name__)

NotifyKind = Literal[
    "notify_inquiry_house",
    "notify_inquiry_metrics",
    "notify_inquiry_portfolio",
    "notify_open_house_inquiry",
    "notify_inquiry_matched_property",
    "notify_inquiry_delivery",
    "notify_mbti",
    "notify_delivery_publish",
]

_INQUIRY_TYPE_TO_FIELD: dict[InquiryType, NotifyKind] = {
    InquiryType.house_question: "notify_inquiry_house",
    InquiryType.metrics_question: "notify_inquiry_metrics",
    InquiryType.portfolio_request: "notify_inquiry_portfolio",
    InquiryType.matched_property_subscribe: "notify_inquiry_matched_property",
    InquiryType.delivery_question: "notify_inquiry_delivery",
}


def field_for_inquiry(inquiry_type: InquiryType) -> NotifyKind | None:
    return _INQUIRY_TYPE_TO_FIELD.get(inquiry_type)  # None if type has no notification


async def _send_message(chat_id: str, text: str) -> bool:
    if not settings.telegram.bot_token:
        return False
    url = f"https://api.telegram.org/bot{settings.telegram.bot_token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
        if resp.status_code >= 400:
            log.warning(
                "Telegram sendMessage failed (chat_id=%s): %s %s",
                chat_id,
                resp.status_code,
                resp.text[:300],
            )
            return False
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("Telegram sendMessage errored (chat_id=%s): %s", chat_id, exc)
        return False


async def notify_admins(*, notify_field: NotifyKind, text: str) -> None:
    """Look up active admins who opted in to ``notify_field`` and message each."""
    if not settings.telegram.enabled:
        return

    notify_column = getattr(UserAdmin, notify_field)
    async with SessionFactory() as db:
        stmt = (
            select(UserAdmin.telegram_user_id)
            .join(User, User.id == UserAdmin.user_id)
            .where(
                User.role.in_([UserRole.admin, UserRole.owner]),
                User.status == UserStatus.active,
                User.banned_at.is_(None),
                User.deleted_at.is_(None),
                UserAdmin.telegram_user_id.isnot(None),
                notify_column.is_(True),
            )
        )
        chat_ids = [
            chat_id for chat_id in (await db.execute(stmt)).scalars().all() if chat_id
        ]

    for chat_id in chat_ids:
        await _send_message(chat_id, text)


async def notify_admins_system(text: str) -> None:
    """Push a system-level alert to every active admin/owner with a Telegram
    user id, ignoring per-kind notification opt-ins.

    Used for failures the operator must know about (TLS errors, mail server
    misconfig, etc.) — these are not user-facing notifications and shouldn't
    be silenceable.
    """
    if not settings.telegram.enabled:
        return

    async with SessionFactory() as db:
        stmt = (
            select(UserAdmin.telegram_user_id)
            .join(User, User.id == UserAdmin.user_id)
            .where(
                User.role.in_([UserRole.admin, UserRole.owner]),
                User.status == UserStatus.active,
                User.banned_at.is_(None),
                User.deleted_at.is_(None),
                UserAdmin.telegram_user_id.isnot(None),
            )
        )
        chat_ids = [
            chat_id for chat_id in (await db.execute(stmt)).scalars().all() if chat_id
        ]

    for chat_id in chat_ids:
        await _send_message(chat_id, text)


# ---------------------------------------------------------------- formatters


def _e(value: str | None) -> str:
    """Minimal HTML escape for the bits we shove into Telegram messages."""
    if value is None:
        return "—"
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


_INQUIRY_LABEL: dict[InquiryType, str] = {
    InquiryType.house_question: "집 문의",
    InquiryType.metrics_question: "지표 문의",
    InquiryType.portfolio_request: "포트폴리오 의뢰",
    InquiryType.matched_property_subscribe: "맞춤 매물 정보 수신",
    InquiryType.delivery_question: "최종 결과물 질의",
}


def format_inquiry(
    *,
    inquiry_type: InquiryType,
    property_title: str | None,
    name: str | None,
    question: str | None,
    contact_type: str | None,
    contact_value: str | None,
    city: str | None,
    district: str | None,
) -> str:
    label = _INQUIRY_LABEL[inquiry_type]
    lines = [f"🏠 <b>새 {label}</b>"]
    if property_title:
        lines.append(f"매물: {_e(property_title)}")
    if name:
        lines.append(f"이름: {_e(name)}")
    if contact_value:
        ct = (
            "전화"
            if contact_type == "phone"
            else "이메일"
            if contact_type == "email"
            else "연락처"
        )
        lines.append(f"{ct}: {_e(contact_value)}")
    region = " ".join(p for p in [city, district] if p)
    if region:
        lines.append(f"지역: {_e(region)}")
    if question:
        snippet = question.strip()
        if len(snippet) > 500:
            snippet = snippet[:500] + "…"
        lines.append("")
        lines.append(_e(snippet))
    return "\n".join(lines)


def format_open_house_inquiry(
    *,
    property_title: str | None,
    name: str,
    email: str,
) -> str:
    lines = ["📅 <b>새 오픈하우스 일정 문의</b>"]
    if property_title:
        lines.append(f"매물: {_e(property_title)}")
    lines.append(f"이름: {_e(name)}")
    lines.append(f"이메일: {_e(email)}")
    return "\n".join(lines)


def format_mbti(
    *,
    email: str | None,
    source: str,
    age: str,
    gender: str,
    family_type: str,
) -> str:
    src_label = "이메일 저장" if source == "email_save" else "익명"
    lines = [
        "🧠 <b>새 MBTI 결과</b>",
        f"구분: {src_label}",
    ]
    if email:
        lines.append(f"이메일: {_e(email)}")
    lines.append(f"나이/성별: {_e(age)} / {_e(gender)}")
    lines.append(f"가족형태: {_e(family_type)}")
    return "\n".join(lines)


def format_delivery_publish(
    *,
    property_title: str | None,
    property_slug_or_id: str,
) -> str:
    lines = ["📣 <b>납품 페이지에서 매물 자체 게시됨</b>"]
    if property_title:
        lines.append(f"매물: {_e(property_title)}")
    lines.append(f"링크: {settings.frontend_url}/properties/{_e(property_slug_or_id)}")
    return "\n".join(lines)
