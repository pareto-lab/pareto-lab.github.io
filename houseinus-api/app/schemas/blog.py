from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ─── Tag ────────────────────────────────────────────────────────────────────


class BlogTagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class BlogTagUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    slug: str | None = Field(None, min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class BlogTagRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Post ────────────────────────────────────────────────────────────────────


class BlogPostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    slug: str = Field(..., min_length=1, max_length=200, pattern=r"^[a-z0-9]+(?:[-a-z0-9]*[a-z0-9])?$")
    excerpt: str | None = None
    cover_image_url: str | None = None
    content: dict[str, Any] = Field(default_factory=dict)
    tag_ids: list[uuid.UUID] = Field(default_factory=list)
    reference_date: datetime | None = None


class BlogPostUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    slug: str | None = Field(None, min_length=1, max_length=200, pattern=r"^[a-z0-9]+(?:[-a-z0-9]*[a-z0-9])?$")
    excerpt: str | None = None
    cover_image_url: str | None = None
    content: dict[str, Any] | None = None
    tag_ids: list[uuid.UUID] | None = None
    reference_date: datetime | None = None


class BlogPostListItem(BaseModel):
    id: uuid.UUID
    title: str
    slug: str
    excerpt: str | None
    cover_image_url: str | None
    status: str
    reference_date: datetime
    tags: list[BlogTagRead]

    model_config = {"from_attributes": True}


class BlogPostDetail(BaseModel):
    id: uuid.UUID
    title: str
    slug: str
    excerpt: str | None
    cover_image_url: str | None
    content: dict[str, Any]
    status: str
    reference_date: datetime
    tags: list[BlogTagRead]

    model_config = {"from_attributes": True}


class BlogPostAdminDetail(BlogPostDetail):
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    created_by_id: uuid.UUID | None
    updated_by_id: uuid.UUID | None


class BlogPostListResponse(BaseModel):
    items: list[BlogPostListItem]
    total: int
    skip: int
    limit: int


# ─── Menu ────────────────────────────────────────────────────────────────────


class BlogMenuItemCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    icon: str | None = Field(None, max_length=50)
    tag_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    sort_order: int = 0


class BlogMenuItemUpdate(BaseModel):
    label: str | None = Field(None, min_length=1, max_length=100)
    icon: str | None = None
    tag_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    sort_order: int | None = None


class BlogMenuItemRead(BaseModel):
    id: uuid.UUID
    label: str
    icon: str | None
    tag_id: uuid.UUID | None
    tag: BlogTagRead | None
    parent_id: uuid.UUID | None
    sort_order: int
    children: list["BlogMenuItemRead"] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class BlogMenuReorder(BaseModel):
    ordered_ids: list[uuid.UUID]


# ─── Image upload ────────────────────────────────────────────────────────────


class BlogImageUploadResponse(BaseModel):
    url: str
