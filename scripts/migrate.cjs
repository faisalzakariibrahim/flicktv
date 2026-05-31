const { Client } = require('pg');

const client = new Client({
  host: 'db.smjedhzlzulgewlnbycb.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'areyou@God?1',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL');

  // Create scan_sources table
  await client.query(`
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
    )
  `);
  console.log('✓ scan_sources table created');

  // Create index
  await client.query(`CREATE INDEX IF NOT EXISTS idx_scan_sources_active ON scan_sources(is_active)`);
  console.log('✓ Index created');

  // Enable RLS
  await client.query(`ALTER TABLE scan_sources ENABLE ROW LEVEL SECURITY`);
  console.log('✓ RLS enabled');

  // Create policy
  await client.query(`
    CREATE POLICY "Service role full access" ON scan_sources
      FOR ALL USING (true) WITH CHECK (true)
  `);
  console.log('✓ Policy created');

  // Seed initial data
  await client.query(`
    INSERT INTO scan_sources (name, url, source_type, category)
    VALUES
      ('iptv-org: News', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/news.m3u', 'm3u', 'news'),
      ('iptv-org: Sports', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/sports.m3u', 'm3u', 'sports'),
      ('iptv-org: Movies', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/movies.m3u', 'm3u', 'movies'),
      ('iptv-org: Kids', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/kids.m3u', 'm3u', 'kids'),
      ('iptv-org: Music', 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/music.m3u', 'm3u', 'music')
    ON CONFLICT DO NOTHING
  `);
  console.log('✓ Seed data inserted');

  // Verify
  const { rows } = await client.query('SELECT * FROM scan_sources');
  console.log('\nscan_sources rows:');
  rows.forEach(r => console.log(`  - ${r.name} (${r.category})`));

  // Check channels count
  const { rows: ch } = await client.query('SELECT COUNT(*) FROM channels');
  console.log('\nChannels in DB:', ch[0].count);

  await client.end();
  console.log('\n✓ Migration complete!');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
