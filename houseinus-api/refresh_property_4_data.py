"""One-shot: refresh the text/JSONB data fields of the seeded "Property 4"
without touching its images or status.

Use after editing the constants in ``seed_property_4.py`` (e.g. when restoring
``nearby_places`` categories that went missing during the API migration).

Run:
    cd /path/to/houseinus-api
    uv run python refresh_property_4_data.py

Like the seed script, this honors ``DATABASE_URL_OVERRIDE`` at the top of
``seed_property_4.py``.
"""
from __future__ import annotations

import asyncio

from app.models import Property

from seed_property_4 import (
    EVAL_METRICS,
    HOUSE_PLAN_SPECS,
    LIFESTYLE_HIGHLIGHTS,
    LIFESTYLE_STORY,
    NEARBY_PLACES,
    SEED_PROPERTY_ID,
    SPECS,
    SessionFactory,
    TAGS,
    engine,
)


# Fields refreshed by this script. Image-related JSONB columns
# (``interior_photos``, ``floorplans``, ``lifestyle_scenarios``) are
# intentionally left alone — those reference uploaded image IDs that we don't
# want to clobber here.
TEXT_FIELDS = {
    "tags": TAGS,
    "lifestyle_story": LIFESTYLE_STORY,
    "lifestyle_highlights": LIFESTYLE_HIGHLIGHTS,
    "specs": SPECS,
    "house_plan_specs": HOUSE_PLAN_SPECS,
    "nearby_places": NEARBY_PLACES,
    "evaluation_metrics": EVAL_METRICS,
}


async def amain() -> None:
    async with SessionFactory() as db:
        prop = await db.get(Property, SEED_PROPERTY_ID)
        if prop is None:
            print(
                f"Property {SEED_PROPERTY_ID} not found — run seed_property_4.py first."
            )
            return

        for field, value in TEXT_FIELDS.items():
            setattr(prop, field, value)
        await db.commit()

        print(f"✓ Refreshed property {SEED_PROPERTY_ID} ({prop.title})")
        for field in TEXT_FIELDS:
            print(f"  · {field}")


def main() -> None:
    try:
        asyncio.run(amain())
    finally:
        try:
            asyncio.run(engine.dispose())
        except Exception:
            pass


if __name__ == "__main__":
    main()
