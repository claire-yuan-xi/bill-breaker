"""One SQLite file holds the analysis cache, shared pages, rate limits and sync copies."""

import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS bill_analyses (
  state TEXT NOT NULL,
  bill_no TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  title TEXT,
  source_url TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (state, bill_no, text_hash)
);
CREATE TABLE IF NOT EXISTS shared_analyses (
  slug TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  bill_no TEXT NOT NULL,
  title TEXT,
  source_url TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  identifier TEXT PRIMARY KEY,
  window_start REAL NOT NULL,
  count INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS abuse_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  identifier TEXT NOT NULL,
  endpoint TEXT,
  reason TEXT NOT NULL,
  count INTEGER NOT NULL,
  limit_value INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL,
  meta TEXT
);
CREATE TABLE IF NOT EXISTS device_watchlist (
  device_id TEXT NOT NULL,
  state TEXT NOT NULL,
  bill_no TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL,
  PRIMARY KEY (device_id, state, bill_no)
);
"""

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None
_path: Path | None = None


def _connect(path: Path) -> sqlite3.Connection:
    if str(path) != ":memory:":
        path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)
    return conn


def use_database(path: Path | str) -> None:
    """Points the app at another database file (tests use ':memory:')."""
    global _conn, _path
    with _lock:
        if _conn is not None:
            _conn.close()
        _path = Path(path)
        _conn = _connect(_path)


@contextmanager
def connection():
    global _conn
    with _lock:
        if _conn is None:
            _conn = _connect(_path or settings.database_path)
        yield _conn
