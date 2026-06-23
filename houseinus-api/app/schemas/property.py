from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.property import PropertyStatus

# ---------------------------------------------------------------- nested

# These mirror the JSONB shape that the public site expects. Validation here
# is mostly type-only — the admin UI is the source of truth for content.


class Specs(BaseModel):
    beds: int | None = None
    baths: int | None = None
    land_area: str | None = None
    built_year: str | None = None
    indoor_area: str | None = None
    scale: str | None = None


class LoanInfo(BaseModel):
    estimated_monthly_payment: int | None = None
    max_loan_amount: int | None = None
    interest_rate: float | None = None
    loan_term: int | None = None


class OpenHouseEvent(BaseModel):
    id: uuid.UUID | None = None
    property_id: uuid.UUID | None = None
    date: str
    time: str
    available_spots: int
    capacity: int | None = None
    reservation_count: int = 0
    status: str | None = None


class HousePlanSpecRow(BaseModel):
    label: str
    value: str
    info_text: str | None = None
    hide_info: bool = False


class HousePlanSpecs(BaseModel):
    main: list[HousePlanSpecRow] = Field(default_factory=list)
    collapsed: list[HousePlanSpecRow] = Field(default_factory=list)


class NearbyPlace(BaseModel):
    name: str
    distance: str | None = None


class NearbyCategory(BaseModel):
    icon: str = "MapPin"  # lucide icon name (School/Building2/ShoppingCart/...)
    label: str
    info_text: str | None = None
    hide_info: bool = False
    places: list[NearbyPlace] = Field(default_factory=list)


class EvaluationMetric(BaseModel):
    score: int = Field(ge=0, le=100)
    title: str
    description: str


class InteriorPhoto(BaseModel):
    image_id: uuid.UUID
    caption: str = ""
    room: str = ""
    portrait: bool = False
    floor: int = 1
    # [x%, y%, w%, h%] on the floorplan
    floorplan_rect: list[float] = Field(default_factory=lambda: [0, 0, 0, 0])
    before_image_id: uuid.UUID | None = None
    before_position: Literal["top-left", "top-right", "bottom-left", "bottom-right"] | None = None
    swapped: bool = False


class FloorplanEntry(BaseModel):
    image_id: uuid.UUID
    label: str = ""


class LifestyleScenario(BaseModel):
    image_id: uuid.UUID
    description: str = ""


# ---------------------------------------------------------------- image / file


class PropertyImageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    storage_key: str
    original_filename: str
    mime_type: str
    byte_size: int
    width: int | None
    height: int | None
    caption: str | None
    alt: str | None
    uploaded_at: datetime
    url: str  # computed; injected by service


class ImageMetaUpdate(BaseModel):
    caption: str | None = None
    alt: str | None = None


# ---------------------------------------------------------------- property


class PropertyBase(BaseModel):
    """Shared shape used by both create + read, minus FKs and timestamps."""

    slug: str | None = None
    title: str
    subtitle: str | None = None
    location: str
    price: int = Field(ge=0)
    display_order: int = 0
    tags: list[str] = Field(default_factory=list)

    lifestyle_story: str | None = None
    lifestyle_story_overlay: bool = False
    lifestyle_highlights: list[str] = Field(default_factory=list)
    lifestyle_layout: str | None = None  # e.g. "2-side", "2-hero", "3-row", "3-hero", "4-grid", "4-hero"

    specs: Specs = Field(default_factory=Specs)
    loan_info: LoanInfo = Field(default_factory=LoanInfo)
    open_house_events: list[OpenHouseEvent] = Field(default_factory=list)
    house_plan_specs: HousePlanSpecs = Field(default_factory=HousePlanSpecs)
    nearby_places: list[NearbyCategory] = Field(default_factory=list)
    evaluation_metrics: list[EvaluationMetric] = Field(default_factory=list)
    interior_photos: list[InteriorPhoto] = Field(default_factory=list)
    floorplans: dict[str, FloorplanEntry] = Field(default_factory=dict)
    lifestyle_scenarios: list[LifestyleScenario] = Field(default_factory=list)


