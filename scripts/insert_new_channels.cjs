const fs = require('fs');
require('dotenv').config({ path: '/Users/kingfaisal/projects/flicktv/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // 1. Load scanned channels
  const scanned = JSON.parse(fs.readFileSync('/Users/kingfaisal/projects/flicktv/scripts/working_channels.json', 'utf8'));
  console.log(`Scanned channels: ${scanned.length}`);

  // 2. Get existing URLs from DB
  let all = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase.from('channels').select('stream_url').range(from, from + batchSize - 1);
    if (error) { console.error('DB Error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    from += batchSize;
    if (data.length < batchSize) break;
  }
  const existingUrls = new Set(all.map(c => c.stream_url));
  console.log(`Existing DB channels: ${existingUrls.size}`);

  // 3. De-duplicate
  const newChannels = scanned.filter(ch => !existingUrls.has(ch.stream_url));
  console.log(`New channels: ${newChannels.length}`);
  console.log(`Duplicates skipped: ${scanned.length - newChannels.length}`);

  if (newChannels.length === 0) {
    console.log('Nothing to insert.');
    return;
  }

  // 4. Map to actual DB schema
  const rows = newChannels.map(ch => ({
    name: ch.name,
    stream_url: ch.stream_url,
    logo_url: ch.logo_url || null,
    group_title: ch.group_title || null,
    tvg_id: ch.tvg_id || null,
    tvg_name: ch.tvg_name || ch.name,
    country: ch.country || null,
    language: ch.language || null,
    category: ch.category || 'general',
    is_hd: ch.is_hd || false,
    is_4k: ch.is_4k || false,
    is_live: true,
    is_working: true,
    stream_info: {}
  }));

  // 5. Insert in batches of 50
  const insertBatchSize = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += insertBatchSize) {
    const batch = rows.slice(i, i + insertBatchSize);
    const { data, error } = await supabase.from('channels').insert(batch).select();
    if (error) {
      console.error(`Batch ${Math.floor(i/insertBatchSize)+1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += data.length;
      console.log(`Batch ${Math.floor(i/insertBatchSize)+1}: +${data.length} (total: ${inserted})`);
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Errors: ${errors}`);

  // Verify final count
  const { count } = await supabase.from('channels').select('*', { count: 'exact', head: true });
  console.log(`Total DB channels now: ${count}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
