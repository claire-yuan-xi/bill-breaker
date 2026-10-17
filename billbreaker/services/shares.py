"""Published, read-only snapshots of an analysis at /b/<slug>."""

import json
import secrets
from datetime import datetime, timezone

from ..db import connection

SLUG_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"
MAX_PAYLOAD_BYTES = 200_000


def random_slug(length: int = 8) -> str:
    return "".join(secrets.choice(SLUG_CHARS) for _ in range(length))


def create(state: str, bill_no: str, title: str | None, source_url: str | None, payload: dict) -> str:
    body = json.dumps(payload)
    if len(body) > MAX_PAYLOAD_BYTES:
        raise ValueError(f"Payload too large (max {MAX_PAYLOAD_BYTES} bytes).")
    now = datetime.now(timezone.utc).isoformat()
    with connection() as db:
        for _ in range(5):
            slug = random_slug()
            exists = db.execute("SELECT 1 FROM shared_analyses WHERE slug = ?", (slug,)).fetchone()
            if exists:
                continue
            db.execute(
                "INSERT INTO shared_analyses (slug, state, bill_no, title, source_url, payload, "
                "created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (slug, state, bill_no, title, source_url, body, now),
            )
            return slug
    raise RuntimeError("Could not generate share link, try again.")


def get(slug: str) -> dict | None:
    with connection() as db:
        row = db.execute("SELECT * FROM shared_analyses WHERE slug = ?", (slug,)).fetchone()
    if not row:
        return None
    out = dict(row)
    out["payload"] = json.loads(out["payload"] or "{}")
    return out
