// Run DDL migration against Supabase via the Management API / pg endpoint
// Uses the service role key for authentication
const https = require('https');

const SUPABASE_URL = 'https://smjedhzlzulgewlnbycb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtamVkaHpsenVsZ2V3bG5ieWNiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTgxNzEwMiwiZXhwIjoyMDk1MzkzMTAyfQ.EHV1vJPytw5WtMg3baSA8xOFVc1Rvn285xQGF6z8mHI';

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const migrationSQL = `
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
`;

async function main() {
  // Try the pg query endpoint (available in Supabase pro/starter plans)
  console.log('Attempting to run migration via Supabase API...');
  
  const r = await httpsPost(`${SUPABASE_URL}/pg/query`, {
    query: migrationSQL
  });
  
  console.log('Status:', r.status);
  console.log('Response:', r.body);
}

main().catch(e => console.error('Error:', e.message));
