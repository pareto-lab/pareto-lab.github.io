"""convert PG enum columns to integer-backed IntStrEnum

Revision ID: 0006_enums_to_integers
Revises: 0005_drop_legacy_open_house_col
Create Date: 2026-04-26 00:00:00

Replaces six PostgreSQL ENUM types with INTEGER columns. The ORM still exposes
:class:`IntStrEnum` members so application/wire format is unchanged. Integer
codes are defined in the model classes and must stay in sync with the CASE
expressions below.

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0006_enums_to_integers"
down_revision: str | None = "0005_drop_legacy_open_house_col"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# (table, column, type_name, mapping {string: int}, server_default_int_or_None)
_COLUMNS = [
    (
        "auth_tokens",
        "purpose",
        "auth_token_purpose",
        {"email_verify": 0, "password_reset": 1},
        None,
    ),
    (
        "oauth_accounts",
        "provider",
        "oauth_provider",
        {"google": 0, "naver": 1, "kakao": 2},
        None,
    ),
    (
        "properties",
        "status",
        "property_status",
        {"draft": 0, "published": 1, "archived": 2},
        0,
    ),
    (
        "inquiries",
        "type",
        "inquiry_type",
        {"house_question": 0, "metrics_question": 1, "portfolio_request": 2},
        None,
    ),
    (
        "open_house_events",
        "status",
        "open_house_event_status",
        {"scheduled": 0, "closed": 1, "cancelled": 2},
        0,
    ),
    (
        "open_house_reservations",
        "status",
        "open_house_reservation_status",
        {"reserved": 0, "cancelled": 1, "attended": 2, "no_show": 3},
        0,
    ),
]


def _case_to_int(column: str, mapping: dict[str, int]) -> str:
    whens = "\n".join(
        f"        WHEN '{name}' THEN {code}" for name, code in mapping.items()
    )
    return f"CASE {column}::text\n{whens}\n    END"


def _case_to_text(column: str, mapping: dict[str, int]) -> str:
    whens = "\n".join(
        f"        WHEN {code} THEN '{name}'" for name, code in mapping.items()
    )
    return f"CASE {column}\n{whens}\n    END"


def upgrade() -> None:
    for table, column, type_name, mapping, default_int in _COLUMNS:
        op.execute(f'ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT')
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {column} TYPE INTEGER "
            f"USING ({_case_to_int(column, mapping)})"
        )
        if default_int is not None:
            op.execute(
                f"ALTER TABLE {table} ALTER COLUMN {column} SET DEFAULT {default_int}"
            )
        op.execute(f"DROP TYPE {type_name}")


def downgrade() -> None:
    for table, column, type_name, mapping, default_int in reversed(_COLUMNS):
        values = ", ".join(f"'{name}'" for name in mapping.keys())
        op.execute(f"CREATE TYPE {type_name} AS ENUM ({values})")
        op.execute(f'ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT')
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {column} TYPE {type_name} "
            f"USING ({_case_to_text(column, mapping)}::{type_name})"
        )
        if default_int is not None:
            default_name = next(n for n, c in mapping.items() if c == default_int)
            op.execute(
                f"ALTER TABLE {table} ALTER COLUMN {column} "
                f"SET DEFAULT '{default_name}'::{type_name}"
            )
