"""convert user_status / user_role enums to integers

Revision ID: 0008_user_enums_to_integers
Revises: 0007_admin_notification_prefs
Create Date: 2026-04-26 00:00:00

Same playbook as 0006 — these two ``users`` columns were missed in that
round. Integer codes match the IntStrEnum declarations on the model.

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0008_user_enums_to_integers"
down_revision: str | None = "0007_admin_notification_prefs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# (table, column, type_name, mapping {string: int})
_COLUMNS = [
    (
        "users",
        "status",
        "user_status",
        {"active": 0, "suspended": 1, "deleted": 2},
    ),
    (
        "users",
        "role",
        "user_role",
        {"user": 0, "admin": 1, "owner": 2},
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
    for table, column, type_name, mapping in _COLUMNS:
        op.execute(f"ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT")
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {column} TYPE INTEGER "
            f"USING ({_case_to_int(column, mapping)})"
        )
        op.execute(f"DROP TYPE {type_name}")


def downgrade() -> None:
    for table, column, type_name, mapping in reversed(_COLUMNS):
        values = ", ".join(f"'{name}'" for name in mapping.keys())
        op.execute(f"CREATE TYPE {type_name} AS ENUM ({values})")
        op.execute(f"ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT")
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {column} TYPE {type_name} "
            f"USING ({_case_to_text(column, mapping)}::{type_name})"
        )
