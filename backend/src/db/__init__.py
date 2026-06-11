"""
FlickTV Backend - Database initialization and connection management.
"""
import os
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "flicktv.db"
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_connection() -> sqlite3.Connection:
    """Get a SQLite connection with WAL mode and foreign keys enabled."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database from schema.sql if tables don't exist."""
    conn = get_connection()
    schema = SCHEMA_PATH.read_text()
    conn.executescript(schema)
    conn.commit()
    conn.close()
    print(f"Database initialized at {DB_PATH}")


def seed_sample_data(count: int = 20):
    """Insert sample channels for testing."""
    import random

    sample_channels = [
        ("BBC News", "http://stream.example.com/bbc-news.m3u8", "news"),
        ("CNN Live", "http://stream.example.com/cnn-live.m3u8", "news"),
        ("ESPN Sports", "http://stream.example.com/espn.m3u8", "sports"),
        ("Discovery Channel", "http://stream.example.com/discovery.m3u8", "documentary"),
        ("HBO Movies", "http://stream.example.com/hbo.m3u8", "movies"),
        ("Nickelodeon", "http://stream.example.com/nick.m3u8", "kids"),
        ("National Geographic", "http://stream.example.com/natgeo.m3u8", "documentary"),
        ("MTV Music", "http://stream.example.com/mtv.m3u8", "music"),
        ("Comedy Central", "http://stream.example.com/comedy.m3u8", "entertainment"),
        ("Food Network", "http://stream.example.com/food.m3u8", "lifestyle"),
        ("History Channel", "http://stream.example.com/history.m3u8", "documentary"),
        ("Cartoon Network", "http://stream.example.com/cn.m3u8", "kids"),
        ("Fox News", "http://stream.example.com/fox.m3u8", "news"),
        ("TNT Sports", "http://stream.example.com/tnt.m3u8", "sports"),
        ("Sky Cinema", "http://stream.example.com/sky.m3u8", "movies"),
        ("Al Jazeera", "http://stream.example.com/aljazeera.m3u8", "news"),
        ("Bloomberg", "http://stream.example.com/bloomberg.m3u8", "news"),
        ("C-SPAN", "http://stream.example.com/cspan.m3u8", "news"),
        ("Weather Channel", "http://stream.example.com/weather.m3u8", "news"),
        ("Animal Planet", "http://stream/example.com/animal.m3u8", "documentary"),
    ]

    conn = get_connection()
    existing = conn.execute("SELECT COUNT(*) FROM channels").fetchone()[0]
    if existing > 0:
        print(f"Database already has {existing} channels, skipping seed.")
        conn.close()
        return

    for name, url, category in sample_channels[:count]:
        conn.execute(
            "INSERT INTO channels (name, stream_url, category) VALUES (?, ?, ?)",
            (name, url, category),
        )
    conn.commit()
    conn.close()
    print(f"Seeded {min(count, len(sample_channels))} sample channels.")


if __name__ == "__main__":
    init_db()
    seed_sample_data()
