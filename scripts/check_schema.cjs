const fs = require('fs');
require('dotenv').config({ path: '/Users/kingfaisal/projects/flicktv/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const { data } = await supabase.from('channels').select('*').limit(1);
  if (data && data[0]) {
    console.log('Columns:', Object.keys(data[0]));
    console.log('Sample row:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('No data or error');
  }
}
main().catch(e => { console.error(e.message); process.exit(1); });
