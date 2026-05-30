const { Client } = require('pg');
const readline = require('readline');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const DB_CONFIG = {
  host: 'db.smjedhzlzulgewlnbycb.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'areyou@God?1',
  ssl: { rejectUnauthorized: false },
};

const PLEX_PLAYLIST_NAME = 'Plex Live TV';
const PLEX_PLAYLIST_TYPE = 'plex_api';
const RAW_DATA_FILE = process.argv[2] || '/var/folders/xy/bzs2zxtn7qb3wj1dgmzn1qrw0000gn/T/hermes-results/7cff2417-8e28-4af7-8523-14a438e38708.txt';

// ─── PARSE CHANNEL DATA ──────────────────────────────────────────────────────
function parseChannelsFromFile(filePath) {
  const fs = require('fs');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // The file has format: {"success": true, "result": "..."}
  // The result value is the actual data string
  let dataStr = content;
  try {
    const parsed = JSON.parse(content);
    if (parsed.result) {
      dataStr = parsed.result;
    }
  } catch (e) {
    // Not JSON, use raw content
  }
  
  // Parse SQL-like tuples: ('title','slug','thumb','stream_base','plex_id')
  const channels = [];
  const tupleRegex = /\('([^']*(?:''[^']*)*)','([^']*(?:''[^']*)*)','([^']*(?:''[^']*)*)','([^']*(?:''[^']*)*)','([^']*(?:''[^']*)*)'\)/g;
  let match;
  let count = 0;
  
  while ((match = tupleRegex.exec(dataStr)) !== null) {
    channels.push({
      name: match[1].replace(/''/g, "'"),
      slug: match[2].replace(/''/g, "'"),
      logo_url: match[3].replace(/''/g, "'"),
      stream_url: match[4].replace(/''/g, "'"),
      plex_id: match[5].replace(/''/g, "'"),
    });
    count++;
  }
  
  // Deduplicate by stream_url
  const seen_urls = new Set();
  const unique = channels.filter(ch => {
    if (seen_urls.has(ch.stream_url)) return false;
    seen_urls.add(ch.stream_url);
    return true;
  });
  console.log(`After dedup: ${unique.length} channels (${channels.length - unique.length} duplicates removed)`);
  
  return unique;
}

// Map Plex channel slugs to FlickTV categories
function inferCategory(slug) {
  const s = slug.toLowerCase();
  if (/news|cnn|headline|bbc|sky(?:news| sport)|weather/.test(s)) return 'news';
  if (/sport|fubo|fight|ufc|boxing|mma|nfl|mlb|nba|soccer|hockey/.test(s)) return 'sports';
  if (/movie|cinema|film|hollywood|action|drama|comedy|thriller/.test(s)) return 'movies';
  if (/kid|family|cartoon|boomerang|disnick|junior|toon/.test(s)) return 'kids';
  if (/music|mtv|vh1|vevo|bet/.test(s)) return 'music';
  if (/crime|mystery|investigation|detective/.test(s)) return 'documentary';
  if (/relig|faith|church|gospel/.test(s)) return 'religious';
  return 'entertainment';
}

// ─── DATABASE IMPORT ─────────────────────────────────────────────────────────
async function importChannels() {
  console.log(`Reading channel data from: ${RAW_DATA_FILE}`);
  const channels = parseChannelsFromFile(RAW_DATA_FILE);
  console.log(`Parsed ${channels.length} Plex channels`);
  
  if (channels.length === 0) {
    console.error('No channels found! Check the data file.');
    process.exit(1);
  }
  
  console.log('Sample channels:');
  channels.slice(0, 5).forEach(c => console.log(`  - ${c.name} (${c.slug})`));
  
  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('\nConnected to Supabase');
  
  try {
    // Step 1: Create or get playlist
    let playlistId;
    const existingPlaylist = await client.query(`SELECT id FROM playlists WHERE name = $1`, [PLEX_PLAYLIST_NAME]);
    if (existingPlaylist.rows.length > 0) {
      playlistId = existingPlaylist.rows[0].id;
      await client.query(`UPDATE playlists SET updated_at = NOW(), metadata = $1 WHERE id = $2`, [JSON.stringify({
        source: 'plex.tv',
        url: 'https://watch.plex.tv/live-tv',
        scraped_at: new Date().toISOString(),
        total_channels: channels.length,
      }), playlistId]);
    } else {
      const playlistResult = await client.query(`
        INSERT INTO playlists (name, type, channel_count, is_active, sync_status, metadata)
        VALUES ($1, $2, 0, true, 'syncing', $3)
        RETURNING id
      `, [PLEX_PLAYLIST_NAME, PLEX_PLAYLIST_TYPE, JSON.stringify({
        source: 'plex.tv',
        url: 'https://watch.plex.tv/live-tv',
        scraped_at: new Date().toISOString(),
        total_channels: channels.length,
      })]);
      playlistId = playlistResult.rows[0].id;
    }
    console.log(`Playlist ID: ${playlistId}`);
    
    // Step 2: Delete ALL channels in this playlist (fresh import)
    const deleted = await client.query(`DELETE FROM channels WHERE playlist_id = $1`, [playlistId]);
    console.log(`Cleared ${deleted.rowCount} old channels`);
    
    // Step 3: Insert channels in batches using unnest for efficiency
    const BATCH_SIZE = 50;
    let totalInserted = 0;
    
    // Build arrays for bulk insert
    const allNames = [];
    const allSlugs = [];
    const allLogos = [];
    const allStreams = [];
    const allPlexIds = [];
    const allCategories = [];
    const allCountries = [];
    const allLanguages = [];
    const allGroups = [];
    
    for (const ch of channels) {
      allNames.push(ch.name);
      allSlugs.push(ch.slug);
      allLogos.push(ch.logo_url || null);
      allStreams.push(ch.stream_url);
      allPlexIds.push(ch.plex_id);
      allCategories.push(inferCategory(ch.slug));
      allCountries.push('US');
      allLanguages.push('en');
      allGroups.push('Plex Live TV');
    }
    
    // Batch insert using unnest
    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
      const end = Math.min(i + BATCH_SIZE, channels.length);
      
      const query = `
        INSERT INTO channels (playlist_id, name, stream_url, logo_url, group_title, tvg_id, tvg_name, country, language, category, stream_info, is_live)
        SELECT $1, n, s, l, g, t, tn, c, lg, cat, si, true
        FROM unnest(
          $2::text[], $3::text[], $4::text[], $5::text[],
          $6::text[], $7::text[], $8::text[], $9::text[],
          $10::text[], $11::jsonb[]
        ) AS t(n, s, l, g, t, tn, c, lg, cat, si)
      `;
      
      const params = [
        playlistId,
        allNames.slice(i, end),
        allStreams.slice(i, end),
        allLogos.slice(i, end),
        allGroups.slice(i, end),
        allPlexIds.slice(i, end),
        allNames.slice(i, end),
        allCountries.slice(i, end),
        allLanguages.slice(i, end),
        allCategories.slice(i, end),
        allSlugs.slice(i, end).map((slug, idx) => JSON.stringify({ slug, source: 'plex', plex_stream_base: channels[i + idx].stream_url })),
      ];
      
      await client.query(query, params);
      totalInserted += (end - i);
      process.stdout.write(`\rInserted: ${totalInserted}/${channels.length}`);
    }
    
    console.log('\n');
    
    // Step 4: Update playlist
    await client.query(`
      UPDATE playlists 
      SET channel_count = $1, sync_status = 'ok', last_synced = NOW(), updated_at = NOW() 
      WHERE id = $2
    `, [totalInserted, playlistId]);
    
    // Step 5: Verify
    const countResult = await client.query(`SELECT COUNT(*) FROM channels WHERE playlist_id = $1`, [playlistId]);
    const catResult = await client.query(`
      SELECT category, COUNT(*) as cnt 
      FROM channels WHERE playlist_id = $1 
      GROUP BY category ORDER BY cnt DESC
    `, [playlistId]);
    
    console.log(`\nImport complete! ${countResult.rows[0].count} channels in database`);
    console.log('\nChannels by category:');
    catResult.rows.forEach(r => console.log(`  ${r.category}: ${r.cnt}`));
    
  } catch (err) {
    console.error('\nImport failed:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
    console.log('Disconnected from database');
  }
}

importChannels().catch(console.error);
