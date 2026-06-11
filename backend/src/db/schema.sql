-- FlickTV Database Schema
-- Stream health monitoring and channel management

CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    stream_url TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    is_working BOOLEAN DEFAULT 1,
    consecutive_failures INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stream_health_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    is_working BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    http_status_code INTEGER,
    error_message TEXT,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS health_check_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_channels INTEGER DEFAULT 0,
    working_count INTEGER DEFAULT 0,
    dead_count INTEGER DEFAULT 0,
    avg_response_time_ms REAL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status TEXT DEFAULT 'running'
);

CREATE INDEX IF NOT EXISTS idx_stream_health_logs_channel_id ON stream_health_logs(channel_id);
CREATE INDEX IF NOT EXISTS idx_stream_health_logs_checked_at ON stream_health_logs(checked_at);
CREATE INDEX IF NOT EXISTS idx_channels_is_working ON channels(is_working);
CREATE INDEX IF NOT EXISTS idx_channels_consecutive_failures ON channels(consecutive_failures);
