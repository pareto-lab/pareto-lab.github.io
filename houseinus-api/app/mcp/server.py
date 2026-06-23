from __future__ import annotations

import json
import os
import sys
from typing import Any, Literal

import httpx
from mcp.server.fastmcp import FastMCP

DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1"
MAX_REASON_LENGTH = 500
DEFAULT_HTTP_TIMEOUT_SECONDS = 15.0

_DISABLE_STATUS_CHANGES = False
_DISABLE_HIGH_RISK = False

mcp = FastMCP(
    "houseinus-admin",
    instructions=(
        "Administrative MCP server for House in Us. It wraps the existing "
        "houseinus-api admin endpoints and requires HOUSEINUS_ADMIN_TOKEN."
    ),
)


class HouseinusMcpError(RuntimeError):
    """Raised for MCP-facing validation and upstream API errors."""


def _base_url() -> str:
    return os.getenv("HOUSEINUS_API_BASE_URL", DEFAULT_API_BASE_URL).rstrip("/")


def _token() -> str:
    token = os.getenv("HOUSEINUS_ADMIN_TOKEN", "").strip()
    if not token:
        raise HouseinusMcpError(
            "HOUSEINUS_ADMIN_TOKEN is required. Use an existing admin/owner bearer token."
        )
    return token


def _http_timeout() -> float:
    raw = os.getenv("HOUSEINUS_MCP_HTTP_TIMEOUT_SECONDS", "").strip()
    if not raw:
        return DEFAULT_HTTP_TIMEOUT_SECONDS
    try:
        return max(1.0, float(raw))
    except ValueError:
        return DEFAULT_HTTP_TIMEOUT_SECONDS


def _headers(reason: str | None = None) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {_token()}",
        "Accept": "application/json",
        "User-Agent": "houseinus-admin-mcp/0.1",
    }
    if reason:
        headers["X-Houseinus-MCP-Reason"] = reason[:MAX_REASON_LENGTH]
    return headers


def _require_confirmation(action: str, confirm: bool, reason: str) -> str:
    normalized_reason = reason.strip()
    if confirm is not True:
        raise HouseinusMcpError(
            f"{action} is destructive, requires explicit user confirmation. "
            "Call again with confirm=true."
        )
    if not normalized_reason:
        raise HouseinusMcpError(
            f"{action} is destructive, requires explicit user confirmation and a reason."
        )
    if len(normalized_reason) > MAX_REASON_LENGTH:
        raise HouseinusMcpError(f"reason must be {MAX_REASON_LENGTH} characters or fewer.")
    return normalized_reason


def _env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _status_changes_disabled() -> bool:
    return _DISABLE_STATUS_CHANGES or _env_flag("HOUSEINUS_MCP_DISABLE_STATUS_CHANGES")


def _high_risk_disabled() -> bool:
    return _DISABLE_HIGH_RISK or _env_flag("HOUSEINUS_MCP_DISABLE_HIGH_RISK")


def _require_status_changes_enabled(action: str) -> None:
    if _status_changes_disabled():
        raise HouseinusMcpError(
            f"{action} is disabled for this MCP server instance. "
            "Restart without --disable-status-changes or unset "
            "HOUSEINUS_MCP_DISABLE_STATUS_CHANGES to enable it."
        )


def _require_high_risk_enabled(action: str) -> None:
    if _high_risk_disabled():
        raise HouseinusMcpError(
            f"{action} is disabled for this MCP server instance. "
            "Restart without --disable-high-risk or unset HOUSEINUS_MCP_DISABLE_HIGH_RISK "
            "to enable it."
        )


async def _request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json: dict[str, Any] | list[Any] | None = None,
    reason: str | None = None,
) -> Any:
    try:
        async with httpx.AsyncClient(
            base_url=_base_url(),
            headers=_headers(reason),
            timeout=httpx.Timeout(_http_timeout(), connect=5.0),
        ) as client:
            response = await client.request(method, path, params=params, json=json)
    except httpx.TimeoutException as exc:
        raise HouseinusMcpError(
            f"{method} {path} timed out while calling {_base_url()}: {exc}"
        ) from exc
    except httpx.RequestError as exc:
        raise HouseinusMcpError(
            f"{method} {path} could not reach {_base_url()}: {exc}"
        ) from exc
    if response.status_code >= 400:
        detail = response.text
        try:
            payload = response.json()
            detail = payload.get("detail") or payload.get("code") or detail
        except ValueError:
            pass
        raise HouseinusMcpError(f"{method} {path} failed: HTTP {response.status_code}: {detail}")
    if response.status_code == 204:
        return {"ok": True}
    return response.json()


