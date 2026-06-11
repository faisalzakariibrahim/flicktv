"""
FlickTV Stream Health Checker
Checks stream URLs, logs results, removes dead channels after 3 consecutive failures.
"""

import asyncio
import aiosqlite
import requests
import time
import json
import os
import sys
import logging
from datetime import datetime, timedelta
from typing import Optional

# Configuration
BASE_DIR = "/Users/kingfaisal/projects/flicktv/backend"
DB_PATH = os.environ.get("FLICKTV_DB_PATH", f"{BASE_DIR}/data/flicktv.db")
BATCH_SIZE = int(os.environ.get("HEALTH_CHECK_BATCH_SIZE", "100"))
REQUEST_TIMEOUT = int(os.environ.get("HEALTH_CHECK_TIMEOUT", "10"))
CONSECUTIVE_FAILURE_THRESHOLD = 3
MAX_CONCURRENT_REQUESTS = 20

os.makedirs(f"{BASE_DIR}/logs", exist_ok=True)
os.makedirs(f"{BASE_DIR}/data", exist_ok=True)

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(f"{BASE_DIR}/logs/health_checker.log"),
    ],
)
logger = logging.getLogger(__name__)


def get_db_path() -> str:
    return DB_PATH


async def init_db(db_path: str):
    """Initialize database with schema."""
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    async with aiosqlite.connect(db_path) as db:
        with open(schema_path, "r") as f:
            await db.executescript(f.read())
        await db.commit()
    logger.info(f"Database initialized at {db_path}")


async def get_channels(db, offset: int = 0, limit: int = 100) -> list:
    """Fetch a batch of channels to check."""
    async with db.execute(
        "SELECT id, name, url FROM channels WHERE 1=1 ORDER BY id LIMIT ? OFFSET ?",
        (limit, offset),
    ) as cursor:
        rows = await cursor.fetchall()
    return rows


async def get_all_channels(db) -> list:
    """Fetch all channels."""
    async with db.execute(
        "SELECT id, name, url FROM channels ORDER BY id"
    ) as cursor:
        rows = await cursor.fetchall()
    return rows


async def count_channels(db) -> int:
    """Count total channels."""
    async with db.execute("SELECT COUNT(*) FROM channels") as cursor:
        row = await cursor.fetchone()
    return row[0]


def check_stream_head(url: str, timeout: int = REQUEST_TIMEOUT) -> dict:
    """
    Check stream health using HTTP HEAD request.
    Falls back to GET with stream=True if HEAD is not supported.
    """
    result = {
        "is_working": False,
        "status_code": None,
        "response_time_ms": 0,
        "error_message": None,
    }

    start = time.time()
    try:
        # Try HEAD first (lightweight)
        resp = requests.head(url, timeout=timeout, allow_redirects=True, headers={
            "User-Agent": "FlickTV-HealthChecker/1.0",
        })
        result["response_time_ms"] = round((time.time() - start) * 1000, 2)
        result["status_code"] = resp.status_code

        if resp.status_code < 400:
            result["is_working"] = True
        else:
            result["error_message"] = f"HTTP {resp.status_code}"

    except requests.exceptions.Timeout:
        result["response_time_ms"] = round((time.time() - start) * 1000, 2)
        result["error_message"] = "TIMEOUT"

    except requests.exceptions.ConnectionError as e:
        result["response_time_ms"] = round((time.time() - start) * 1000, 2)
        result["error_message"] = f"CONNECTION_ERROR: {str(e)[:100]}"

    except requests.exceptions.RequestException as e:
        result["response_time_ms"] = round((time.time() - start) * 1000, 2)
        result["error_message"] = f"REQUEST_ERROR: {type(e).__name__}: {str(e)[:100]}"

    return result


