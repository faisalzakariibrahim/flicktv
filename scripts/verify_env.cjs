require('dotenv').config({ path: '/Users/kingfaisal/projects/flicktv/.env' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
const pwd = process.env.ADMIN_PASSWORD;

console.log('Key length:', key ? key.length : 0);
console.log('Admin password:', pwd);

const s = createClient(url, key);

async function main() {
  // Test connection
  const { count } = await s.from('channels').select('*', { count: 'exact', head: true });
  console.log('Channels in DB:', count);

  // Check scan_sources
  const { data, error } = await s.from('scan_sources').select('*').limit(1);
  if (error && error.message.includes('does not exist')) {
    console.log('\nscan_sources table MISSING. You need to run this SQL in Supabase dashboard:');
    console.log('---');
    const fs = require('fs');
    console.log(fs.readFileSync('/Users/kingfaisal/projects/flicktv/backend/supabase/migrations/002_scan_sources.sql', 'utf8'));
  } else if (error) {
    console.log('scan_sources error:', error.message);
  } else {
    console.log('scan_sources table exists:', data.length, 'rows');
  }
}

main().catch(e => console.error(e.message));
