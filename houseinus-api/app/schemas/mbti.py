from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class MbtiResultCreate(BaseModel):
    participant_id: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = None
    email_consent: bool = False

    age: str = Field(min_length=1, max_length=50)
    gender: str = Field(min_length=1, max_length=50)
    family_type: str = Field(min_length=1, max_length=80)
    driving: bool
    plants: bool
    pets: bool
    camping: bool
    hobbies: list[str] = Field(default_factory=list)
    dreams: list[str] = Field(default_factory=list)

    source: Literal["anonymous", "email_save"] = "anonymous"
    source_url: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def validate_email_consent(self) -> MbtiResultCreate:
        if self.email and not self.email_consent:
            raise ValueError("email_consent is required when email is provided")
        return self


class MbtiResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    participant_id: str
    email: str | None
    email_consent: bool
    age: str
    gender: str
    family_type: str
    driving: bool
    plants: bool
    pets: bool
    camping: bool
    hobbies: list[str]
    dreams: list[str]
    source: str
    source_url: str | None
    created_at: datetime
    updated_at: datetime


class MbtiResultListResponse(BaseModel):
    items: list[MbtiResultRead]
    total: int
    skip: int
    limit: int
