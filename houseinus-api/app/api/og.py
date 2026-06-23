"""Server-side meta-tag injection for SPA routes that need rich link previews.

The SPA's index.html is static, so social/chat crawlers (KakaoTalk, Facebook,
X, etc.) only ever see the landing page's title and og:image. For dynamic
routes — property detail pages and blog post pages — we proxy those URLs from
nginx to this router so we can read the SPA's built index_for_api.html, inject
the per-resource title/description/og:image, and respond with the full HTML.

Real users get the same response and React hydrates as usual (the script tag
in the template is rewritten by Vite to point at the hashed bundle).

Template lookup order:
1. ``<api project>/../houseinus-web/dist/index_for_api.html`` (built output;
   contains the hashed asset references so React can hydrate)
2. ``<api project>/index_for_api.html`` (raw template — fallback so dev/test
   environments without a built web project still respond with correct meta
   tags, even though the SPA won't hydrate). Logs a warning each fallback.
"""
from __future__ import annotations

import html
import logging
import uuid
from pathlib import Path
from typing import Annotated, Final

from fastapi import APIRouter, Query, Request
from fastapi.responses import HTMLResponse, Response
from sqlalchemy import select

from app.api.deps import DbSession
from app.config import PROJECT_ROOT
from app.models.property import Property, PropertyImage
from app.services import blog_service, property_service, storage_service

log = logging.getLogger(__name__)

router = APIRouter(tags=["og"])

_DIST_TEMPLATE: Final[Path] = (
    PROJECT_ROOT.parent / "houseinus-web" / "dist" / "index_for_api.html"
)
_FALLBACK_TEMPLATE: Final[Path] = PROJECT_ROOT / "index_for_api.html"

_DEFAULT_TITLE: Final[str] = "하우스인어스 | 단독주택 라이프스타일 포트폴리오"
_DEFAULT_DESCRIPTION: Final[str] = (
    "하우스인어스는 경기도 단독주택·전원주택의 생활 가치와 관리 정보를 "
    "구조화해 보여주는 라이프스타일 기반 주택 포트폴리오 플랫폼입니다."
)
_DEFAULT_OG_IMAGE_PATH: Final[str] = "/og-image.jpg"


def _load_template() -> str:
    if _DIST_TEMPLATE.is_file():
        return _DIST_TEMPLATE.read_text(encoding="utf-8")
    log.warning(
        "OG template fallback: dist template not found at %s; using %s",
        _DIST_TEMPLATE,
        _FALLBACK_TEMPLATE,
    )
    return _FALLBACK_TEMPLATE.read_text(encoding="utf-8")


