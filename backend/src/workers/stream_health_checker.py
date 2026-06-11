"""
FlickTV Stream Health Checker Worker

Checks channel stream URLs via HTTP HEAD requests, logs results,
auto-removes dead channels after 3 consecutive failures, and sends
admin reports.
"""
import asyncio
import sqlite3
import time
import json
import smtplib
import logging
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional

import aiohttp

# ─── Configuration ────────────────────────────────────────────────────────────

DB_PATH = Path(__file__).parent.parent / "db" / "flicktv.db"
BATCH_SIZE = 100
REQUEST_TIMEOUT = 10  # seconds
MAX_CONCURRENT = 20
CONSECUTIVE_FAILURE_THRESHOLD = 3

# Admin report settings (override via environment or config)
ADMIN_EMAIL = "admin@flicktek.com"
SMTP_HOST = "localhost"
SMTP_PORT = 587
FROM_EMAIL = "flicktv-health@flicktek.com"

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("/tmp/flicktv_health.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("health_checker")


# ─── Database helpers ────────────────────────────────────────────────────────


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


def get_all_channels(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT id, name, stream_url, is_working, consecutive_failures FROM channels"
    ).fetchall()


def create_health_check_run(conn: sqlite3.Connection, total: int) -> int:
    cur = conn.execute(
        "INSERT INTO health_check_runs (total_channels, status) VALUES (?, 'running')",
        (total,),
    )
    conn.commit()
    return cur.lastrowid or 0


def update_health_check_run(conn: sqlite3.Connection, run_id: int, working: int, dead: int, avg_rt: float):
    conn.execute(
        """UPDATE health_check_runs
           SET working_count=?, dead_count=?, avg_response_time_ms=?,
               completed_at=CURRENT_TIMESTAMP, status='completed'
           WHERE id=?""",
        (working, dead, avg_rt, run_id),
    )
    conn.commit()


def log_health_result(
    conn: sqlite3.Connection,
    channel_id: int,
    is_working: bool,
    response_time_ms: int,
    http_status: Optional[int],
    error_msg: Optional[str],
):
    conn.execute(
        "INSERT INTO stream_health_logs (channel_id, is_working, response_time_ms, http_status_code, error_message) VALUES (?, ?, ?, ?, ?)",
        (channel_id, is_working, response_time_ms, http_status, error_msg),
    )


def update_channel_status(
    conn: sqlite3.Connection,
    channel_id: int,
    is_working: bool,
):
    if is_working:
        conn.execute(
            "UPDATE channels SET is_working=1, consecutive_failures=0, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (channel_id,),
        )
    else:
        conn.execute(
            "UPDATE channels SET is_working=0, consecutive_failures = consecutive_failures + 1, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (channel_id,),
        )


def remove_dead_channels(conn: sqlite3.Connection) -> list[dict]:
    """Remove channels that failed CONSECUTIVE_FAILURE_THRESHOLD times."""
    dead = conn.execute(
        "SELECT id, name, stream_url, consecutive_failures FROM channels WHERE consecutive_failures >= ?",
        (CONSECUTIVE_FAILURE_THRESHOLD,),
    ).fetchall()
    removed = [dict(row) for row in dead]
    conn.execute("DELETE FROM channels WHERE consecutive_failures >= ?", (CONSECUTIVE_FAILURE_THRESHOLD,))
    conn.commit()
    return removed


def get_stats(conn: sqlite3.Connection) -> dict:
    row = conn.execute(
        "SELECT COUNT(*) as total, SUM(is_working) as working, SUM(CASE WHEN is_working=0 THEN 1 ELSE 0 END) as dead FROM channels"
    ).fetchone()
    return {"total": row["total"], "working": row["working"] or 0, "dead": row["dead"]}


# ─── Health Check Logic ──────────────────────────────────────────────────────


async def check_stream(
    session: aiohttp.ClientSession,
    channel_id: int,
    name: str,
    url: str,
) -> dict:
    """Check a single stream URL via HEAD request."""
    start = time.monotonic()
    result = {
        "channel_id": channel_id,
        "name": name,
        "url": url,
        "is_working": False,
        "response_time_ms": 0,
        "http_status": None,
        "error": None,
    }
    try:
        async with session.head(url, timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT), allow_redirects=True, ssl=False) as resp:
            elapsed = int((time.monotonic() - start) * 1000)
            result["response_time_ms"] = elapsed
            result["http_status"] = resp.status
            # 2xx and 3xx are considered working; 4xx/5xx mean the stream is down
            if resp.status < 400:
                result["is_working"] = True
            else:
                result["error"] = f"HTTP {resp.status}"
    except asyncio.TimeoutError:
        result["error"] = "Timeout"
        result["response_time_ms"] = int((time.monotonic() - start) * 1000)
    except aiohttp.ClientError as e:
        result["error"] = str(e)
        result["response_time_ms"] = int((time.monotonic() - start) * 1000)
    except Exception as e:
        result["error"] = f"Unexpected: {e}"
        result["response_time_ms"] = int((time.monotonic() - start) * 1000)

    return result


