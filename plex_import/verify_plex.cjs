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
  // Check Plex channels are in the DB and have correct stream URLs
  const r = await client.query(`
    SELECT name, stream_url, category, stream_info->>'source' as source
    FROM channels 
    WHERE stream_info->>'source' = 'plex'
    ORDER BY name
    LIMIT 10
  `);
  
  console.log('Plex channels in DB:');
  r.rows.forEach(ch => {
    console.log(`  ${ch.name} [${ch.category}] - ${ch.stream_url.substring(0, 80)}`);
  });
  
  // Count total Plex
  const c = await client.query("SELECT COUNT(*) FROM channels WHERE stream_info->>'source' = 'plex'");
  console.log(`\nTotal Plex channels: ${c.rows[0].count}`);
  
  await client.end();
}).catch(e => { console.error(e); process.exit(1); });
