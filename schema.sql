-- ════════════════════════════════════════════════════════════════════════════
-- FlickTV AI — Complete Database Schema
-- Supabase / PostgreSQL
-- ════════════════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fuzzy channel search
CREATE EXTENSION IF NOT EXISTS "vector";    -- pgvector for AI embeddings

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE,
  phone         TEXT UNIQUE,
  display_name  TEXT,
  avatar_url    TEXT,
  provider      TEXT DEFAULT 'email',          -- 'email' | 'google' | 'apple' | 'guest'
  plan          TEXT DEFAULT 'free',           -- 'free' | 'premium' | 'enterprise'
  plan_expires_at TIMESTAMPTZ,
  max_devices   INT DEFAULT 1,
  is_admin      BOOLEAN DEFAULT FALSE,
  is_banned     BOOLEAN DEFAULT FALSE,
  preferences   JSONB DEFAULT '{
    "language": "en",
    "subtitles": false,
    "autoplay": true,
    "quality": "auto",
    "notifications": true,
    "theme": "dark"
  }',
  ai_profile    JSONB DEFAULT '{}',            -- stores AI taste profile
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DEVICES ─────────────────────────────────────────────────────────────────
CREATE TABLE devices (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT,
  device_type TEXT,   -- 'mobile_ios' | 'mobile_android' | 'tv_android' | 'web' | 'smart_tv'
  push_token  TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PLAYLISTS ────────────────────────────────────────────────────────────────
CREATE TABLE playlists (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,    -- 'm3u_url' | 'm3u_file' | 'xtream' | 'local'
  url          TEXT,             -- M3U URL or Xtream server
  xtream_user  TEXT,
  xtream_pass  TEXT,
  raw_content  TEXT,             -- for local file uploads
  channel_count INT DEFAULT 0,
  is_active    BOOLEAN DEFAULT TRUE,
  last_synced  TIMESTAMPTZ,
  sync_status  TEXT DEFAULT 'pending',  -- 'pending' | 'syncing' | 'ok' | 'error'
  sync_error   TEXT,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CHANNELS ────────────────────────────────────────────────────────────────
CREATE TABLE channels (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id  UUID REFERENCES playlists(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  stream_url   TEXT NOT NULL,
  logo_url     TEXT,
  group_title  TEXT,            -- EPG/M3U group
  tvg_id       TEXT,            -- EPG channel ID
  tvg_name     TEXT,
  country      TEXT,
  language     TEXT,
  category     TEXT,            -- 'news' | 'sports' | 'movies' | 'entertainment' | 'kids' | 'music' | 'religious' | 'documentary'
  is_hd        BOOLEAN DEFAULT FALSE,
  is_4k        BOOLEAN DEFAULT FALSE,
  is_live      BOOLEAN DEFAULT TRUE,
  is_working   BOOLEAN DEFAULT TRUE,
  last_checked TIMESTAMPTZ,
  stream_info  JSONB DEFAULT '{}',   -- bitrate, codec, resolution
  embedding    vector(1536),          -- pgvector for AI similarity search
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- GIN index for fast text search
CREATE INDEX channels_name_trgm_idx ON channels USING GIN (name gin_trgm_ops);
CREATE INDEX channels_group_idx ON channels (group_title);
CREATE INDEX channels_category_idx ON channels (category);
CREATE INDEX channels_country_idx ON channels (country);
CREATE INDEX channels_user_idx ON channels (user_id);

-- ─── FAVORITES ────────────────────────────────────────────────────────────────
CREATE TABLE favorites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  channel_id  UUID REFERENCES channels(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, channel_id)
);

-- ─── WATCH HISTORY ────────────────────────────────────────────────────────────
CREATE TABLE watch_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  channel_id    UUID REFERENCES channels(id) ON DELETE SET NULL,
  channel_name  TEXT,           -- denormalized for history even if channel deleted
  channel_logo  TEXT,
  stream_url    TEXT,
  watched_at    TIMESTAMPTZ DEFAULT NOW(),
  duration_secs INT DEFAULT 0,  -- how long they watched
  device_type   TEXT
);

CREATE INDEX watch_history_user_idx ON watch_history (user_id, watched_at DESC);

-- ─── AI RECOMMENDATIONS ──────────────────────────────────────────────────────
CREATE TABLE recommendations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  channel_id   UUID REFERENCES channels(id) ON DELETE CASCADE,
  score        FLOAT NOT NULL,          -- 0-1 confidence score
  reason       TEXT,                    -- human-readable explanation
  algorithm    TEXT DEFAULT 'claude',   -- 'claude' | 'collaborative' | 'hybrid'
  is_dismissed BOOLEAN DEFAULT FALSE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- ─── EPG / PROGRAM GUIDE ─────────────────────────────────────────────────────
CREATE TABLE epg_sources (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  last_synced TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE epg_programs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_tvg_id TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ NOT NULL,
  category    TEXT,
  poster_url  TEXT,
  rating      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX epg_programs_channel_time_idx ON epg_programs (channel_tvg_id, start_time);

-- ─── REMINDERS ───────────────────────────────────────────────────────────────
CREATE TABLE reminders (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  program_id   UUID REFERENCES epg_programs(id) ON DELETE CASCADE,
  remind_at    TIMESTAMPTZ NOT NULL,
  is_sent      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SUBSCRIPTIONS / BILLING ─────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  plan            TEXT NOT NULL,    -- 'free' | 'premium' | 'enterprise'
  status          TEXT DEFAULT 'active',  -- 'active' | 'cancelled' | 'expired'
  provider        TEXT,             -- 'stripe' | 'apple_iap' | 'google_play' | 'manual'
  provider_sub_id TEXT,
  price_usd       NUMERIC(10,2),
  billing_cycle   TEXT DEFAULT 'monthly',  -- 'monthly' | 'yearly'
  starts_at       TIMESTAMPTZ DEFAULT NOW(),
  ends_at         TIMESTAMPTZ,
  auto_renew      BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ANALYTICS ────────────────────────────────────────────────────────────────
CREATE TABLE analytics_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,   -- 'stream_start' | 'stream_end' | 'search' | 'ai_query' | etc.
  channel_id  UUID,
  payload     JSONB DEFAULT '{}',
  device_type TEXT,
  ip_hash     TEXT,            -- hashed for privacy
  created_at  TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Monthly partitions for analytics (create as needed)
CREATE TABLE analytics_events_2025_01 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE analytics_events_2025_02 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- ... add more monthly partitions

CREATE INDEX analytics_events_user_idx ON analytics_events (user_id, created_at DESC);
CREATE INDEX analytics_events_type_idx ON analytics_events (event_type, created_at DESC);

-- ─── AI CHAT SESSIONS ────────────────────────────────────────────────────────
CREATE TABLE ai_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  messages    JSONB DEFAULT '[]',    -- full conversation history
  intent      TEXT,                  -- last detected intent
  resolved    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── STREAM HEALTH LOG ───────────────────────────────────────────────────────
CREATE TABLE stream_health_logs (
  id          BIGSERIAL PRIMARY KEY,
  channel_id  UUID REFERENCES channels(id) ON DELETE CASCADE,
  is_alive    BOOLEAN,
  response_ms INT,
  error       TEXT,
  checked_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own data
CREATE POLICY users_self ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY playlists_owner ON playlists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY channels_owner ON channels FOR ALL USING (auth.uid() = user_id);
CREATE POLICY favorites_owner ON favorites FOR ALL USING (auth.uid() = user_id);
CREATE POLICY history_owner ON watch_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY recs_owner ON recommendations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY subs_owner ON subscriptions FOR ALL USING (auth.uid() = user_id);

-- ─── FREEMIUM TRACKING ───────────────────────────────────────────────────────
-- streams_watched counts lifetime streams for free-plan users.
-- When this reaches FREE_STREAM_LIMIT the proxy returns 402.
ALTER TABLE users ADD COLUMN IF NOT EXISTS streams_watched INT DEFAULT 0;

-- ─── ANALYTICS PARTITIONS (2025–2026) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events_2025_03 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS analytics_events_2025_04 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS analytics_events_2025_05 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS analytics_events_2025_06 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS analytics_events_2025_07 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS analytics_events_2025_08 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS analytics_events_2025_09 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS analytics_events_2025_10 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS analytics_events_2025_11 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS analytics_events_2025_12 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS analytics_events_2026_01 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS analytics_events_2026_02 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS analytics_events_2026_03 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS analytics_events_2026_04 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS analytics_events_2026_05 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS analytics_events_2026_06 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- ─── FUNCTIONS ────────────────────────────────────────────────────────────────

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_playlists_updated BEFORE UPDATE ON playlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_channels_updated BEFORE UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Get trending channels (most watched in last 24h)
CREATE OR REPLACE FUNCTION get_trending_channels(p_limit INT DEFAULT 20)
RETURNS TABLE(channel_id UUID, watch_count BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT wh.channel_id, COUNT(*) AS watch_count
    FROM watch_history wh
    WHERE wh.watched_at > NOW() - INTERVAL '24 hours'
      AND wh.channel_id IS NOT NULL
    GROUP BY wh.channel_id
    ORDER BY watch_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
