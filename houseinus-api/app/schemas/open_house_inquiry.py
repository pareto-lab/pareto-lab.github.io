from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class OpenHouseInquiryCreate(BaseModel):
    property_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    privacy_consent: bool
    source_url: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _validate(self) -> OpenHouseInquiryCreate:
        if not self.privacy_consent:
            raise ValueError("privacy_consent is required")
        if not self.name.strip():
            raise ValueError("name is required")
        return self


class OpenHouseInquiryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    property_id: uuid.UUID | None
    property_title: str | None = None
    name: str
    email: str
    privacy_consent: bool
    source_url: str | None
    created_at: datetime
    updated_at: datetime


class OpenHouseInquiryListResponse(BaseModel):
    items: list[OpenHouseInquiryRead]
    total: int
    skip: int
    limit: int
