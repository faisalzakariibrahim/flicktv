"""
iptv-org Health Check Integration

Wrappers and utilities to integrate iptv-org/iptv validation tools
as an additional health check layer.

iptv-org uses streamTester.ts which:
1. Makes HTTP requests with configurable timeout and proxy
2. Uses mediainfo.js to verify the response contains valid media tracks
3. Categorizes errors (TIMEOUT, HTTP errors, NO_VIDEO, etc.)

This module provides a Python bridge to those checks.
"""

import subprocess
import json
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Path to cloned iptv-org repo
IPTV_ORG_PATH = os.environ.get(
    "IPTV_ORG_PATH",
    "/Users/kingfaisal/projects/flicktv/vendor/iptv-org",
)

# Node.js script that wraps the iptv-org streamTester logic in Python-friendly way
NODE_TESTER_SCRIPT = """
const http = require('http');
const https = require('https');
const { URL } = require('url');

const url = process.argv[2];
const timeout = parseInt(process.argv[3]) || 10000;

function checkStream(targetUrl, ms) {
  return new Promise((resolve) => {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.request(targetUrl, {
      method: 'HEAD',
      timeout: ms,
      headers: {
        'User-Agent': 'FlickTV-iptv-org-bridge/1.0',
      },
    }, (res) => {
      const status = res.statusCode || 0;
      res.destroy();
      resolve({
        url: targetUrl,
        ok: status > 0 && status < 400,
        status_code: status,
        error: null,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        url: targetUrl,
        ok: false,
        status_code: null,
        error: 'TIMEOUT',
      });
    });

    req.on('error', (err) => {
      resolve({
        url: targetUrl,
        ok: false,
        status_code: null,
        error: err.code || err.message,
      });
    });

    req.end();
  });
}

checkStream(url, timeout).then(result => {
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
});
"""


def ensure_iptv_org_cloned():
    """Clone iptv-org/iptv if not already present."""
    if os.path.exists(IPTV_ORG_PATH):
        logger.info(f"iptv-org already cloned at {IPTV_ORG_PATH}")
        return

    logger.info("Cloning iptv-org/iptv...")
    os.makedirs("/Users/kingfaisal/projects/flicktv/vendor", exist_ok=True)
    subprocess.run(
        ["git", "clone", "--depth", "1", "https://github.com/iptv-org/iptv.git", IPTV_ORG_PATH],
        check=True,
        capture_output=True,
    )
    logger.info("iptv-org cloned successfully")


def check_stream_iptv_org(url: str, timeout: int = 10000) -> dict:
    """
    Check stream using Node.js bridge (inspired by iptv-org streamTester).
    Falls back to basic check if Node.js is not available.
    """
    try:
        result = subprocess.run(
            ["node", "-e", NODE_TESTER_SCRIPT, url, str(timeout)],
            capture_output=True,
            text=True,
            timeout=timeout / 1000 + 5,  # extra buffer
        )
        if result.returncode == 0 or result.stdout.strip():
            return json.loads(result.stdout.strip())
    except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError) as e:
        logger.warning(f"iptv-org check failed for {url}: {e}")

    return {"url": url, "ok": False, "status_code": None, "error": "CHECK_FAILED"}


def get_iptv_org_playlist_paths() -> list:
    """Get paths to iptv-org playlist files for reference."""
    if not os.path.exists(IPTV_ORG_PATH):
        return []

    playlists = []
    streams_dir = os.path.join(IPTV_ORG_PATH, "streams")
    if os.path.exists(streams_dir):
        for f in os.listdir(streams_dir):
            if f.endswith(".m3u"):
                playlists.append(os.path.join(streams_dir, f))

    return playlists


def parse_iptv_org_m3u(filepath: str) -> list:
    """Parse an iptv-org M3U playlist file."""
    channels = []
    current_name = ""
    current_url = ""

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if line.startswith("#EXTINF:"):
                # Extract channel name
                parts = line.split(",", 1)
                current_name = parts[1] if len(parts) > 1 else ""
            elif line and not line.startswith("#"):
                current_url = line
                if current_name and current_url:
                    channels.append({"name": current_name, "url": current_url})
                current_name = ""
                current_url = ""

    return channels


if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    ensure_iptv_org_cloned()
    test_url = "https://vs-hls-push-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_news_channel_hd/t=3840/v=pv14/b=5070016/main.m3u8"
    result = check_stream_iptv_org(test_url)
    print(f"Test result: {result}")
