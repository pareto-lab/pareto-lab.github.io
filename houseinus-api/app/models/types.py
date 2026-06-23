from __future__ import annotations

import enum
from typing import Any

from sqlalchemy import Integer
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator


class IntStrEnum(enum.StrEnum):
    """Enum where each member carries both a string value (used by Python and
    the JSON wire format) and a stable small integer code (used as the
    database representation).

    Members are declared as ``name = ("string_value", int_code)``. The integer
    code must remain stable for the lifetime of the schema; reorderings or
    renames are fine but the int code itself should not be reused or shifted.
    """

    _code_: int

    def __new__(cls, value: str, code: int) -> IntStrEnum:
        obj = str.__new__(cls, value)
        obj._value_ = value
        obj._code_ = code
        return obj

    @property
    def code(self) -> int:
        return self._code_

    @classmethod
    def from_code(cls, code: int) -> IntStrEnum:
        for member in cls:
            if member._code_ == code:
                return member
        raise ValueError(f"{cls.__name__} has no member with code {code}")


class IntegerEnum(TypeDecorator[IntStrEnum]):
    """SQLAlchemy column type backing an :class:`IntStrEnum` with an INTEGER."""

    impl = Integer
    cache_ok = True

    def __init__(self, enum_class: type[IntStrEnum], **kw: Any) -> None:
        super().__init__(**kw)
        self.enum_class = enum_class

    def process_bind_param(
        self, value: IntStrEnum | str | int | None, dialect: Dialect
    ) -> int | None:
        if value is None:
            return None
        if isinstance(value, self.enum_class):
            return value.code
        if isinstance(value, str):
            return self.enum_class(value).code
        if isinstance(value, int):
            return self.enum_class.from_code(value).code
        raise TypeError(f"unsupported value for {self.enum_class.__name__}: {value!r}")

    def process_result_value(
        self, value: int | None, dialect: Dialect
    ) -> IntStrEnum | None:
        if value is None:
            return None
        return self.enum_class.from_code(int(value))
