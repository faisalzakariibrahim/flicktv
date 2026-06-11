-- ════════════════════════════════════════════════════════════════════════════
-- Migration 003: World Cup Matches + Highlights
-- FlickTV AI — FIFA World Cup 2026
-- ════════════════════════════════════════════════════════════════════════════

-- ─── WORLD CUP MATCHES ───────────────────────────────────────────────────
-- Tracks each World Cup match: teams, kickoff time, status, group info
CREATE TABLE world_cup_matches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  home_team       TEXT NOT NULL,
  away_team       TEXT NOT NULL,
  home_flag       TEXT,                        -- emoji flag 🇧🇷
  away_flag       TEXT,
  "group"         TEXT,                        -- 'A' through 'H', or knockout stage name
  round           TEXT,                        -- 'group', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final'
  kickoff_at      TIMESTAMPTZ NOT NULL,
  status          TEXT DEFAULT 'scheduled',     -- 'scheduled', 'live', 'halftime', 'finished', 'postponed'
  home_score      INT DEFAULT 0,
  away_score      INT DEFAULT 0,
  venue           TEXT,
  stream_url      TEXT,                        -- primary FlickTV channel stream_url
  channel_id      UUID REFERENCES channels(id),
  match_id_ext    TEXT,                        -- external ID from football API
  metadata        JSONB DEFAULT '{}',          -- extra data (referee, weather, etc.)
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX wc_matches_status ON world_cup_matches (status);
CREATE INDEX wc_matches_kickoff ON world_cup_matches (kickoff_at);
CREATE INDEX wc_matches_group ON world_cup_matches ("group");

-- ─── MATCH EVENTS (goals, cards, subs) ──────────────────────────────────
CREATE TABLE match_events (
  id              BIGSERIAL PRIMARY KEY,
  match_id        UUID REFERENCES world_cup_matches(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,              -- 'goal', 'own_goal', 'penalty', 'yellow_card', 'red_card', 'substitution', 'var_review', 'halftime', 'fulltime'
  minute          INT,                         -- match minute (e.g., 23, 45+2)
  team            TEXT,                        -- 'home' | 'away'
  player          TEXT,
  description     TEXT,
  event_at        TIMESTAMPTZ DEFAULT NOW(),  -- when the event was detected
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX match_events_match ON match_events (match_id, minute);

-- ─── HIGHLIPS ────────────────────────────────────────────────────────────
CREATE TABLE highlights (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id        UUID REFERENCES world_cup_matches(id) ON DELETE CASCADE,
  event_id        BIGINT REFERENCES match_events(id),
  title           TEXT NOT NULL,               -- "⚽ GOAL! Messi scores for Argentina (23')"
  description     TEXT,
  clip_url        TEXT,                        -- local path to generated clip
  thumbnail_url   TEXT,
  duration_secs   INT,                         -- clip length
  event_type      TEXT,                        -- 'goal', 'save', 'card', 'celebration', 'full_match'
  minute          INT,
  status          TEXT DEFAULT 'pending',      -- 'pending', 'rendering', 'ready', 'posted_youtube', 'posted_tiktok', 'posted_both', 'failed'
  youtube_url     TEXT,
  tiktok_url      TEXT,
  youtube_id      TEXT,
  tiktok_id       TEXT,
  views           INT DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX highlights_match ON highlights (match_id);
CREATE INDEX highlights_status ON highlights (status);

-- ─── HIGHLIGHT RENDER QUEUE ──────────────────────────────────────────────
CREATE TABLE highlight_queue (
  id              BIGSERIAL PRIMARY KEY,
  match_id        UUID REFERENCES world_cup_matches(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  minute          INT,
  player          TEXT,
  team            TEXT,
  priority        INT DEFAULT 5,               -- 1=highest (final goal), 5=lowest
  status          TEXT DEFAULT 'queued',       -- 'queued', 'processing', 'done', 'failed'
  error           TEXT,
  retry_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX highlight_queue_status ON highlight_queue (status, priority);

-- ─── AUTO-UPDATE TRIGGER ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_wc_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_wc_matches_updated BEFORE UPDATE ON world_cup_matches
  FOR EACH ROW EXECUTE FUNCTION update_wc_updated_at();
CREATE TRIGGER tr_highlights_updated BEFORE UPDATE ON highlights
  FOR EACH ROW EXECUTE FUNCTION update_wc_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────
ALTER TABLE world_cup_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlight_queue ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth needed for viewing matches/highlights)
CREATE POLICY wc_matches_read ON world_cup_matches FOR SELECT USING (true);
CREATE POLICY match_events_read ON match_events FOR SELECT USING (true);
CREATE POLICY highlights_read ON highlights FOR SELECT USING (true);
CREATE POLICY highlight_queue_read ON highlight_queue FOR SELECT USING (true);

-- ─── VIEWS ───────────────────────────────────────────────────────────────

-- Live matches with current score
CREATE OR REPLACE VIEW v_live_matches AS
SELECT 
  m.*,
  (SELECT COUNT(*) FROM match_events e WHERE e.match_id = m.id AND e.event_type IN ('goal','own_goal','penalty')) as total_goals,
  (SELECT json_agg(e ORDER BY e.minute) FROM match_events e WHERE e.match_id = m.id) as events
FROM world_cup_matches m
WHERE m.status IN ('live', 'halftime')
ORDER BY m.kickoff_at DESC;

-- Pending highlights to render
CREATE OR REPLACE VIEW v_pending_highlights AS
SELECT 
  q.*,
  m.home_team, m.away_team, m.home_score, m.away_score, m.round
FROM highlight_queue q
JOIN world_cup_matches m ON m.id = q.match_id
WHERE q.status = 'queued'
ORDER BY q.priority ASC, q.created_at ASC;