def _absolute_url(request: Request, path: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("host", request.url.netloc)
    if not path.startswith("/"):
        path = "/" + path
    return f"{proto}://{host}{path}"


def _render(
    *,
    request: Request,
    title: str,
    description: str,
    image_url: str,
    og_type: str,
    canonical_path: str,
) -> str:
    canonical_url = _absolute_url(request, canonical_path)
    replacements = {
        "{{OG_TITLE}}": html.escape(title),
        "{{OG_DESCRIPTION}}": html.escape(description),
        "{{OG_IMAGE}}": html.escape(image_url),
        "{{OG_TYPE}}": html.escape(og_type),
        "{{OG_URL}}": html.escape(canonical_url),
    }
    rendered = _load_template()
    for placeholder, value in replacements.items():
        rendered = rendered.replace(placeholder, value)
    return rendered


def _default_og_image(request: Request) -> str:
    return _absolute_url(request, _DEFAULT_OG_IMAGE_PATH)


async def _property_hero_url(
    request: Request, db: DbSession, prop: Property
) -> str:
    if prop.hero_image_id:
        img = await db.get(PropertyImage, prop.hero_image_id)
        if img:
            return _absolute_url(request, storage_service.public_url(img.storage_key))
    return _default_og_image(request)


async def _resolve_property(db: DbSession, id_or_slug: str) -> Property | None:
    try:
        prop_uuid = uuid.UUID(id_or_slug)
    except ValueError:
        return await property_service.get_published_by_slug(db, id_or_slug)
    return await property_service.get_published(db, prop_uuid)


def _not_found_response(request: Request, canonical_path: str) -> HTMLResponse:
    rendered = _render(
        request=request,
        title=_DEFAULT_TITLE,
        description=_DEFAULT_DESCRIPTION,
        image_url=_default_og_image(request),
        og_type="website",
        canonical_path=canonical_path,
    )
    return HTMLResponse(content=rendered, status_code=404)


@router.get("/properties/{id_or_slug}", include_in_schema=False)
async def og_property(
    id_or_slug: str, request: Request, db: DbSession
) -> Response:
    prop = await _resolve_property(db, id_or_slug)
    canonical_path = f"/properties/{id_or_slug}"
    if prop is None:
        return _not_found_response(request, canonical_path)

    image_url = await _property_hero_url(request, db, prop)
    description = prop.subtitle or _DEFAULT_DESCRIPTION
    title = f"{prop.title} | 하우스인어스"
    rendered = _render(
        request=request,
        title=title,
        description=description,
        image_url=image_url,
        og_type="website",
        canonical_path=canonical_path,
    )
    return HTMLResponse(content=rendered)


@router.get("/properties/{id_or_slug}/delivery", include_in_schema=False)
async def og_property_delivery(
    id_or_slug: str,
    request: Request,
    db: DbSession,
    token: Annotated[str | None, Query()] = None,
) -> Response:
    """납품 페이지(/properties/<id>/delivery?token=...)의 동적 OG 메타태그.

    납품 링크는 고객에게 카톡 등으로 보내지는 token-gated 매물 페이지입니다.
    token은 secrets.token_urlsafe(32)로 생성되는 32바이트 random secret이라
    그 자체로 매물을 식별하는 키로 충분히 안전합니다. og 응답에는 매물의
    제목/부제목/대표 이미지만 표시하고, 본문 데이터는 별도 birthdate 인증을
    거치는 SPA 흐름이 그대로 유지됩니다.
    """
    qs = f"?token={token}" if token else ""
    canonical_path = f"/properties/{id_or_slug}/delivery{qs}"

    prop: Property | None = None
    if token:
        result = await db.execute(
            select(Property).where(
                Property.delivery_token == token,
                Property.deleted_at.is_(None),
            )
        )
        prop = result.scalar_one_or_none()

    # token이 없거나 매칭되는 매물이 없으면 매물 정보를 노출하지 않는
    # generic 응답. 단 404가 아니라 200으로 응답해 SPA가 정상적으로
    # 떠서 birthdate 입력 UI 등 안내가 가능해야 함.
    if prop is None:
        rendered = _render(
            request=request,
            title="집 소개 자료 | 하우스인어스",
            description=_DEFAULT_DESCRIPTION,
            image_url=_default_og_image(request),
            og_type="website",
            canonical_path=canonical_path,
        )
        return HTMLResponse(content=rendered)

    image_url = await _property_hero_url(request, db, prop)
    description = prop.subtitle or _DEFAULT_DESCRIPTION
    title = f"{prop.title} | 하우스인어스"
    rendered = _render(
        request=request,
        title=title,
        description=description,
        image_url=image_url,
        og_type="website",
        canonical_path=canonical_path,
    )
    return HTMLResponse(content=rendered)


@router.get("/guide/delivery", include_in_schema=False)
async def og_guide_delivery(request: Request) -> HTMLResponse:
    rendered = _render(
        request=request,
        title="집소개서 활용 가이드 | 하우스인어스",
        description="공인중개사에게 이렇게 요청하세요, 직거래 플랫폼에 직접 등록하기, 카카오톡·SNS·카페·블로그로 공유하기",
        image_url=_default_og_image(request),
        og_type="website",
        canonical_path="/guide/delivery",
    )
    return HTMLResponse(content=rendered)


@router.get("/blog/{slug}", include_in_schema=False)
async def og_blog_post(
    slug: str, request: Request, db: DbSession
) -> Response:
    post = await blog_service.get_post_by_slug(db, slug)
    canonical_path = f"/blog/{slug}"
    if post is None or post.status != "published" or post.deleted_at is not None:
        return _not_found_response(request, canonical_path)

    image_url = (
        _absolute_url(request, post.cover_image_url)
        if post.cover_image_url
        else _default_og_image(request)
    )
    description = post.excerpt or _DEFAULT_DESCRIPTION
    title = f"{post.title} | 하우스인어스"
    rendered = _render(
        request=request,
        title=title,
        description=description,
        image_url=image_url,
        og_type="article",
        canonical_path=canonical_path,
    )
    return HTMLResponse(content=rendered)