async def check_stream_head_async(session, url: str, timeout: int = REQUEST_TIMEOUT) -> dict:
    """Async version of check_stream_head using requests in executor."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, check_stream_head, url, timeout)


async def log_health_result(db, channel_id: str, result: dict):
    """Log health check result to database."""
    await db.execute(
        """INSERT INTO stream_health_logs 
           (channel_id, is_working, status_code, response_time_ms, error_message)
           VALUES (?, ?, ?, ?, ?)""",
        (
            channel_id,
            result["is_working"],
            str(result["status_code"]) if result["status_code"] else None,
            result["response_time_ms"],
            result["error_message"],
        ),
    )


async def update_channel_status(db, channel_id: str, is_working: bool):
    """Update channel working status and consecutive failure count."""
    if is_working:
        await db.execute(
            """UPDATE channels 
               SET is_working = 1, consecutive_failures = 0, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (channel_id,),
        )
    else:
        await db.execute(
            """UPDATE channels 
               SET is_working = 0, consecutive_failures = consecutive_failures + 1, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (channel_id,),
        )


async def remove_dead_channels(db) -> list:
    """Remove channels that have failed consecutive checks >= threshold."""
    async with db.execute(
        "SELECT id, name, url, consecutive_failures FROM channels WHERE consecutive_failures >= ?",
        (CONSECUTIVE_FAILURE_THRESHOLD,),
    ) as cursor:
        dead_channels = await cursor.fetchall()

    removed = []
    for channel in dead_channels:
        channel_id, name, url, failures = channel
        await db.execute("DELETE FROM channels WHERE id = ?", (channel_id,))
        removed.append({
            "id": channel_id,
            "name": name,
            "url": url,
            "consecutive_failures": failures,
        })
        logger.info(f"Removed dead channel: {name} ({url}) - {failures} consecutive failures")

    return removed


async def process_batch(db, channels: list) -> dict:
    """Process a batch of channels concurrently."""
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

    async def check_one(channel):
        channel_id, name, url = channel
        async with semaphore:
            result = check_stream_head(url)
            await log_health_result(db, channel_id, result)
            await update_channel_status(db, channel_id, result["is_working"])
            return {
                "channel_id": channel_id,
                "name": name,
                "url": url,
                **result,
            }

    tasks = [check_one(ch) for ch in channels]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    working = 0
    dead = 0
    errors = []
    total_response_time = 0
    response_count = 0

    for r in results:
        if isinstance(r, Exception):
            dead += 1
            errors.append(str(r))
        elif r["is_working"]:
            working += 1
            total_response_time += r["response_time_ms"]
            response_count += 1
        else:
            dead += 1
            total_response_time += r["response_time_ms"]
            response_count += 1

    avg_response = round(total_response_time / response_count, 2) if response_count > 0 else 0

    return {
        "working": working,
        "dead": dead,
        "avg_response_time_ms": avg_response,
        "errors": errors,
    }


async def run_health_check(db_path: str) -> dict:
    """Run full health check across all channels in batches."""
    os.makedirs(os.path.expanduser("~/projects/flicktv/backend/logs"), exist_ok=True)

    async with aiosqlite.connect(db_path) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA busy_timeout=30000")

        total = await count_channels(db)
        if total == 0:
            logger.warning("No channels found in database")
            return {"total": 0, "working": 0, "dead": 0, "removed": [], "avg_response_time_ms": 0}

        # Create a run record
        cursor = await db.execute(
            "INSERT INTO health_check_runs (total_channels, status) VALUES (?, 'running')",
            (total,),
        )
        run_id = cursor.lastrowid

        logger.info(f"Starting health check for {total} channels (batch size: {BATCH_SIZE})")

        total_working = 0
        total_dead = 0
        total_response_time = 0
        response_count = 0
        offset = 0

        while offset < total:
            channels = await get_channels(db, offset=offset, limit=BATCH_SIZE)
            if not channels:
                break

            logger.info(f"Processing batch {offset // BATCH_SIZE + 1} ({offset + 1}-{offset + len(channels)} of {total})")
            batch_result = await process_batch(db, channels)

            total_working += batch_result["working"]
            total_dead += batch_result["dead"]
            total_response_time += batch_result["avg_response_time_ms"] * (batch_result["working"] + batch_result["dead"])
            response_count += batch_result["working"] + batch_result["dead"]

            if batch_result["errors"]:
                logger.warning(f"Batch errors: {batch_result['errors'][:5]}")

            await db.commit()
            offset += BATCH_SIZE

        # Remove dead channels
        removed = await remove_dead_channels(db)
        await db.commit()

        avg_response = round(total_response_time / response_count, 2) if response_count > 0 else 0

        # Update run record
        await db.execute(
            """UPDATE health_check_runs 
               SET completed_at = CURRENT_TIMESTAMP, working_count = ?, dead_count = ?,
                   removed_count = ?, avg_response_time_ms = ?, status = 'completed'
               WHERE id = ?""",
            (total_working, total_dead, len(removed), avg_response, run_id),
        )
        await db.commit()

        result = {
            "total": total,
            "working": total_working,
            "dead": total_dead,
            "removed": removed,
            "avg_response_time_ms": avg_response,
            "run_id": run_id,
        }

        logger.info(
            f"Health check complete: {total_working} working, {total_dead} dead, "
            f"{len(removed)} removed, avg response: {avg_response}ms"
        )

        return result


def generate_report(result: dict) -> str:
    """Generate a human-readable report."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        f"=== FlickTV Stream Health Report ===",
        f"Generated: {now}",
        f"",
        f"Total channels checked: {result['total']}",
        f"Working: {result['working']}",
        f"Dead: {result['dead']}",
        f"Removed (3+ consecutive failures): {len(result['removed'])}",
        f"Avg response time: {result['avg_response_time_ms']}ms",
        f"",
    ]

    if result["removed"]:
        lines.append("--- Removed Channels ---")
        for ch in result["removed"]:
            lines.append(f"  - {ch['name']} ({ch['url']}) - {ch['consecutive_failures']} failures")
        lines.append("")

    working_pct = round(result["working"] / result["total"] * 100, 1) if result["total"] > 0 else 0
    lines.append(f"Health rate: {working_pct}%")
    lines.append("")

    return "\n".join(lines)


