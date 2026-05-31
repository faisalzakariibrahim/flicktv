const { Client } = require('./node_modules/pg');
const client = new Client({
  host: 'db.smjedhzlzulgewlnbycb.supabase.co', port: 5432, database: 'postgres',
  user: 'postgres', password: 'areyou@God?1', ssl: { rejectUnauthorized: false },
});

function mapCategory(group) {
  const g = (group || '').toLowerCase().trim();
  
  // Sports first (before news, since "newsport" could match)
  if (/\bsport\b|football|soccer|nfl|mlb|nba|nhl|mma|ufc|boxing|espn|sportv|bein|soccer|cricket|rugby|hockey|volleyball|basketball|baseball|tennis|golf|motorsport|formula.?1|nascar|wrestling|boxing|fight|athletic|espn/i.test(g)) return 'sports';
  
  // News
  if (/\bnews\b|noticias|haber|nouvelles|notizie|24h|bbc|cnn|cnbc|al.jazeera|reuters|france.?24|bloomberg|sky.?news|fox.?news|newsworld/i.test(g)) return 'news';
  
  // Movies & Series
  if (/\bmovie\b|cinema|film|pel.cula|netflix|hbo|showtime|starz|cinemax|amc|paramount|action|drama|thriller|horror|sci.fi|romance|western|telenovela|series|tv.show|sitcom/i.test(g)) return 'movies';
  
  // Kids & Family
  if (/\bkid\b|child|cartoon|animation|nickelodeon|cartoon.network|boomerang|baby|junior|family|youth|teen|pbs.kid/i.test(g)) return 'kids';
  
  // Music
  if (/\bmusic\b|mtv|vh1|vevo|bet|cmt|hip.hop|reggae|reggaeton|r&b|gospel|praise|worship/i.test(g)) return 'music';
  
  // Documentary & Educational
  if (/\bdocumentar\b|discovery|history|national.geographic|nature|science|travel|food|cook|investigation|crime|mystery|biography|forens|educat/i.test(g)) return 'documentary';
  
  // Religious
  if (/\breligio\b|faith|church|islam|muslim|bible|god|spiritual|worship|praise|gospel/i.test(g)) return 'religious';
  
  return 'entertainment';
}

client.connect().then(async () => {
  const r = await client.query("SELECT id, group_title, category FROM channels WHERE stream_info->>'source' = 'iptv-org'");
  console.log(`Found ${r.rows.length} channels to check`);
  
  let updated = 0;
  const catCounts = {};
  
  for (const ch of r.rows) {
    const newCat = mapCategory(ch.group_title);
    catCounts[newCat] = (catCounts[newCat] || 0) + 1;
    if (newCat !== ch.category) {
      await client.query('UPDATE channels SET category = $1 WHERE id = $2', [newCat, ch.id]);
      updated++;
    }
  }
  
  console.log(`Updated ${updated} channels`);
  console.log('\nCategory distribution:');
  Object.entries(catCounts).sort((a,b) => b[1]-a[1]).forEach(([c,n]) => console.log(`  ${c}: ${n}`));
  
  await client.end();
}).catch(e => { console.error(e); process.exit(1); });
