from __future__ import annotations

from datetime import datetime, timezone
from xml.sax.saxutils import escape

from fastapi import APIRouter
from fastapi.responses import Response

from app.api.deps import DbSession
from app.config import settings
from app.services import blog_service, property_service

router = APIRouter(tags=["sitemap"])

_STATIC_PAGES = ["/", "/about", "/blog", "/housing-mbti"]


def _fmt(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat(timespec="seconds")


def _url(loc: str, lastmod: datetime | None) -> str:
    lines = ["  <url>", f"    <loc>{escape(loc)}</loc>"]
    if lastmod:
        lines.append(f"    <lastmod>{_fmt(lastmod)}</lastmod>")
    lines += [
        "    <changefreq>daily</changefreq>",
        "    <priority>0.8</priority>",
        "  </url>",
    ]
    return "\n".join(lines)


@router.get("/sitemap.xml")
async def sitemap(db: DbSession) -> Response:
    base = settings.frontend_url.rstrip("/")
    urls: list[str] = []

    for path in _STATIC_PAGES:
        urls.append(_url(f"{base}{path}", None))

    properties, _ = await property_service.list_published(db, skip=0, limit=10_000)
    for prop in properties:
        slug = prop.slug or str(prop.id)
        urls.append(_url(f"{base}/properties/{slug}", prop.updated_at or prop.published_at))

    posts, _ = await blog_service.list_posts(db, skip=0, limit=10_000)
    for post in posts:
        lastmod = post.updated_at or post.published_at or post.reference_date
        urls.append(_url(f"{base}/blog/{post.slug}", lastmod))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    return Response(content=xml, media_type="application/xml")
