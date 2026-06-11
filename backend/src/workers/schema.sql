-- FlickTV Stream Health Monitoring Schema

CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    group_name TEXT,
    logo TEXT,
    is_working BOOLEAN DEFAULT 1,
    consecutive_failures INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stream_health_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_working BOOLEAN NOT NULL,
    status_code TEXT,
    response_time_ms REAL,
    error_message TEXT,
    FOREIGN KEY (channel_id) REFERENCES channels(id)
);

CREATE INDEX IF NOT EXISTS idx_health_logs_channel_id ON stream_health_logs(channel_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_checked_at ON stream_health_logs(checked_at);
CREATE INDEX IF NOT EXISTS idx_channels_is_working ON channels(is_working);

CREATE TABLE IF NOT EXISTS health_check_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    total_channels INTEGER DEFAULT 0,
    working_count INTEGER DEFAULT 0,
    dead_count INTEGER DEFAULT 0,
    removed_count INTEGER DEFAULT 0,
    avg_response_time_ms REAL,
    status TEXT DEFAULT 'running',
    error_message TEXT
);
