"""
Fixed-window rate limits stored in SQLite. Fails closed: if the store errors,
the caller is blocked, so an outage cannot be used to bypass throttling.
"""

import logging
import time
from dataclasses import dataclass

from starlette.requests import Request

from ..db import connection
from . import abuse

log = logging.getLogger(__name__)


@dataclass
class RateLimit:
    allowed: bool
    retry_after: int
    count: int


def _bump(identifier: str, limit: int, window_s: int) -> RateLimit:
    now = time.time()
    with connection() as db:
        row = db.execute(
            "SELECT window_start, count FROM rate_limits WHERE identifier = ?", (identifier,)
        ).fetchone()
        if row is None or now - row["window_start"] >= window_s:
            start, count = now, 1
        else:
            start, count = row["window_start"], row["count"] + 1
        db.execute(
            "INSERT INTO rate_limits (identifier, window_start, count) VALUES (?, ?, ?) "
            "ON CONFLICT(identifier) DO UPDATE SET window_start = excluded.window_start, "
            "count = excluded.count",
            (identifier, start, count),
        )
    retry = max(1, int(start + window_s - now + 0.999))
    return RateLimit(allowed=count <= limit, retry_after=retry, count=count)


def count_only(identifier: str, window_s: int) -> int:
    """Counts hits in a window without ever blocking (used by the alert threshold)."""
    return _bump(identifier, 1_000_000_000, window_s).count


async def bump(identifier: str, limit: int, window_s: int, endpoint: str | None = None) -> RateLimit:
    event = abuse.Event(identifier, limit, window_s, 0, "exception", endpoint)
    try:
        result = _bump(identifier, limit, window_s)
    except Exception as exc:  # noqa: BLE001 - any store failure must block, not crash
        log.error("rate limit store error: %s", exc)
        abuse.record(event)
        await abuse.maybe_alert(event)
        return RateLimit(allowed=False, retry_after=60, count=0)
    event.count = result.count
    if not result.allowed:
        event.reason = "limit_exceeded"
        abuse.record(event)
        await abuse.maybe_alert(event)
    elif result.count >= int(limit * 0.8):
        event.reason = "near_limit"
        abuse.record(event)
    return result


def client_ip(request: Request) -> str:
    """The caller's address as the hosting proxy saw it.

    Render's proxy appends the real client to X-Forwarded-For, so the last entry is
    trusted and earlier ones (which a client can send itself) are ignored.
    """
    hops = [h.strip() for h in (request.headers.get("x-forwarded-for") or "").split(",") if h.strip()]
    candidate = hops[-1] if hops else (request.client.host if request.client else "")
    return candidate if candidate and len(candidate) < 64 else "unknown"
