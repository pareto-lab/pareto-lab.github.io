from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.inquiry import InquiryType


class InquiryCreate(BaseModel):
    type: InquiryType
    property_id: uuid.UUID | None = None
    name: str | None = Field(default=None, max_length=120)
    question: str | None = None
    contact_type: Literal["phone", "email"] | None = None
    contact_value: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=120)
    privacy_consent: bool
    source_url: str | None = Field(default=None, max_length=1000)
    extra: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_by_type(self) -> InquiryCreate:
        if not self.privacy_consent:
            raise ValueError("privacy_consent is required")

        if self.type in (InquiryType.house_question, InquiryType.metrics_question):
            if self.property_id is None:
                raise ValueError("property_id is required")
            if not (self.question or "").strip():
                raise ValueError("question is required")
            if not (self.contact_value or "").strip():
                raise ValueError("contact_value is required")

        if self.type == InquiryType.portfolio_request:
            if not (self.name or "").strip():
                raise ValueError("name is required")
            if self.contact_type not in ("phone", "email"):
                raise ValueError("contact_type is required")
            if not (self.contact_value or "").strip():
                raise ValueError("contact_value is required")
            if not (self.city or "").strip() or not (self.district or "").strip():
                raise ValueError("city and district are required")

        if self.type == InquiryType.matched_property_subscribe:
            if self.contact_type != "email":
                raise ValueError("contact_type must be email")
            if not (self.contact_value or "").strip():
                raise ValueError("contact_value is required")

        return self


class InquiryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: InquiryType
    property_id: uuid.UUID | None
    property_title: str | None = None
    name: str | None
    question: str | None
    contact_type: str | None
    contact_value: str | None
    city: str | None
    district: str | None
    privacy_consent: bool
    source_url: str | None
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class InquiryListResponse(BaseModel):
    items: list[InquiryRead]
    total: int
    skip: int
    limit: int
