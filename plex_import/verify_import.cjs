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
  const r1 = await client.query('SELECT COUNT(*) FROM channels');
  console.log('Total channels:', r1.rows[0].count);
  
  const r2 = await client.query("SELECT COUNT(*) FROM channels WHERE stream_info->>'source' = 'plex'");
  console.log('Plex channels:', r2.rows[0].count);
  
  const r3 = await client.query("SELECT name, stream_url, logo_url, category FROM channels WHERE stream_info->>'source' = 'plex' LIMIT 5");
  r3.rows.forEach(ch => console.log(ch.name, '|', ch.category, '|', ch.stream_url.substring(0, 80)));
  
  const r4 = await client.query('SELECT id, name, type, channel_count FROM playlists');
  r4.rows.forEach(p => console.log(p.id, p.name, p.type, p.channel_count));
  
  await client.end();
}).catch(e => { console.error(e); process.exit(1); });