def _page_params(skip: int, limit: int) -> dict[str, int]:
    return {"skip": skip, "limit": limit}


def _json_text(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Resources


@mcp.resource("houseinus://admin/me")
async def admin_me_resource() -> str:
    """Current admin account as JSON."""
    return _json_text(await _request("GET", "/auth/me"))


@mcp.resource("houseinus://admin/properties")
async def properties_resource() -> str:
    """First page of admin properties as JSON."""
    return _json_text(await _request("GET", "/admin/properties", params=_page_params(0, 50)))


@mcp.resource("houseinus://admin/properties/{property_id}")
async def property_resource(property_id: str) -> str:
    """Admin property detail as JSON."""
    return _json_text(await _request("GET", f"/admin/properties/{property_id}"))


@mcp.resource("houseinus://admin/blog/posts/{post_id}")
async def blog_post_resource(post_id: str) -> str:
    """Admin blog post detail as JSON."""
    return _json_text(await _request("GET", f"/admin/blog/posts/{post_id}"))


@mcp.resource("houseinus://admin/blog/tags")
async def blog_tags_resource() -> str:
    """Blog tags as JSON."""
    return _json_text(await _request("GET", "/admin/blog/tags"))


@mcp.resource("houseinus://admin/open-house/events")
async def open_house_events_resource() -> str:
    """Open house events as JSON."""
    return _json_text(await _request("GET", "/admin/open-house-events"))


@mcp.resource("houseinus://admin/inquiries")
async def inquiries_resource() -> str:
    """First page of admin inquiries as JSON."""
    return _json_text(await _request("GET", "/admin/inquiries", params=_page_params(0, 50)))


@mcp.resource("houseinus://admin/schema/property-update")
async def property_update_schema_resource() -> str:
    """Human-readable JSON shape accepted by update_property."""
    return _json_text({
        "description": "Partial PropertyUpdate payload. Every field is optional.",
        "fields": {
            "slug": "string | null",
            "title": "string | null",
            "subtitle": "string | null",
            "location": "string | null",
            "price": "integer >= 0 | null",
            "display_order": "integer | null",
            "tags": "string[] | null",
            "hero_image_id": "uuid | null",
            "portfolio_thumb_id": "uuid | null",
            "lifestyle_story": "string | null",
            "lifestyle_story_overlay": "boolean | null",
            "lifestyle_highlights": "string[] | null",
            "lifestyle_layout": "string | null",
            "specs": "object | null",
            "loan_info": "object | null",
            "house_plan_specs": "object | null",
            "nearby_places": "object[] | null",
            "evaluation_metrics": "object[] | null",
            "interior_photos": "object[] | null",
            "floorplans": "object keyed by floor | null",
            "lifestyle_scenarios": "object[] | null",
        },
    })


# ---------------------------------------------------------------------------
# Auth / health


@mcp.tool()
async def admin_me() -> dict[str, Any]:
    """Return the current authenticated admin account."""
    return await _request("GET", "/auth/me")


@mcp.tool()
async def auth_check() -> dict[str, Any]:
    """Check that HOUSEINUS_ADMIN_TOKEN is valid and belongs to an admin/owner."""
    me = await _request("GET", "/auth/me")
    if me.get("role") not in {"admin", "owner"}:
        raise HouseinusMcpError("Token is valid, but user is not admin or owner.")
    return {
        "ok": True,
        "user": me,
        "status_changes_disabled": _status_changes_disabled(),
        "high_risk_disabled": _high_risk_disabled(),
    }


# ---------------------------------------------------------------------------
# Properties


@mcp.tool()
async def list_properties(
    q: str | None = None,
    statuses: list[str] | None = None,
    skip: int = 0,
    limit: int = 50,
) -> dict[str, Any]:
    """List admin properties with optional query and status filters."""
    params: dict[str, Any] = _page_params(skip, limit)
    if q:
        params["q"] = q
    if statuses:
        params["statuses"] = statuses
    return await _request("GET", "/admin/properties", params=params)


@mcp.tool(structured_output=False)
async def get_property(property_id: str) -> dict[str, Any]:
    """Get the slim admin summary for one property.

    Returns scalar fields, hero/portfolio refs, and per-section counts only.
    Heavy sections are split into separate tools to keep responses under the
    MCP stdio line-buffer limit (~64 KiB). Use:
    - get_property_lifestyle: lifestyle story, highlights, scenarios, layout
    - get_property_interior:  interior_photos, floorplans
    - get_property_specs:     specs, loan_info, house_plan_specs, nearby_places, evaluation_metrics
    - get_property_images:    paginated images list
    """
    return await _request("GET", f"/admin/properties/{property_id}/mcp/summary")


@mcp.tool(structured_output=False)
async def get_property_lifestyle(property_id: str) -> dict[str, Any]:
    """Get lifestyle section: story, highlights, scenarios, layout."""
    return await _request("GET", f"/admin/properties/{property_id}/mcp/lifestyle")


@mcp.tool(structured_output=False)
async def get_property_interior(property_id: str) -> dict[str, Any]:
    """Get interior section: interior_photos and floorplans."""
    return await _request("GET", f"/admin/properties/{property_id}/mcp/interior")


@mcp.tool(structured_output=False)
async def get_property_specs(property_id: str) -> dict[str, Any]:
    """Get specs section: specs, loan_info, house_plan_specs, nearby_places, evaluation_metrics."""
    return await _request("GET", f"/admin/properties/{property_id}/mcp/specs")


@mcp.tool(structured_output=False)
async def get_property_images(
    property_id: str, skip: int = 0, limit: int = 20
) -> dict[str, Any]:
    """Get a page of property images. Defaults skip=0 limit=20 (max 100)."""
    return await _request(
        "GET",
        f"/admin/properties/{property_id}/mcp/images",
        params={"skip": skip, "limit": limit},
    )


@mcp.tool()
async def create_property(title: str, location: str, price: int) -> dict[str, Any]:
    """Create a new draft property."""
    return await _request(
        "POST",
        "/admin/properties",
        json={"title": title, "location": location, "price": price},
    )


@mcp.tool()
async def update_property(property_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Partially update a property (full payload). Use houseinus://admin/schema/property-update for shape.

    Prefer the section-specific update tools for large fields:
    update_property_basic / _lifestyle / _interior / _specs.
    """
    return await _request("PATCH", f"/admin/properties/{property_id}", json=payload)


@mcp.tool(structured_output=False)
async def update_property_basic(
    property_id: str, payload: dict[str, Any]
) -> dict[str, Any]:
    """Partial update of basic fields: slug, title, subtitle, location, price,
    display_order, tags, hero_image_id, portfolio_thumb_id.
    Returns the updated summary."""
    return await _request(
        "PATCH", f"/admin/properties/{property_id}/mcp/basic", json=payload
    )


@mcp.tool(structured_output=False)
async def update_property_lifestyle(
    property_id: str, payload: dict[str, Any]
) -> dict[str, Any]:
    """Partial update of the lifestyle section: lifestyle_story,
    lifestyle_story_overlay, lifestyle_highlights, lifestyle_layout,
    lifestyle_scenarios. Returns the updated section."""
    return await _request(
        "PATCH", f"/admin/properties/{property_id}/mcp/lifestyle", json=payload
    )


@mcp.tool(structured_output=False)
async def update_property_interior(
    property_id: str, payload: dict[str, Any]
) -> dict[str, Any]:
    """Partial update of the interior section: interior_photos, floorplans.
    Returns the updated section."""
    return await _request(
        "PATCH", f"/admin/properties/{property_id}/mcp/interior", json=payload
    )


@mcp.tool(structured_output=False)
async def update_property_specs(
    property_id: str, payload: dict[str, Any]
) -> dict[str, Any]:
    """Partial update of the specs section: specs, loan_info, house_plan_specs,
    nearby_places, evaluation_metrics. Returns the updated section."""
    return await _request(
        "PATCH", f"/admin/properties/{property_id}/mcp/specs", json=payload
    )


@mcp.tool(description="Publish a property. destructive, requires explicit user confirmation.")
async def publish_property(property_id: str, confirm: bool, reason: str) -> dict[str, Any]:
    """Publish a property. destructive, requires explicit user confirmation."""
    _require_status_changes_enabled("publish_property")
    audit_reason = _require_confirmation("publish_property", confirm, reason)
    return await _request("POST", f"/admin/properties/{property_id}/publish", reason=audit_reason)


@mcp.tool(description="Unpublish a property. destructive, requires explicit user confirmation.")
async def unpublish_property(property_id: str, confirm: bool, reason: str) -> dict[str, Any]:
    """Unpublish a property. destructive, requires explicit user confirmation."""
    _require_status_changes_enabled("unpublish_property")
    audit_reason = _require_confirmation("unpublish_property", confirm, reason)
    return await _request("POST", f"/admin/properties/{property_id}/unpublish", reason=audit_reason)


@mcp.tool(description="Archive a property. destructive, requires explicit user confirmation.")
async def archive_property(property_id: str, confirm: bool, reason: str) -> dict[str, Any]:
    """Archive a property. destructive, requires explicit user confirmation."""
    _require_high_risk_enabled("archive_property")
    audit_reason = _require_confirmation("archive_property", confirm, reason)
    return await _request("DELETE", f"/admin/properties/{property_id}", reason=audit_reason)


@mcp.tool()
async def create_delivery_link(property_id: str, birthdate: str) -> dict[str, Any]:
    """Create or replace a property delivery link using an 8-digit birthdate."""
    return await _request(
        "POST",
        f"/admin/properties/{property_id}/delivery-link",
        json={"birthdate": birthdate},
    )


@mcp.tool()
async def update_property_image_meta(
    property_id: str,
    image_id: str,
    caption: str | None = None,
    alt: str | None = None,
) -> dict[str, Any]:
    """Update caption and/or alt text for a property image."""
    payload = {k: v for k, v in {"caption": caption, "alt": alt}.items() if v is not None}
    return await _request(
        "PATCH",
        f"/admin/properties/{property_id}/images/{image_id}",
        json=payload,
    )


@mcp.tool(description="Delete a property image. destructive, requires explicit user confirmation.")
async def delete_property_image(
    property_id: str,
    image_id: str,
    confirm: bool,
    reason: str,
) -> dict[str, Any]:
    """Delete a property image. destructive, requires explicit user confirmation."""
    _require_high_risk_enabled("delete_property_image")
    audit_reason = _require_confirmation("delete_property_image", confirm, reason)
    return await _request(
        "DELETE",
        f"/admin/properties/{property_id}/images/{image_id}",
        reason=audit_reason,
    )


@mcp.tool(description="Delete a property file. destructive, requires explicit user confirmation.")
async def delete_property_file(
    property_id: str,
    file_id: str,
    confirm: bool,
    reason: str,
) -> dict[str, Any]:
    """Delete a property file. destructive, requires explicit user confirmation."""
    _require_high_risk_enabled("delete_property_file")
    audit_reason = _require_confirmation("delete_property_file", confirm, reason)
    return await _request(
        "DELETE",
        f"/admin/properties/{property_id}/files/{file_id}",
        reason=audit_reason,
    )


# ---------------------------------------------------------------------------
# Open house


@mcp.tool()
async def list_open_house_events(
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, Any]:
    """List all admin open house events, optionally filtered by YYYY-MM-DD dates."""
    params = {k: v for k, v in {"date_from": date_from, "date_to": date_to}.items() if v}
    return await _request("GET", "/admin/open-house-events", params=params)


@mcp.tool()
async def list_property_open_house_events(property_id: str) -> dict[str, Any]:
    """List open house events for a property."""
    return await _request("GET", f"/admin/properties/{property_id}/open-house-events")


@mcp.tool()
async def create_open_house_event(property_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Create an open house event for a property."""
    return await _request(
        "POST",
        f"/admin/properties/{property_id}/open-house-events",
        json=payload,
    )


@mcp.tool()
async def update_open_house_event(
    property_id: str,
    event_id: str,
    payload: dict[str, Any],
    confirm: bool = False,
    reason: str = "",
) -> dict[str, Any]:
    """Update an open house event. If changing status, confirmation and reason are required."""
    audit_reason = None
    if "status" in payload:
        _require_status_changes_enabled("update_open_house_event status change")
        audit_reason = _require_confirmation(
            "update_open_house_event status change",
            confirm,
            reason,
        )
    return await _request(
        "PATCH",
        f"/admin/properties/{property_id}/open-house-events/{event_id}",
        json=payload,
        reason=audit_reason,
    )


@mcp.tool(
    description="Delete an open house event. destructive, requires explicit user confirmation."
)
async def delete_open_house_event(
    property_id: str,
    event_id: str,
    confirm: bool,
    reason: str,
) -> dict[str, Any]:
    """Delete an open house event. destructive, requires explicit user confirmation."""
    _require_high_risk_enabled("delete_open_house_event")
    audit_reason = _require_confirmation("delete_open_house_event", confirm, reason)
    return await _request(
        "DELETE",
        f"/admin/properties/{property_id}/open-house-events/{event_id}",
        reason=audit_reason,
    )


@mcp.tool()
async def list_open_house_reservations(property_id: str, event_id: str) -> dict[str, Any]:
    """List reservations for a property open house event."""
    return await _request(
        "GET",
        f"/admin/properties/{property_id}/open-house-events/{event_id}/reservations",
    )


@mcp.tool()
async def update_open_house_reservation(
    property_id: str,
    event_id: str,
    reservation_id: str,
    payload: dict[str, Any],
    confirm: bool = False,
    reason: str = "",
) -> dict[str, Any]:
    """Update a reservation. If changing status, confirmation and reason are required."""
    audit_reason = None
    if "status" in payload:
        _require_status_changes_enabled("update_open_house_reservation status change")
        audit_reason = _require_confirmation(
            "update_open_house_reservation status change",
            confirm,
            reason,
        )
    return await _request(
        "PATCH",
        f"/admin/properties/{property_id}/open-house-events/{event_id}/reservations/{reservation_id}",
        json=payload,
        reason=audit_reason,
    )


# ---------------------------------------------------------------------------
# Inquiries / leads


@mcp.tool()
async def list_inquiries(
    type: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> dict[str, Any]:
    """List admin inquiries with optional inquiry type filter."""
    params: dict[str, Any] = _page_params(skip, limit)
    if type:
        params["type"] = type
    return await _request("GET", "/admin/inquiries", params=params)


@mcp.tool()
async def list_open_house_inquiries(skip: int = 0, limit: int = 50) -> dict[str, Any]:
    """List open house inquiries."""
    return await _request("GET", "/admin/open-house-inquiries", params=_page_params(skip, limit))


@mcp.tool()
async def list_mbti_results(skip: int = 0, limit: int = 50) -> dict[str, Any]:
    """List MBTI survey results."""
    return await _request("GET", "/admin/mbti-results", params=_page_params(skip, limit))


# ---------------------------------------------------------------------------
# Blog


@mcp.tool()
async def list_blog_tags() -> list[dict[str, Any]]:
    """List blog tags, including deleted tags if the API returns them."""
    return await _request("GET", "/admin/blog/tags")


@mcp.tool()
async def create_blog_tag(name: str, slug: str) -> dict[str, Any]:
    """Create a blog tag."""
    return await _request("POST", "/admin/blog/tags", json={"name": name, "slug": slug})


@mcp.tool()
async def update_blog_tag(
    tag_id: str,
    name: str | None = None,
    slug: str | None = None,
) -> dict[str, Any]:
    """Update a blog tag."""
    payload = {k: v for k, v in {"name": name, "slug": slug}.items() if v is not None}
    return await _request("PATCH", f"/admin/blog/tags/{tag_id}", json=payload)


@mcp.tool(description="Delete a blog tag. destructive, requires explicit user confirmation.")
async def delete_blog_tag(tag_id: str, confirm: bool, reason: str) -> dict[str, Any]:
    """Delete a blog tag. destructive, requires explicit user confirmation."""
    _require_high_risk_enabled("delete_blog_tag")
    audit_reason = _require_confirmation("delete_blog_tag", confirm, reason)
    return await _request("DELETE", f"/admin/blog/tags/{tag_id}", reason=audit_reason)


@mcp.tool()
async def list_blog_posts(
    status: str | None = None,
    include_deleted: bool = False,
    skip: int = 0,
    limit: int = 50,
) -> dict[str, Any]:
    """List admin blog posts."""
    params: dict[str, Any] = {**_page_params(skip, limit), "include_deleted": include_deleted}
    if status:
        params["status"] = status
    return await _request("GET", "/admin/blog/posts", params=params)


@mcp.tool()
async def get_blog_post(post_id: str) -> dict[str, Any]:
    """Get admin blog post detail."""
    return await _request("GET", f"/admin/blog/posts/{post_id}")


@mcp.tool()
async def create_blog_post(payload: dict[str, Any]) -> dict[str, Any]:
    """Create a blog post draft/admin record."""
    return await _request("POST", "/admin/blog/posts", json=payload)


@mcp.tool()
async def update_blog_post(post_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Update a blog post."""
    return await _request("PATCH", f"/admin/blog/posts/{post_id}", json=payload)


@mcp.tool(description="Publish a blog post. destructive, requires explicit user confirmation.")
async def publish_blog_post(post_id: str, confirm: bool, reason: str) -> dict[str, Any]:
    """Publish a blog post. destructive, requires explicit user confirmation."""
    _require_status_changes_enabled("publish_blog_post")
    audit_reason = _require_confirmation("publish_blog_post", confirm, reason)
    return await _request("POST", f"/admin/blog/posts/{post_id}/publish", reason=audit_reason)


@mcp.tool(description="Unpublish a blog post. destructive, requires explicit user confirmation.")
async def unpublish_blog_post(post_id: str, confirm: bool, reason: str) -> dict[str, Any]:
    """Unpublish a blog post. destructive, requires explicit user confirmation."""
    _require_status_changes_enabled("unpublish_blog_post")
    audit_reason = _require_confirmation("unpublish_blog_post", confirm, reason)
    return await _request("POST", f"/admin/blog/posts/{post_id}/unpublish", reason=audit_reason)


@mcp.tool(description="Delete a blog post. destructive, requires explicit user confirmation.")
async def delete_blog_post(post_id: str, confirm: bool, reason: str) -> dict[str, Any]:
    """Delete a blog post. destructive, requires explicit user confirmation."""
    _require_high_risk_enabled("delete_blog_post")
    audit_reason = _require_confirmation("delete_blog_post", confirm, reason)
    return await _request("DELETE", f"/admin/blog/posts/{post_id}", reason=audit_reason)


@mcp.tool(
    description="Restore a deleted blog post. destructive, requires explicit user confirmation."
)
async def restore_blog_post(post_id: str, confirm: bool, reason: str) -> dict[str, Any]:
    """Restore a deleted blog post. destructive, requires explicit user confirmation."""
    _require_status_changes_enabled("restore_blog_post")
    audit_reason = _require_confirmation("restore_blog_post", confirm, reason)
    return await _request("POST", f"/admin/blog/posts/{post_id}/restore", reason=audit_reason)


@mcp.tool()
async def list_blog_menu() -> list[dict[str, Any]]:
    """List blog menu items."""
    return await _request("GET", "/admin/blog/menu")


@mcp.tool()
async def create_blog_menu_item(
    label: str,
    icon: str | None = None,
    tag_id: str | None = None,
    parent_id: str | None = None,
    sort_order: int = 0,
) -> dict[str, Any]:
    """Create a blog menu item."""
    payload = {
        "label": label,
        "icon": icon,
        "tag_id": tag_id,
        "parent_id": parent_id,
        "sort_order": sort_order,
    }
    return await _request("POST", "/admin/blog/menu", json=payload)


@mcp.tool()
async def update_blog_menu_item(
    item_id: str,
    label: str | None = None,
    icon: str | None = None,
    tag_id: str | None = None,
    parent_id: str | None = None,
    sort_order: int | None = None,
) -> dict[str, Any]:
    """Update a blog menu item."""
    payload = {
        k: v
        for k, v in {
            "label": label,
            "icon": icon,
            "tag_id": tag_id,
            "parent_id": parent_id,
            "sort_order": sort_order,
        }.items()
        if v is not None
    }
    return await _request("PATCH", f"/admin/blog/menu/{item_id}", json=payload)


@mcp.tool(description="Delete a blog menu item. destructive, requires explicit user confirmation.")
async def delete_blog_menu_item(item_id: str, confirm: bool, reason: str) -> dict[str, Any]:
    """Delete a blog menu item. destructive, requires explicit user confirmation."""
    _require_high_risk_enabled("delete_blog_menu_item")
    audit_reason = _require_confirmation("delete_blog_menu_item", confirm, reason)
    return await _request("DELETE", f"/admin/blog/menu/{item_id}", reason=audit_reason)


@mcp.tool(description="Reorder blog menu items. destructive, requires explicit user confirmation.")
async def reorder_blog_menu(
    ordered_ids: list[str],
    confirm: bool,
    reason: str,
) -> dict[str, Any]:
    """Reorder blog menu items. destructive, requires explicit user confirmation."""
    _require_status_changes_enabled("reorder_blog_menu")
    audit_reason = _require_confirmation("reorder_blog_menu", confirm, reason)
    return await _request(
        "POST",
        "/admin/blog/menu/reorder",
        json={"ordered_ids": ordered_ids},
        reason=audit_reason,
    )


# ---------------------------------------------------------------------------
# Users


@mcp.tool()
async def list_users(q: str | None = None, skip: int = 0, limit: int = 50) -> dict[str, Any]:
    """List users visible to admins."""
    params: dict[str, Any] = _page_params(skip, limit)
    if q:
        params["q"] = q
    return await _request("GET", "/admin/users", params=params)


@mcp.tool()
async def get_user(user_id: str) -> dict[str, Any]:
    """Get one user by id."""
    return await _request("GET", f"/admin/users/{user_id}")


@mcp.tool(description="Ban a user. destructive, requires explicit user confirmation.")
async def ban_user(user_id: str, confirm: bool, reason: str) -> dict[str, Any]:
    """Ban a user. destructive, requires explicit user confirmation."""
    _require_high_risk_enabled("ban_user")
    audit_reason = _require_confirmation("ban_user", confirm, reason)
    return await _request(
        "POST",
        f"/admin/users/{user_id}/ban",
        json={"reason": audit_reason},
        reason=audit_reason,
    )


@mcp.tool(description="Unban a user. destructive, requires explicit user confirmation.")
async def unban_user(user_id: str, confirm: bool, reason: str) -> dict[str, Any]:
    """Unban a user. destructive, requires explicit user confirmation."""
    _require_high_risk_enabled("unban_user")
    audit_reason = _require_confirmation("unban_user", confirm, reason)
    return await _request("POST", f"/admin/users/{user_id}/unban", reason=audit_reason)


@mcp.tool(description="Set a user's role. destructive, requires explicit user confirmation.")
async def set_user_role(
    user_id: str,
    role: Literal["user", "admin"],
    confirm: bool,
    reason: str,
) -> dict[str, Any]:
    """Set a user's role. destructive, requires explicit user confirmation."""
    _require_high_risk_enabled("set_user_role")
    audit_reason = _require_confirmation("set_user_role", confirm, reason)
    return await _request(
        "POST",
        f"/admin/users/{user_id}/role",
        json={"role": role},
        reason=audit_reason,
    )


def _configure_from_argv() -> None:
    global _DISABLE_HIGH_RISK, _DISABLE_STATUS_CHANGES

    retained = [sys.argv[0]]
    for arg in sys.argv[1:]:
        if arg == "--disable-status-changes":
            _DISABLE_STATUS_CHANGES = True
        elif arg == "--disable-high-risk":
            _DISABLE_HIGH_RISK = True
        else:
            retained.append(arg)
    sys.argv = retained


def main() -> None:
    _configure_from_argv()
    mcp.run()


if __name__ == "__main__":
    main()
