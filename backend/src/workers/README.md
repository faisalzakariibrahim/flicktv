# FlickTV Stream Health Checker

Automated system to check stream health and remove dead channels.

## Components

| File | Purpose |
|------|---------|
| `health_checker.py` | Main health check engine - tests URLs, logs results, removes dead channels |
| `run_health_check.sh` | Shell runner script with logging |
| `iptv_org_integration.py` | Integration with iptv-org/iptv validation tools |
| `schema.sql` | Database schema (channels, stream_health_logs, health_check_runs) |
| `config.json` | Configuration file |

## How It Works

1. **Health Check**: Sends HTTP HEAD requests to each channel's stream URL (10s timeout)
2. **Batching**: Processes channels in batches of 100 with max 20 concurrent requests
3. **Logging**: Every check result is stored in `stream_health_logs` table
4. **Tracking**: `consecutive_failures` counter increments on each failure
5. **Removal**: Channels with 3+ consecutive failures are auto-removed
6. **Reporting**: Generates text + JSON reports after each run
7. **Scheduling**: Cron job runs daily at 2:00 AM

## Database Schema

- **channels**: Channel metadata with `is_working` and `consecutive_failures`
- **stream_health_logs**: Every health check result with timing and error info
- **health_check_runs**: Summary of each full health check run

## Usage

```bash
# Run manually
./run_health_check.sh

# Or directly with Python
python3 health_checker.py

# With custom DB path
FLICKTV_DB_PATH=/path/to/db.sqlite python3 health_checker.py
```

## Configuration

Environment variables:
- `FLICKTV_DB_PATH` - Path to SQLite database (default: `~/projects/flicktv/backend/data/flicktv.db`)
- `HEALTH_CHECK_BATCH_SIZE` - Channels per batch (default: 100)
- `HEALTH_CHECK_TIMEOUT` - Request timeout in seconds (default: 10)

## Cron Job

Installed: Daily at 2:00 AM
```
0 2 * * * /Users/kingfaisal/projects/flicktv/backend/src/workers/run_health_check.sh >> /Users/kingfaisal/projects/flicktv/backend/logs/cron.log 2>&1
```

## Reports

After each run, reports are saved to:
- `logs/latest_report.txt` - Human-readable report
- `logs/latest_report.json` - Machine-readable JSON
- `logs/health_checker.log` - Full execution log