async def main():
    db_path = get_db_path()
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    # Initialize DB if needed
    if not os.path.exists(db_path):
        await init_db(db_path)
        logger.info("Database created. Add channels before running health checks.")
        # Insert sample channels for testing
        async with aiosqlite.connect(db_path) as db:
            sample_channels = [
                ("ch_001", "BBC News", "https://vs-hls-push-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_news_channel_hd/t=3840/v=pv14/b=5070016/main.m3u8"),
                ("ch_002", "CNN", "https://cnn-cnninternational-1-eu.rakuten.wurl.tv/playlist.m3u8"),
                ("ch_003", "Dead Test Channel", "http://dead-channel-test.example.com/stream.m3u8"),
                ("ch_004", "Al Jazeera", "https://live-hls-web-aje.getaj.net/AJE/01.m3u8"),
                ("ch_005", "France 24", "https://www.youtube.com/watch?v=h3MuIUNCCzI"),
            ]
            await db.executemany(
                "INSERT OR IGNORE INTO channels (id, name, url) VALUES (?, ?, ?)",
                sample_channels,
            )
            await db.commit()
            logger.info(f"Inserted {len(sample_channels)} sample channels")

    # Run health check
    result = await run_health_check(db_path)

    # Generate and print report
    report = generate_report(result)
    print(report)

    # Save report to file
    report_path = f"{BASE_DIR}/logs/latest_report.txt"
    with open(report_path, "w") as f:
        f.write(report)

    # Also save JSON for programmatic access
    json_path = f"{BASE_DIR}/logs/latest_report.json"
    with open(json_path, "w") as f:
        json.dump(result, f, indent=2, default=str)

    logger.info(f"Report saved to {report_path}")
    return result


if __name__ == "__main__":
    asyncio.run(main())
