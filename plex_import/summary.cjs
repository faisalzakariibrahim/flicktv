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
  console.log('=== PLEX LIVE TV IMPORT SUMMARY ===\n');
  
  // Total channels
  const t = await client.query('SELECT COUNT(*) FROM channels');
  console.log('Total channels in DB:', t.rows[0].count);
  
  // Plex channels
  const p = await client.query("SELECT COUNT(*) FROM channels WHERE stream_info->>'source' = 'plex'");
  console.log('Plex channels:', p.rows[0].count);
  
  // Plex channels by category
  const cats = await client.query(`
    SELECT category, COUNT(*) as cnt 
    FROM channels WHERE stream_info->>'source' = 'plex' 
    GROUP BY category ORDER BY cnt DESC
  `);
  console.log('\nBy category:');
  cats.rows.forEach(r => console.log(`  ${r.category}: ${r.cnt}`));
  
  // Playlists
  const pl = await client.query('SELECT name, channel_count FROM playlists');
  console.log('\nPlaylists:');
  pl.rows.forEach(p => console.log(`  ${p.name}: ${p.channel_count} channels`));
  
  // Scan sources
  const ss = await client.query('SELECT name, url, channel_count FROM scan_sources');
  console.log('\nScan sources:');
  ss.rows.forEach(s => console.log(`  ${s.name}: ${s.channel_count} channels (${s.url})`));
  
  // Sample stream URLs
  const sample = await client.query(`
    SELECT name, stream_url, stream_info->>'plex_stream_base' as base_url, stream_info->>'slug' as slug
    FROM channels WHERE stream_info->>'source' = 'plex' 
    LIMIT 3
  `);
  console.log('\nSample stream URLs:');
  sample.rows.forEach(s => {
    console.log(`  ${s.name}:`);
    console.log(`    slug: ${s.slug}`);
    console.log(`    url: ${s.stream_url}`);
  });
  
  // Count channels without user_id (system/imported channels)
  const noUser = await client.query('SELECT COUNT(*) FROM channels WHERE user_id IS NULL');
  console.log('\nChannels without user_id (system):', noUser.rows[0].count);
  
  await client.end();
}).catch(e => { console.error(e); process.exit(1); });
