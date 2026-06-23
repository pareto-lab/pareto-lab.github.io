from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.og import router as og_router
from app.api.sitemap import router as sitemap_router
from app.api.v1.router import api_router
from app.config import PROJECT_ROOT, settings
from app.core.errors import install_error_handlers
from app.core.redis_client import close_redis, get_redis
from app.database import engine
from app.services import codex_bridge_service

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up Redis connection; fail fast if unreachable.
    redis = get_redis()
    try:
        await redis.ping()
    except Exception as exc:  # noqa: BLE001
        log.warning("Redis ping failed at startup: %s", exc)
    yield
    await codex_bridge_service.stop_all_sessions()
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

install_error_handlers(app)
app.include_router(og_router)
app.include_router(sitemap_router)
app.include_router(api_router, prefix="/api/v1")

# Serve uploaded property images/files. nginx (prod) / vite (dev) proxy
# `/uploads/*` to this app, which then reads straight from the filesystem.
_uploads_dir = settings.storage.resolve_base_path(PROJECT_ROOT)
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount(
    settings.storage.public_url_prefix,
    StaticFiles(directory=str(_uploads_dir)),
    name="uploads",
)


@app.get("/api/v1/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}