class PropertyCreate(BaseModel):
    """Minimum required to spawn a new draft."""

    title: str = Field(min_length=1, max_length=200)
    location: str = Field(min_length=1, max_length=200)
    price: int = Field(ge=0)


class PropertyUpdate(BaseModel):
    """Partial update — every field optional. ``hero_image_id`` /
    ``portfolio_thumb_id`` reference images that already exist via upload."""

    slug: str | None = None
    title: str | None = None
    subtitle: str | None = None
    location: str | None = None
    price: int | None = Field(default=None, ge=0)
    display_order: int | None = None
    tags: list[str] | None = None

    hero_image_id: uuid.UUID | None = None
    portfolio_thumb_id: uuid.UUID | None = None

    lifestyle_story: str | None = None
    lifestyle_story_overlay: bool | None = None
    lifestyle_highlights: list[str] | None = None
    lifestyle_layout: str | None = None
    specs: Specs | None = None
    loan_info: LoanInfo | None = None
    house_plan_specs: HousePlanSpecs | None = None
    nearby_places: list[NearbyCategory] | None = None
    evaluation_metrics: list[EvaluationMetric] | None = None
    interior_photos: list[InteriorPhoto] | None = None
    floorplans: dict[str, FloorplanEntry] | None = None
    lifestyle_scenarios: list[LifestyleScenario] | None = None


# ---------------------------------------------------------------- MCP section updates
#
# Narrow partial-update schemas matching the GET /mcp/{section} splits.
# Keeping each request body small lets MCP clients update one section at a
# time without hitting the stdio line-buffer limit on either request or
# response.


class PropertyBasicUpdate(BaseModel):
    slug: str | None = None
    title: str | None = None
    subtitle: str | None = None
    location: str | None = None
    price: int | None = Field(default=None, ge=0)
    display_order: int | None = None
    tags: list[str] | None = None
    hero_image_id: uuid.UUID | None = None
    portfolio_thumb_id: uuid.UUID | None = None


class PropertyLifestyleUpdate(BaseModel):
    lifestyle_story: str | None = None
    lifestyle_story_overlay: bool | None = None
    lifestyle_highlights: list[str] | None = None
    lifestyle_layout: str | None = None
    lifestyle_scenarios: list[LifestyleScenario] | None = None


class PropertyInteriorUpdate(BaseModel):
    interior_photos: list[InteriorPhoto] | None = None
    floorplans: dict[str, FloorplanEntry] | None = None


class PropertySpecsUpdate(BaseModel):
    specs: Specs | None = None
    loan_info: LoanInfo | None = None
    house_plan_specs: HousePlanSpecs | None = None
    nearby_places: list[NearbyCategory] | None = None
    evaluation_metrics: list[EvaluationMetric] | None = None


class PropertyRead(PropertyBase):
    """Full read shape with FKs resolved into nested image/file objects.

    Used for the public read endpoint. Admin-only fields live in PropertyAdminRead.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: PropertyStatus
    hero_image: PropertyImageRead | None = None
    portfolio_thumb: PropertyImageRead | None = None
    images: list[PropertyImageRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None = None


class PropertyAdminRead(PropertyRead):
    """Admin-only read — adds delivery link fields. Never serve publicly."""

    delivery_token: str | None = None
    delivery_birthdate: str | None = None


class PropertyListItem(BaseModel):
    """Compact row for the list page — includes the few extra fields the
    public PropertyCard renders (subtitle, tags, specs, upcoming events)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str | None
    status: PropertyStatus
    title: str
    subtitle: str | None = None
    location: str
    price: int
    display_order: int
    tags: list[str] = Field(default_factory=list)
    specs: Specs = Field(default_factory=Specs)
    open_house_events: list[OpenHouseEvent] = Field(default_factory=list)
    hero_image: PropertyImageRead | None = None
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None


class PropertyListResponse(BaseModel):
    items: list[PropertyListItem]
    total: int
    skip: int
    limit: int


class PublishAction(BaseModel):
    action: Literal["publish", "unpublish"]


