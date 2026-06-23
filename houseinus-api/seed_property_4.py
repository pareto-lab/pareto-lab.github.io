"""One-time seed script — imports the static "Property 4" data from
houseinus-web into the houseinus-api database.

Run once after migrations:
    cd /path/to/houseinus-api
    uv run python seed_property_4.py

Behavior:
- Allocates a deterministic UUID so re-running is idempotent (skips if exists).
- Copies image files from ../houseinus-web/src/assets and ../houseinus-web/public
  into the configured storage path (default `uploads/`).
- Inserts the property as **draft** (so an admin can review before publish).

Keep this script around — useful if we ever need to reset and reimport.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import date as Date
from pathlib import Path

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import SessionFactory as _DefaultSessionFactory
from app.database import engine as _default_engine
from app.models import (
    OpenHouseEvent,
    OpenHouseEventStatus,
    Property,
    PropertyImage,
    PropertyStatus,
)
from app.services import storage_service
from app.utils.time import utcnow

# --------------------------------------------------------------- connection
#
# Optional override for the database connection. Leave empty to use the
# `database` section from ``config.json`` (default behavior). When seeding
# into a different environment (e.g. a remote prod DB), set this to a full
# SQLAlchemy async URL:
#   "postgresql+psycopg://user:password@host:5432/dbname"
DATABASE_URL_OVERRIDE: str = ""


if DATABASE_URL_OVERRIDE:
    engine = create_async_engine(DATABASE_URL_OVERRIDE)
    SessionFactory = async_sessionmaker(engine, expire_on_commit=False)
else:
    engine = _default_engine
    SessionFactory = _DefaultSessionFactory


# ----------------------------------------------------------------- constants

# Stable UUID so the script is idempotent.
SEED_PROPERTY_ID = uuid.UUID("00000000-0000-0000-0000-000000000004")

HERE = Path(__file__).resolve().parent  # houseinus-api/
WORKSPACE_ROOT = HERE.parent  # houseinus/ workspace root
ASSETS = WORKSPACE_ROOT / "houseinus-web" / "src" / "assets"
PUBLIC = WORKSPACE_ROOT / "houseinus-web" / "public"

# Source filename → local label used when constructing storage keys.
HERO_FILE = ASSETS / "property-4.jpg"
PORTFOLIO_THUMB_FILE = PUBLIC / "portfolios" / "property-4-thumb.jpg"

# Floorplans (per floor)
FLOORPLAN_FILES = {
    1: ASSETS / "floorplan-1f.png",
    2: ASSETS / "floorplan-2f.png",
    3: ASSETS / "floorplan-3f.png",
}

# Interior gallery photos: source filename → (caption, room, portrait, floor, rect)
# rect = [x%, y%, w%, h%] on the floorplan of that floor.
INTERIOR_PHOTOS = [
    (
        "interior-living.jpg",
        "거실 기준 동남향으로, 아침부터 정오까지 거실에 햇빛이 쏟아진다",
        "거실",
        False,
        1,
        [45, 52, 13, 21],
    ),
    (
        "interior-dining.jpg",
        "주방 옆 다이닝 공간, 아늑한 조명과 함께하는 저녁 식사",
        "주방 & 식당",
        True,
        1,
        [36, 25, 11, 18],
    ),
    (
        "interior-1f-kitchen.png",
        "넓은 ㄱ자 주방과 아일랜드 식탁, 온 가족이 함께하는 요리 공간",
        "부엌",
        True,
        1,
        [52, 37, 12, 18],
    ),
    (
        "interior-2f-stairs.png",
        "원목 계단과 자연광이 어우러지는 3층으로 올라가는 길",
        "계단",
        True,
        2,
        [47, 25, 6, 19],
    ),
    (
        "interior-2f-bedroom.png",
        "넓은 창과 따뜻한 톤의 부부 침실, 편안한 하루의 마무리",
        "부부 침실",
        False,
        2,
        [45, 48, 14, 24],
    ),
    (
        "interior-2f-kidsroom.png",
        "아이의 상상력이 자라는 자녀방, 안전하고 아늑한 공간",
        "자녀방",
        False,
        2,
        [36, 25, 11, 18],
    ),
    (
        "interior-2f-dressroom.png",
        "침실과 이어지는 드레스룸, 넉넉한 수납 공간",
        "드레스룸",
        True,
        2,
        [58, 37, 6, 18],
    ),
    (
        "interior-3f-office.png",
        "재택근무를 위한 독립된 오피스 공간, 아이 책상도 함께",
        "오피스",
        False,
        3,
        [45, 42, 13, 21],
    ),
    (
        "interior-3f-storage.png",
        "대형 붙박이장이 있는 짐 보관방, 깔끔한 정리정돈",
        "짐 보관방",
        False,
        3,
        [36, 25, 11, 18],
    ),
]

# Lifestyle scenarios: (filename, description)
LIFESTYLE_SCENARIOS = [
    ("lifestyle-backyard-wine.jpg", "선선한 저녁,\n마당에서 와인 한 잔 즐기기\n좋은 날들이 이어질 거예요."),
    ("lifestyle-garden.jpg", "마당 한켠 작은 텃밭에서\n아이와 함께 흙을 만지고\n씨앗을 심는 봄날의 오후."),
    ("lifestyle-garden-harvest.jpg", "정성껏 키운 허브를 수확하는 기쁨.\n집 앞 정원이\n우리 가족의 작은 농장이 됩니다."),
    ("lifestyle-garden-path.jpg", "정성껏 가꾼 꽃길을 따라\n마당을 천천히 걷는\n하루의 가장 평온한 시간."),
    ("lifestyle-yard-work.jpg", "마당에서 노트북을 펴고\n초록 풍경을 보며 일하는\n여유로운 재택근무 시간."),
    ("lifestyle-yard-play.jpg", "넓은 마당에서 아이와 함께\n뛰어놀고, 물놀이하고,\n하늘을 바라보는 여유."),
    ("lifestyle-yard-pool.jpg", "여름엔 마당 수영장으로\n아이와 시원하게 물놀이하는\n우리 집만의 바캉스."),
    ("lifestyle-yard-party.jpg", "주말엔 마당을 꾸며\n아이 생일파티나 피크닉을 열어보세요.\n우리 집만의 특별한 추억이 쌓여요."),
    ("lifestyle-dog-yard.jpg", "마당을 자유롭게 뛰어다니는\n반려견의 행복한 일상.\n아이들과 함께 뛰어놀아요."),
    ("lifestyle-walk.jpg", "동네를 나서면 바로 하천 산책로.\n유모차도, 반려견도 함께\n여유로운 산책을 즐겨보세요."),
    ("lifestyle-laundry.jpg", "맑은 날이면 마당에\n이불과 빨래를 널어두세요.\n보송보송한 햇살 냄새가 납니다."),
    ("lifestyle-sunset.jpg", "3층 창문 너머로\n산 위에 떠오르는 일출을\n매일 감상할 수 있어요."),
    ("lifestyle-morning-light.jpg", "침실에 스며드는\n아침 햇살로 하루를 시작하는\n고요하고 따뜻한 순간."),
    ("lifestyle-snow.jpg", "겨울이 오면 눈 쌓인 동네에서\n아이와 함께\n사계절을 온몸으로 느껴요."),
    ("lifestyle-snow-sled.jpg", "마당에 쌓인 눈 위에서\n썰매를 타며 까르르 웃는\n아이의 겨울 놀이터."),
    ("lifestyle-snow-village.jpg", "눈 내리는 날의 타운하우스 풍경.\n창밖으로 보이는\n하얀 겨울 동네가 그림 같아요."),
    ("lifestyle-snow-mountain.jpg", "창밖으로 보이는 설산의 풍경.\n도심에선 볼 수 없는\n자연이 바로 곁에 있어요."),
    ("lifestyle-campfire.jpg", "마당에서 모닥불을 피우고\n마시멜로를 구워 먹는 저녁.\n아이가 오랫동안 얘기할\n추억이 만들어져요."),
    ("lifestyle-bbq.jpg", "생선도 고기도\n연기 걱정 없이 마음껏 굽는\n우리 집 마당 바베큐."),
]

# House plan specs (from HousePlan.tsx)
HOUSE_PLAN_SPECS = {
    "main": [
        {"label": "층별 면적(1층)", "value": "33.38㎡"},
        {"label": "층별 면적(2층)", "value": "32.95㎡"},
        {"label": "층별 면적(3층)", "value": "18.6㎡"},
        {"label": "건폐율", "value": "19.46%"},
        {"label": "용적률", "value": "36.14%"},
    ],
    "collapsed": [
        {"label": "주구조", "value": "일반목구조"},
        {"label": "주차", "value": "옥외 / 2대 가능"},
        {"label": "난방 타입", "value": "LPG"},
        {"label": "상수", "value": "상수도"},
        {"label": "하수", "value": "하수도 직관 (정화조 없음)"},
        {"label": "월 평균 전기료", "value": "37,240원"},
        {"label": "월 평균 가스비", "value": "53,880원"},
        {"label": "지붕", "value": "경사지붕/징크마감"},
        {"label": "외벽", "value": "파벽돌+스타코"},
        {"label": "마당", "value": "(앞) 조경+석재, (뒤) 잔디"},
        {"label": "펜스", "value": "있음, 일부 미송"},
    ],
}

# Nearby places — left empty so admin fills in per-property accurate data.
NEARBY_PLACES: list = []

# Evaluation metrics — left empty so admin fills in per-property accurate data.
EVAL_METRICS: list = []

# Property 4 core fields
TITLE = "아이와 자라는 집"
SUBTITLE = "숲 유치원이 로망이라면"
LOCATION = "경기도 용인시"
PRICE = 650000000
TAGS = ["강남으로 출근", "새벽배송", "잔디마당", "유치원", "전용주차장"]
SPECS = {
    "beds": 5,
    "baths": 2,
    "land_area": "235m² (71평)",
    "built_year": "2020년",
    "indoor_area": "84.93m² (25.7평)",
    "scale": "지상 3층",
}
LIFESTYLE_STORY = """아침 햇살이 부드럽게 스며들고, 아이는 유리 너머로 보이는 마당으로 먼저 달려 나갑니다. 강남으로 출퇴근이 가능한 거리이지만, 집 앞에서는 도시의 속도 대신 숲의 리듬이 하루를 시작하게 합니다. 아이는 도보로 이동 가능한 숲유치원에 다니고, 부모는 출근 전 짧은 산책으로 하루의 긴장을 풀 수 있는 입지입니다.

