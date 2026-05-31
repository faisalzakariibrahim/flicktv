// Run a full migration against Supabase using the PostgREST-compatible approach
// First checks existing tables, then runs DDL via the SQL endpoint
const https = require('https');

const SUPABASE_URL = 'https://smjedhzlzulgewlnbycb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtamVkaHpsenVsZ2V3bG5ieWNiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTgxNzEwMiwiZXhwIjoyMDk1MzkzMTAyfQ.EHV1vJPytw5WtMg3baSA8xOFVc1Rvn285xQGF6z8mHI';

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

const H = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY };

async function main() {
  // 1. Test connection
  const r1 = await httpsGet(`${SUPABASE_URL}/rest/v1/channels?select=id&limit=1`, H);
  console.log('Channels status:', r1.status === 200 ? 'OK' : r1.body.substring(0, 200));

  // 2. Check scan_sources
  const r2 = await httpsGet(`${SUPABASE_URL}/rest/v1/scan_sources?select=id&limit=1`, H);
  if (r2.status === 200) {
    console.log('scan_sources table: EXISTS');
  } else {
    console.log('scan_sources table: DOES NOT EXIST');
    console.log('\n--- COPY AND PASTE THIS INTO SUPABASE SQL EDITOR ---');
    console.log('--- Go to: https://supabase.com/dashboard/project/smjedhzlzulgewlnbycb/sql/new ---');
    console.log('');
    console.log(`CREATE TABLE IF NOT EXISTS scan_sources (
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
);`);

    console.log(`CREATE INDEX IF NOT EXISTS idx_scan_sources_active ON scan_sources(is_active);`);

    console.log(`ALTER TABLE scan_sources ENABLE ROW LEVEL SECURITY;`);

    console.log(`CREATE POLICY "Service role full access" ON scan_sources
  FOR ALL USING (true) WITH CHECK (true);`);

    console.log(`INSERT INTO scan_sources (name, url, source_type, category)
VALUES
  ('iptv-org: News', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/news.m3u', 'm3u', 'news'),
  ('iptv-org: Sports', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/sports.m3u', 'm3u', 'sports'),
  ('iptv-org: Movies', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/movies.m3u', 'm3u', 'movies'),
  ('iptv-org: Kids', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/kids.m3u', 'm3u', 'kids'),
  ('iptv-org: Music', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/music.m3u', 'm3u', 'music')
ON CONFLICT DO NOTHING;`);
    console.log('\n--- END OF SQL ---');
  }
}

main().catch(e => console.error('Error:', e.message));
