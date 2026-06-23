"""Production server entrypoint.

Run with:
    uv run python run_prod.py
    uv run python run_prod.py --port 12345
    uv run python run_prod.py --port 12345 --workers 8

Designed for an early-stage production setup behind a reverse proxy (nginx).
For larger scale, swap to gunicorn + UvicornWorker for better process supervision.
"""
from __future__ import annotations

import argparse

import uvicorn


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run houseinus-api in production mode.")
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Bind host (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=38080,
        help="Bind port (default: 38080)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Number of worker processes (default: 4)",
    )
    parser.add_argument(
        "--log-level",
        default="info",
        choices=["critical", "error", "warning", "info", "debug", "trace"],
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        workers=args.workers,
        log_level=args.log_level,
        access_log=True,
        # Trust X-Forwarded-* from the reverse proxy so request.client.host
        # and scheme detection reflect the real client instead of the proxy.
        proxy_headers=True,
        forwarded_allow_ips="*",
    )


if __name__ == "__main__":
    main()
