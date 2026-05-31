const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://smjedhzlzulgewlnbycb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtamVkaHpsenVsZ2V3bG5ieWNiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTgxNzEwMiwiZXhwIjoyMDk1MzkzMTAyfQ.EHV1vJPytw5WtMg3baSA8xOFVc1Rvn285xQGF6z8mHI';

const s = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  // 1. Test connection - check channels table
  const { count, error: countErr } = await s.from('channels').select('*', { count: 'exact', head: true });
  if (countErr) {
    console.log('Channels table error:', countErr.message);
  } else {
    console.log('Channels in DB:', count);
  }

  // 2. Check if scan_sources table exists
  const { data: srcData, error: srcErr } = await s.from('scan_sources').select('*').limit(1);
  if (srcErr) {
    console.log('scan_sources does not exist yet:', srcErr.message);
    console.log('\n--- Please run this SQL in Supabase SQL Editor ---');
    console.log(`
CREATE TABLE IF NOT EXISTS scan_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT DEFAULT 'm3u',
  category TEXT,
  country TEXT,
  is_active BOOLEAN DEFAULT true,
  last_scanned_at TIMESTAMPTZ,
  channel_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_sources_active ON scan_sources(is_active);

ALTER TABLE scan_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON scan_sources
  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO scan_sources (name, url, source_type, category)
VALUES
  ('iptv-org: News', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/news.m3u', 'm3u', 'news'),
  ('iptv-org: Sports', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/sports.m3u', 'm3u', 'sports'),
  ('iptv-org: Movies', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/movies.m3u', 'm3u', 'movies'),
  ('iptv-org: Kids', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/kids.m3u', 'm3u', 'kids'),
  ('iptv-org: Music', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/music.m3u', 'm3u', 'music')
ON CONFLICT DO NOTHING;
`);
  } else {
    console.log('scan_sources table exists. Rows:', srcData.length);
  }

  // 3. Check admin password
  console.log('\nNote: ADMIN_PASSWORD needs to be set in Railway env vars.');
}

main().catch(e => console.error('Error:', e.message));
