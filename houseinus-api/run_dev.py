"""Development server entrypoint.

Run with: `uv run python run_dev.py`
"""
from __future__ import annotations

import uvicorn

from app.config import settings


def main() -> None:
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        reload_dirs=["app"],
    )


if __name__ == "__main__":
    main()
