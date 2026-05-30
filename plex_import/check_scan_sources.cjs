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
  // Check if scan_sources table exists and its columns
  const r = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'scan_sources'
    ORDER BY ordinal_position
  `);
  
  if (r.rows.length === 0) {
    console.log('scan_sources table does NOT exist');
  } else {
    console.log('scan_sources columns:');
    r.rows.forEach(c => console.log(' ', c.column_name, c.data_type));
  }
  
  await client.end();
}).catch(e => { console.error(e); process.exit(1); });
