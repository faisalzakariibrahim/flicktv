-- FlickTV AI: Scan Sources Table + Admin vars
-- Run this in Supabase SQL Editor or via migration

CREATE TABLE IF NOT EXISTS scan_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT DEFAULT 'm3u',    -- m3u, xtream, pluto, custom
  category TEXT,
  country TEXT,
  is_active BOOLEAN DEFAULT true,
  last_scanned_at TIMESTAMPTZ,
  channel_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for active source lookups
CREATE INDEX IF NOT EXISTS idx_scan_sources_active ON scan_sources(is_active);

-- Enable RLS but allow service key access
ALTER TABLE scan_sources ENABLE ROW LEVEL SECURITY;

-- Allow anonymous/admin full access via service role
CREATE POLICY "Service role full access" ON scan_sources
  FOR ALL USING (true) WITH CHECK (true);

-- Insert some default sources
INSERT INTO scan_sources (name, url, source_type, category)
VALUES
  ('iptv-org: News', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/news.m3u', 'm3u', 'news'),
  ('iptv-org: Sports', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/sports.m3u', 'm3u', 'sports'),
  ('iptv-org: Movies', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/movies.m3u', 'm3u', 'movies'),
  ('iptv-org: Kids', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/kids.m3u', 'm3u', 'kids'),
  ('iptv-org: Music', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/music.m3u', 'm3u', 'music')
ON CONFLICT DO NOTHING;
