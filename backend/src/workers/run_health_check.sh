#!/bin/bash
# FlickTV Stream Health Checker Runner
# Runs the health check and sends report to admin

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
DATA_DIR="$PROJECT_DIR/data"
VENV_PYTHON="$HOME/.hermes/profiles/flicktek-automation/home/Library/Python/3.9/bin/python3"

# Fallback to system python if venv python doesn't exist
if [ ! -f "$VENV_PYTHON" ]; then
    VENV_PYTHON="$(which python3)"
fi

export FLICKTV_DB_PATH="$DATA_DIR/flicktv.db"

mkdir -p "$LOG_DIR" "$DATA_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting FlickTV stream health check..."

# Run the health checker
"$VENV_PYTHON" "$SCRIPT_DIR/health_checker.py" 2>&1 | tee -a "$LOG_DIR/health_checker.log"

EXIT_CODE=${PIPESTATUS[0]}

if [ $EXIT_CODE -ne 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health check failed with exit code $EXIT_CODE" | tee -a "$LOG_DIR/health_checker.log"
    exit $EXIT_CODE
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health check complete."

# Print the latest report
if [ -f "$LOG_DIR/latest_report.txt" ]; then
    echo ""
    echo "=== REPORT ==="
    cat "$LOG_DIR/latest_report.txt"
fi
