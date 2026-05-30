const { Client } = require('pg');
const client = new Client({
  host: 'db.smjedhzlzulgewlnbycb.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'areyou@God?1',
  ssl: { rejectUnauthorized: false },
});

client.connect().then(async () => {
  const result = await client.query(`
    INSERT INTO scan_sources (name, url, source_type, category, country, is_active, channel_count)
    VALUES ('Plex Live TV', 'https://watch.plex.tv/live-tv', 'plex_api', 'entertainment', 'US', true, 665)
    ON CONFLICT DO NOTHING
    RETURNING id
  `);
  
  if (result.rows.length > 0) {
    console.log('Created scan source:', result.rows[0].id);
  } else {
    console.log('Scan source already exists');
  }
  
  await client.end();
}).catch(e => { console.error(e); process.exit(1); });
