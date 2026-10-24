"""SQLite persistence; one local process owns replay. IDs make ingestion idempotent."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from backend.ml import ROOT


def database_path():
    return Path(os.getenv("FORGE_DB", str(ROOT / "artifacts/forge.db")))


@contextmanager
def connect():
    db = sqlite3.connect(database_path(), timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init():
    database_path().parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript(
            """
        CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT UNIQUE NOT NULL, asset_id TEXT NOT NULL, timestamp TEXT NOT NULL, payload TEXT NOT NULL, score REAL NOT NULL);
        CREATE INDEX IF NOT EXISTS asset_history ON events(asset_id,seq DESC);
        CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', evidence TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, action TEXT NOT NULL, actor TEXT NOT NULL, timestamp TEXT NOT NULL);
        """
        )
        # Additive migration preserves existing demo workspaces and decision history.
        additions = {
            "orders": {
                "priority": "TEXT NOT NULL DEFAULT 'normal'",
                "assignee": "TEXT NOT NULL DEFAULT ''",
                "due_date": "TEXT",
                "notes": "TEXT NOT NULL DEFAULT ''",
            },
            "audit": {"note": "TEXT NOT NULL DEFAULT ''"},
        }
        for table, columns in additions.items():
            existing = {
                row["name"] for row in db.execute(f"PRAGMA table_info({table})")
            }
            for column, definition in columns.items():
                if column not in existing:
                    db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
