from __future__ import annotations

import uuid
from datetime import date as Date
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models.open_house import OpenHouseEventStatus, OpenHouseReservationStatus


class OpenHouseEventCreate(BaseModel):
    date: Date
    time: str = Field(min_length=1, max_length=120)
    capacity: int = Field(default=0, ge=0)
    status: OpenHouseEventStatus = OpenHouseEventStatus.scheduled
    notes: str | None = None


class OpenHouseEventUpdate(BaseModel):
    date: Date | None = None
    time: str | None = Field(default=None, max_length=120)
    capacity: int | None = Field(default=None, ge=0)
    status: OpenHouseEventStatus | None = None
    notes: str | None = None


class OpenHouseEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    property_id: uuid.UUID
    property_title: str | None = None
    date: Date
    time: str
    capacity: int
    available_spots: int
    reservation_count: int
    status: OpenHouseEventStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime


class OpenHouseEventListResponse(BaseModel):
    items: list[OpenHouseEventRead]
    total: int


class OpenHouseReservationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=1, max_length=80)
    privacy_consent: bool
    source_url: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def validate_privacy_consent(self) -> OpenHouseReservationCreate:
        if not self.privacy_consent:
            raise ValueError("privacy_consent is required")
        return self


class OpenHouseReservationUpdate(BaseModel):
    status: OpenHouseReservationStatus | None = None
    notes: str | None = None


class OpenHouseReservationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_id: uuid.UUID
    property_id: uuid.UUID | None
    property_title: str | None = None
    event_date: Date | None = None
    event_time: str | None = None
    name: str
    email: str
    phone: str
    privacy_consent: bool
    status: OpenHouseReservationStatus
    notes: str | None
    source_url: str | None
    created_at: datetime
    updated_at: datetime


class OpenHouseReservationListResponse(BaseModel):
    items: list[OpenHouseReservationRead]
    total: int
