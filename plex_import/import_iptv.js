const { Client } = require('./node_modules/pg');
const fs = require('fs');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const DB_CONFIG = {
  host: 'db.smjedhzlzulgewlnbycb.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'areyou@God?1',
  ssl: { rejectUnauthorized: false },
};

const M3U_FILE = '/tmp/iptv_index.m3u';
const PLAYLIST_NAME = 'iptv-org Full';
const PLAYLIST_TYPE = 'm3u_url';
const BATCH_SIZE = 200;

// ─── PARSE M3U ───────────────────────────────────────────────────────────────
function parseM3U(content) {
  const lines = content.split('\n');
  const channels = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXTINF')) continue;
    const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
    if (!nextLine.startsWith('http')) continue;
    const getName = l => { const idx = l.lastIndexOf(','); return idx >= 0 ? l.substring(idx+1).trim() : l; };
    const getAttr = (l, a) => { const m = l.match(new RegExp(a+'="([^"]*)"','i')); return m ? m[1] : ''; };
    channels.push({
      name: getName(line).replace(/'/g,"''"),
      logo_url: getAttr(line,'tvg-logo')||null,
      group_title: getAttr(line,'group-title')||'General',
      tvg_id: getAttr(line,'tvg-id')||null,
      stream_url: nextLine.replace(/'/g,"''"),
    });
  }
  return channels;
}

function mapCategory(g) {
  const s = (g||'').toLowerCase();
  if (/news|noticias|haber|nouvelles|notizie|notícias|info|24h|bbc|cnn|cnbc|al jazeera|reuters|france.*24|dw|rt|n1|bloomberg|sky.*news|itv|channel.*news/.test(s)) return 'news';
  if (/sport|futbol|football|soccer|nfl|mlb|nba|nhl|mma|ufc|boxing|espn|sportv|fox.*sport|sky.*sport|bein|tnt.*sport|acc|sec|big.*ten|premier.*liga|la.*liga|bundesliga|serie.*a|ligue.*1|champions.*league|world.*cup|olympic|formula.*1|nascar|golf|tennis|rugby|cricket|hockey|volleyball|basketball|baseball/.test(s)) return 'sports';
  if (/movie|cinema|film|película|filme|netflix|hbo|showtime|starz|cinemax|amc|fx|paramount|disney|action|drama|thriller|horror|sci.*fi|romance|western|indie|festival/.test(s)) return 'movies';
  if (/kid|child|cartoon|animation|disney|nick|nickelodeon|cartoon.*network|boomerang|pbs.*kid|baby|junior|family|youth|teen|school|educat|learn|discovery.*channel|animal.*planet|nat.*geo/.test(s)) return 'kids';
  if (/music|mtv|vh1|vevo|bet|cmt|country|hip.*hop|rap|rock|pop|jazz|classical|reggae|reggaeton|latin|r&b|soul|gospel|worship|praise|christian|religio|faith|church|islam|muslim|bible|god/.test(s)) return 'music';
  if (/documentar|discovery|history|national.*geographic|science|nature|travel|food|cook|home|garden|diy|hgtv|lifestyle|fashion|art|culture|biography|investigation|crime|mystery|court|forens/.test(s)) return 'documentary';
  return 'entertainment';
}

function extractCountry(tvgId) {
  if (!tvgId) return null;
  const parts = tvgId.split('.');
  if (parts.length > 1) { const p = parts[parts.length-1].toUpperCase(); if (p.length===2) return p; }
  return null;
}

async function main() {
  console.log('Reading M3U...');
  const content = fs.readFileSync(M3U_FILE, 'utf8');
  console.log(`File: ${(content.length/1024/1024).toFixed(1)} MB`);

  const channels = parseM3U(content);
  console.log(`Parsed ${channels.length} channels`);

  const cats = {};
  channels.forEach(ch => { const c = mapCategory(ch.group_title); cats[c]=(cats[c]||0)+1; });
  console.log('Categories:', cats);

  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('DB connected');

  try {
    let playlistId;
    const existing = await client.query('SELECT id FROM playlists WHERE name = $1', [PLAYLIST_NAME]);
    if (existing.rows.length > 0) {
      playlistId = existing.rows[0].id;
      console.log(`Existing playlist: ${playlistId}`);
    } else {
      const pl = await client.query(
        'INSERT INTO playlists (name, type, channel_count, is_active, sync_status, metadata) VALUES ($1,$2,0,true,$3,$4) RETURNING id',
        [PLAYLIST_NAME, PLAYLIST_TYPE, 'syncing', JSON.stringify({source:'iptv-org',url:'https://iptv-org.github.io/iptv/index.m3u',scraped_at:new Date().toISOString()})]
      );
      playlistId = pl.rows[0].id;
      console.log(`New playlist: ${playlistId}`);
    }

    await client.query("DELETE FROM channels WHERE playlist_id = $1 AND stream_info->>'source' = 'iptv-org'", [playlistId]);
    console.log('Cleared old channels');

    let total = 0;
    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
      const batch = channels.slice(i, Math.min(i+BATCH_SIZE, channels.length));
      const vals = [];
      const params = [];
      let p = 1;
      for (const ch of batch) {
        const cat = mapCategory(ch.group_title);
        const ctry = extractCountry(ch.tvg_id)||'US';
        vals.push(`($${p},$${p+1},$${p+2},$${p+3},$${p+4},$${p+5},$${p+6},$${p+7},$${p+8},$${p+9},$${p+10},$${p+11})`);
        params.push(playlistId, ch.name, ch.stream_url, ch.logo_url, ch.group_title, ch.tvg_id, ch.name, ctry, 'en', cat, ch.stream_url.includes('.m3u8'), JSON.stringify({source:'iptv-org',group:ch.group_title}));
        p += 12;
      }
      try {
        await client.query(
          `INSERT INTO channels (playlist_id,name,stream_url,logo_url,group_title,tvg_id,tvg_name,country,language,category,is_hd,stream_info) VALUES ${vals.join(',')} ON CONFLICT (stream_url) DO UPDATE SET name=EXCLUDED.name,logo_url=EXCLUDED.logo_url,group_title=EXCLUDED.group_title,category=EXCLUDED.category,updated_at=NOW()`,
          params
        );
        total += batch.length;
        process.stdout.write(`\rImported: ${total}/${channels.length}`);
      } catch(e) { console.error(`\nBatch ${i}:`, e.message); }
    }
    console.log('\n');

    await client.query('UPDATE playlists SET channel_count=$1,sync_status=$2,last_synced=NOW(),updated_at=NOW() WHERE id=$3', [total, 'ok', playlistId]);

    const r1 = await client.query('SELECT COUNT(*) FROM channels WHERE playlist_id=$1', [playlistId]);
    const r2 = await client.query('SELECT category,COUNT(*) as cnt FROM channels WHERE playlist_id=$1 GROUP BY category ORDER BY cnt DESC', [playlistId]);
    console.log(`Done! ${r1.rows[0].count} channels imported`);
    r2.rows.forEach(r => console.log(`  ${r.category}: ${r.cnt}`));
  } catch(e) {
    console.error('Fatal:', e.message);
  } finally {
    await client.end();
  }
}

main();