집은 지은 지 얼마 되지 않아 구조와 설비가 모두 깔끔하게 유지되어 있으며, 관리 부담은 최소화되어 있습니다. 마당은 넓기보다는 잘 설계되어 있어 잔디 관리나 조경에 과도한 시간이 들지 않으면서도, 아이가 마음껏 뛰어놀기에는 충분한 크기입니다. 여름 아침에는 마당 한쪽에 심어둔 바질을 아이와 함께 따서 간단한 아침 식사를 준비하고, 그 과정 자체가 일상의 추억이 됩니다.

퇴근 후에는 마당에 놓인 작은 테이블에 앉아 맥주 한 잔으로 하루를 정리합니다. 집 안에는 재택근무와 집중을 위한 별도의 오피스 공간이 마련되어 있어, 일과 생활의 경계가 흐려지지 않습니다. 이 집은 '더 많은 관리'를 요구하지 않으면서도, 가족이 충분히 즐기고 머무를 수 있는 시간을 돌려주는 공간입니다."""
LIFESTYLE_HIGHLIGHTS = [
    "숲유치원 도보 통학이 가능한 자연 친화적 입지",
    "프라이빗 허브 & 텃밭 가든",
    "퇴근 후 마당에서 즐기는 맥주 한 잔의 여유",
    "재택근무를 위한 독립된 오피스 공간",
]
OPEN_HOUSE_EVENTS = [
    {"date": "2026-05-23", "time": "오전 11:00 - 오후 2:00", "available_spots": 6},
]
LOAN_INFO = {
    "estimated_monthly_payment": 3000000,
    "max_loan_amount": 576000000,
    "interest_rate": 4.25,
    "loan_term": 30,
}


# ----------------------------------------------------------------- helpers


def _mime_for(suffix: str) -> str:
    s = suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
    }.get(s, "application/octet-stream")


def copy_image(src: Path, property_id: uuid.UUID) -> tuple[uuid.UUID, str, int, str]:
    """Copy ``src`` into storage and return (image_id, storage_key, byte_size, mime)."""
    if not src.exists():
        raise FileNotFoundError(f"asset missing: {src}")
    image_id = uuid.uuid4()
    mime = _mime_for(src.suffix)
    key = storage_service.storage_key_for_asset(
        property_id, image_id, filename=src.name, mime_type=mime
    )
    storage_service.copy_local_file(src, key)
    return image_id, key, src.stat().st_size, mime


# ----------------------------------------------------------------- main


async def amain() -> None:
    async with SessionFactory() as db:
        existing = await db.get(Property, SEED_PROPERTY_ID)
        if existing is not None:
            print(
                f"Property {SEED_PROPERTY_ID} already exists "
                f"(title={existing.title!r}). Nothing to do."
            )
            return

        # 1. Insert the property row first (no image FKs yet) so the FK target exists.
        prop = Property(
            id=SEED_PROPERTY_ID,
            slug="property-4",
            status=PropertyStatus.draft,
            title=TITLE,
            subtitle=SUBTITLE,
            location=LOCATION,
            price=PRICE,
            display_order=0,
            tags=TAGS,
            lifestyle_story=LIFESTYLE_STORY,
            lifestyle_highlights=LIFESTYLE_HIGHLIGHTS,
            specs=SPECS,
            loan_info=LOAN_INFO,
            house_plan_specs=HOUSE_PLAN_SPECS,
            nearby_places=NEARBY_PLACES,
            evaluation_metrics=EVAL_METRICS,
            interior_photos=[],
            floorplans={},
            lifestyle_scenarios=[],
        )
        db.add(prop)
        await db.flush()

        # 1b. Open house events live in a dedicated table now (since 0004).
        for event in OPEN_HOUSE_EVENTS:
            db.add(
                OpenHouseEvent(
                    property_id=SEED_PROPERTY_ID,
                    date=Date.fromisoformat(event["date"]),
                    time=event["time"],
                    capacity=int(event.get("available_spots", 0)),
                    status=OpenHouseEventStatus.scheduled,
                )
            )

        # 2. Add ALL images first (no FK assignments on `prop` yet).
        #    The 2 direct FK columns (hero/portfolio_thumb) require the referenced
        #    row to exist before the UPDATE; we batch-add then flush once below
        #    before assigning FKs.

        # Hero
        hero_id, hero_key, hero_size, hero_mime = copy_image(HERO_FILE, SEED_PROPERTY_ID)
        db.add(
            PropertyImage(
                id=hero_id,
                property_id=SEED_PROPERTY_ID,
                storage_key=hero_key,
                original_filename=HERO_FILE.name,
                mime_type=hero_mime,
                byte_size=hero_size,
                uploaded_at=utcnow(),
            )
        )

        # Portfolio thumb (best-effort: skip if missing)
        thumb_id: uuid.UUID | None = None
        if PORTFOLIO_THUMB_FILE.exists():
            thumb_id, tkey, tsize, tmime = copy_image(
                PORTFOLIO_THUMB_FILE, SEED_PROPERTY_ID
            )
            db.add(
                PropertyImage(
                    id=thumb_id,
                    property_id=SEED_PROPERTY_ID,
                    storage_key=tkey,
                    original_filename=PORTFOLIO_THUMB_FILE.name,
                    mime_type=tmime,
                    byte_size=tsize,
                    uploaded_at=utcnow(),
                )
            )

        # Floorplans (JSONB, no DB-level FK)
        floorplans: dict[str, dict] = {}
        for floor, fp_path in FLOORPLAN_FILES.items():
            fid, fkey, fsize, fmime = copy_image(fp_path, SEED_PROPERTY_ID)
            db.add(
                PropertyImage(
                    id=fid,
                    property_id=SEED_PROPERTY_ID,
                    storage_key=fkey,
                    original_filename=fp_path.name,
                    mime_type=fmime,
                    byte_size=fsize,
                    uploaded_at=utcnow(),
                )
            )
            floorplans[str(floor)] = {
                "image_id": str(fid),
                "label": f"평면도 · {floor}층",
            }

        # Interior photos (JSONB, no DB-level FK)
        interior_photos: list[dict] = []
        for filename, caption, room, portrait, floor, rect in INTERIOR_PHOTOS:
            src = ASSETS / filename
            iid, ikey, isize, imime = copy_image(src, SEED_PROPERTY_ID)
            db.add(
                PropertyImage(
                    id=iid,
                    property_id=SEED_PROPERTY_ID,
                    storage_key=ikey,
                    original_filename=src.name,
                    mime_type=imime,
                    byte_size=isize,
                    caption=caption,
                    uploaded_at=utcnow(),
                )
            )
            interior_photos.append(
                {
                    "image_id": str(iid),
                    "caption": caption,
                    "room": room,
                    "portrait": portrait,
                    "floor": floor,
                    "floorplan_rect": rect,
                }
            )

        # Lifestyle scenarios (JSONB, no DB-level FK)
        scenarios: list[dict] = []
        for filename, description in LIFESTYLE_SCENARIOS:
            src = ASSETS / filename
            sid, skey, ssize, smime = copy_image(src, SEED_PROPERTY_ID)
            db.add(
                PropertyImage(
                    id=sid,
                    property_id=SEED_PROPERTY_ID,
                    storage_key=skey,
                    original_filename=src.name,
                    mime_type=smime,
                    byte_size=ssize,
                    caption=description,
                    uploaded_at=utcnow(),
                )
            )
            scenarios.append({"image_id": str(sid), "description": description})

        # 3. Flush all images/files so the FK targets exist.
        await db.flush()

        # 4. Now safely assign the 2 FK columns + JSONB fields.
        prop.hero_image_id = hero_id
        if thumb_id is not None:
            prop.portfolio_thumb_id = thumb_id
        prop.floorplans = floorplans
        prop.interior_photos = interior_photos
        prop.lifestyle_scenarios = scenarios

        await db.commit()
        print(f"✓ Seeded property {SEED_PROPERTY_ID} ({TITLE})")
        print(f"  status: {prop.status.value}")
        print(f"  images: {len(interior_photos) + len(scenarios) + len(floorplans) + 2}")
        print(f"  Open the admin UI to review and Publish.")


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
