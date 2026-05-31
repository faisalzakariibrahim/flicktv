require('dotenv').config({ path: '/Users/kingfaisal/projects/flicktv/.env' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // 1. Test channels table
  const { count } = await s.from('channels').select('*', { count: 'exact', head: true });
  console.log('Channels in DB:', count);

  // 2. Test scan_sources table
  const { data: sources, error: srcErr } = await s.from('scan_sources').select('*');
  if (srcErr) {
    console.log('scan_sources error:', srcErr.message);
  } else {
    console.log('scan_sources:', sources.length, 'rows');
    sources.forEach(r => console.log(' -', r.name, r.url.substring(0, 60)));
  }

  // 3. Test admin password
  console.log('Admin password set:', !!process.env.ADMIN_PASSWORD, process.env.ADMIN_PASSWORD);
}

main().catch(e => console.error(e.message));