async def check_batch(
    session: aiohttp.ClientSession,
    batch: list[sqlite3.Row],
) -> list[dict]:
    """Check a batch of channels concurrently."""
    tasks = [check_stream(session, row["id"], row["name"], row["stream_url"]) for row in batch]
    return await asyncio.gather(*tasks, return_exceptions=False)


# ─── Report Generation ──────────────────────────────────────────────────────


def generate_report(
    stats: dict,
    removed: list[dict],
    run_id: int,
    avg_response_time: float,
    duration_seconds: float,
) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        f"═══ FlickTV Stream Health Report ═══",
        f"Date: {now}",
        f"Run ID: {run_id}",
        f"Duration: {duration_seconds:.1f}s",
        f"",
        f"─── Channel Stats ───",
        f"  Total channels:    {stats['total']}",
        f"  Working:           {stats['working']}",
        f"  Dead:              {stats['dead']}",
        f"  Avg response time: {avg_response_time:.0f}ms",
        f"",
    ]
    if removed:
        lines.append(f"─── Removed Channels ({len(removed)}) ───")
        for ch in removed:
            lines.append(f"  ✗ {ch['name']} ({ch['stream_url']}) — failed {ch['consecutive_failures']} consecutive checks")
    else:
        lines.append("─── No channels removed ───")

    lines.append("")
    lines.append("═══ End Report ═══")
    return "\n".join(lines)


def send_report(report: str, stats: dict):
    """Print report to stdout and optionally email it."""
    print(report)
    logger.info("Health check report generated successfully.")

    # Optional email (disabled by default)
    send_email = False  # Set to True and configure SMTP to enable
    if send_email and stats["dead"] > 0:
        try:
            msg = MIMEText(report)
            msg["Subject"] = f"FlickTV Health Report — {stats['dead']} dead channel(s)"
            msg["From"] = FROM_EMAIL
            msg["To"] = ADMIN_EMAIL
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
                s.send_message(msg)
            logger.info(f"Report emailed to {ADMIN_EMAIL}")
        except Exception as e:
            logger.error(f"Failed to send email report: {e}")


# ─── Main Entry Point ───────────────────────────────────────────────────────


async def run_health_check():
    """Run the full health check cycle."""
    conn = get_conn()
    channels = get_all_channels(conn)

    if not channels:
        logger.warning("No channels found in database. Exiting.")
        conn.close()
        return

    total = len(channels)
    logger.info(f"Starting health check for {total} channels (batch size={BATCH_SIZE})")

    run_id = create_health_check_run(conn, total)
    conn.close()

    all_results: list[dict] = []
    start_time = time.monotonic()

    # Process in batches
    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT, ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        for i in range(0, len(channels), BATCH_SIZE):
            batch = channels[i : i + BATCH_SIZE]
            batch_num = (i // BATCH_SIZE) + 1
            total_batches = (len(channels) + BATCH_SIZE - 1) // BATCH_SIZE
            logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} channels)")

            results = await check_batch(session, batch)
            all_results.extend(results)

            # Write results to DB
            conn = get_conn()
            for r in results:
                log_health_result(
                    conn,
                    r["channel_id"],
                    r["is_working"],
                    r["response_time_ms"],
                    r["http_status"],
                    r["error"],
                )
                update_channel_status(conn, r["channel_id"], r["is_working"])
            conn.commit()
            conn.close()

            # Small delay between batches to avoid overwhelming servers
            if i + BATCH_SIZE < len(channels):
                await asyncio.sleep(1)

    duration = time.monotonic() - start_time

    # Remove dead channels
    conn = get_conn()
    removed = remove_dead_channels(conn)

    # Compute stats
    working = sum(1 for r in all_results if r["is_working"])
    dead = sum(1 for r in all_results if not r["is_working"])
    valid_rts = [r["response_time_ms"] for r in all_results if r["is_working"] and r["response_time_ms"] > 0]
    avg_rt = sum(valid_rts) / len(valid_rts) if valid_rts else 0.0

    stats = get_stats(conn)
    update_health_check_run(conn, run_id, working, dead, avg_rt)
    conn.close()

    # Generate & send report
    report = generate_report(stats, removed, run_id, avg_rt, duration)
    send_report(report, stats)

    logger.info(
        f"Health check complete: {working} working, {dead} dead, "
        f"{len(removed)} removed, {duration:.1f}s"
    )


def main():
    asyncio.run(run_health_check())


if __name__ == "__main__":
    main()
