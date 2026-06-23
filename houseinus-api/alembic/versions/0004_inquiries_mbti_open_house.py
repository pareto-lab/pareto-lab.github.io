"""inquiries + mbti results + open house reservations

Revision ID: 0004_inquiries_mbti_open_house
Revises: 0003_properties
Create Date: 2026-04-25 00:00:00

"""
from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import date

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004_inquiries_mbti_open_house"
down_revision: str | None = "0003_properties"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inquiry_type = postgresql.ENUM(
        "house_question",
        "metrics_question",
        "portfolio_request",
        name="inquiry_type",
        create_type=False,
    )
    open_house_event_status = postgresql.ENUM(
        "scheduled",
        "closed",
        "cancelled",
        name="open_house_event_status",
        create_type=False,
    )
    open_house_reservation_status = postgresql.ENUM(
        "reserved",
        "cancelled",
        "attended",
        "no_show",
        name="open_house_reservation_status",
        create_type=False,
    )

    bind = op.get_bind()
    inquiry_type.create(bind, checkfirst=True)
    open_house_event_status.create(bind, checkfirst=True)
    open_house_reservation_status.create(bind, checkfirst=True)

    op.create_table(
        "inquiries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("type", inquiry_type, nullable=False),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("question", sa.Text(), nullable=True),
        sa.Column("contact_type", sa.String(length=20), nullable=True),
        sa.Column("contact_value", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("district", sa.String(length=120), nullable=True),
        sa.Column("privacy_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=80), nullable=True),
        sa.Column(
            "extra",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_inquiries_type", "inquiries", ["type"])
    op.create_index("ix_inquiries_property_id", "inquiries", ["property_id"])
    op.create_index("ix_inquiries_created_at", "inquiries", ["created_at"])

    op.create_table(
        "mbti_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("participant_id", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("email_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("age", sa.String(length=50), nullable=False),
        sa.Column("gender", sa.String(length=50), nullable=False),
        sa.Column("family_type", sa.String(length=80), nullable=False),
        sa.Column("driving", sa.Boolean(), nullable=False),
        sa.Column("plants", sa.Boolean(), nullable=False),
        sa.Column("pets", sa.Boolean(), nullable=False),
        sa.Column("camping", sa.Boolean(), nullable=False),
        sa.Column(
            "hobbies",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "dreams",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("source", sa.String(length=40), nullable=False, server_default="anonymous"),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=80), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_mbti_results_participant_id", "mbti_results", ["participant_id"])
    op.create_index("ix_mbti_results_email", "mbti_results", ["email"])
    op.create_index("ix_mbti_results_created_at", "mbti_results", ["created_at"])

    op.create_table(
        "open_house_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("time", sa.String(length=120), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "status",
            open_house_event_status,
            nullable=False,
            server_default="scheduled",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_open_house_events_property_id", "open_house_events", ["property_id"])
    op.create_index("ix_open_house_events_date", "open_house_events", ["date"])
    op.create_index("ix_open_house_events_status", "open_house_events", ["status"])

    _backfill_open_house_events()

    op.create_table(
        "open_house_reservations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=80), nullable=False),
        sa.Column("privacy_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "status",
            open_house_reservation_status,
            nullable=False,
            server_default="reserved",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=80), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["event_id"], ["open_house_events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_open_house_reservations_event_id",
        "open_house_reservations",
        ["event_id"],
    )
    op.create_index(
        "ix_open_house_reservations_property_id",
        "open_house_reservations",
        ["property_id"],
    )
    op.create_index(
        "ix_open_house_reservations_status",
        "open_house_reservations",
        ["status"],
    )
    op.create_index(
        "ix_open_house_reservations_created_at",
        "open_house_reservations",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_open_house_reservations_created_at",
        table_name="open_house_reservations",
    )
    op.drop_index("ix_open_house_reservations_status", table_name="open_house_reservations")
    op.drop_index(
        "ix_open_house_reservations_property_id",
        table_name="open_house_reservations",
    )
    op.drop_index("ix_open_house_reservations_event_id", table_name="open_house_reservations")
    op.drop_table("open_house_reservations")

    op.drop_index("ix_open_house_events_status", table_name="open_house_events")
    op.drop_index("ix_open_house_events_date", table_name="open_house_events")
    op.drop_index("ix_open_house_events_property_id", table_name="open_house_events")
    op.drop_table("open_house_events")

    op.drop_index("ix_mbti_results_created_at", table_name="mbti_results")
    op.drop_index("ix_mbti_results_email", table_name="mbti_results")
    op.drop_index("ix_mbti_results_participant_id", table_name="mbti_results")
    op.drop_table("mbti_results")

    op.drop_index("ix_inquiries_created_at", table_name="inquiries")
    op.drop_index("ix_inquiries_property_id", table_name="inquiries")
    op.drop_index("ix_inquiries_type", table_name="inquiries")
    op.drop_table("inquiries")

    op.execute("DROP TYPE IF EXISTS open_house_reservation_status")
    op.execute("DROP TYPE IF EXISTS open_house_event_status")
    op.execute("DROP TYPE IF EXISTS inquiry_type")


def _backfill_open_house_events() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id, open_house_events "
            "FROM properties WHERE open_house_events != '[]'::jsonb"
        )
    ).mappings()
    insert_stmt = sa.text(
        """
        INSERT INTO open_house_events
            (id, property_id, date, time, capacity, status, created_at, updated_at)
        VALUES
            (:id, :property_id, :date, :time, :capacity,
             CAST(:status AS open_house_event_status), now(), now())
        """
    )
    for row in rows:
        for event in row["open_house_events"] or []:
            event_date = _parse_date(event.get("date"))
            event_time = str(event.get("time") or "").strip()
            if event_date is None or not event_time:
                continue
            conn.execute(
                insert_stmt,
                {
                    "id": uuid.uuid4(),
                    "property_id": row["id"],
                    "date": event_date,
                    "time": event_time,
                    "capacity": _parse_int(event.get("available_spots")),
                    "status": "scheduled",
                },
            )


def _parse_date(value: object) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def _parse_int(value: object) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0
