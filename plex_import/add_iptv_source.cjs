const { Client } = require('./node_modules/pg');
const client = new Client({
  host: 'db.smjedhzlzulgewlnbycb.supabase.co', port: 5432, database: 'postgres',
  user: 'postgres', password: 'areyou@God?1', ssl: { rejectUnauthorized: false },
});
client.connect().then(async () => {
  await client.query(`
    INSERT INTO scan_sources (name, url, source_type, category, country, is_active, channel_count)
    VALUES ('iptv-org Full', 'https://iptv-org.github.io/iptv/index.m3u', 'm3u_url', 'entertainment', 'US', true, 8859)
    ON CONFLICT DO NOTHING
  `);
  const r = await client.query('SELECT COUNT(*) FROM channels');
  console.log('Total channels in DB:', r.rows[0].count);
  await client.end();
}).catch(e => console.error(e));
