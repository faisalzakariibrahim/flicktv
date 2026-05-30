const fs = require('fs');
const { Client } = require('pg');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const DB_HOST = 'db.smjedhzlzulgewlnbycb.supabase.co';
const DB_PORT = 5432;
const DB_NAME = 'postgres';
const DB_USER = 'postgres';
const DB_PASS = 'areyou@God?1';

const PLEX_PLAYLIST_NAME = 'Plex Live TV';
const PLEX_PLAYLIST_TYPE = 'plex_api';

// ─── PARSE CHANNEL DATA ──────────────────────────────────────────────────────
// Read the raw channel data from the browser extraction
const rawData = fs.readFileSync(__dirname + '/plex_channels_raw.json', 'utf8');

// The data is embedded in a JSON success response, extract the result string
let channelTuples;
try {
  const parsed = JSON.parse(rawData);
  const resultStr = parsed.result || rawData;
  // Result is a string of SQL-like tuples
  channelTuples = resultStr;
} catch (e) {
  // Fallback: treat raw as the tuple data
  channelTuples = rawData;
}

// Parse tuples: ('title','slug','thumb','stream_base','plex_id')
function parseTuples(str) {
  const channels = [];
  // Match each (...) tuple
  const tupleRegex = /\('([^']*(?:''[^']*)*)','([^']*(?:''[^']*)*)','([^']*(?:''[^']*)*)','([^']*(?:''[^']*)*)','([^']*(?:''[^']*)*)'\)/g;
  let match;
  while ((match = tupleRegex.exec(str)) !== null) {
    channels.push({
      name: match[1].replace(/''/g, "'"),
      slug: match[2].replace(/''/g, "'"),
      logo_url: match[3].replace(/''/g, "'"),
      stream_base: match[4].replace(/''/g, "'"),
      plex_id: match[5].replace(/''/g, "'"),
    });
  }
  return channels;
}

const channels = parseTuples(channelTuples);
console.log(`Parsed ${channels.length} Plex channels`);

// Map Plex categories based on slug patterns
function inferCategory(slug) {
  const s = slug.toLowerCase();
  if (s.includes('news') || s.includes('cnn') || s.includes('headline') || s.includes('bbc')) return 'news';
  if (s.includes('sport') || s.includes('fubo') || s.includes('fight') || s.includes('ufc') || s.includes('boxing') || s.includes('mma')) return 'sports';
  if (s.includes('movie') || s.includes('cinema') || s.includes('film') || s.includes('classic')) return 'movies';
  if (s.includes('kid') || s.includes('family') || s.includes('cartoon') || s.includes('boomerang') || s.includes('disney') || s.includes('nick')) return 'kids';
  if (s.includes('music') || s.includes('mtv') || s.includes('vh1') || s.includes('vevo')) return 'music';
  if (s.includes('crime') || s.includes('mystery') || s.includes('investigation')) return 'documentary';
  return 'entertainment';
}

// ─── DATABASE IMPORT ─────────────────────────────────────────────────────────
async function importChannels() {
  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASS,
    ssl: { rejectUnauthorized: false },
  });
  
  await client.connect();
  console.log('Connected to Supabase');
  
  try {
    // Step 1: Create a playlist for Plex channels
    const playlistResult = await client.query(`
      INSERT INTO playlists (name, type, channel_count, is_active, sync_status, metadata)
      VALUES ($1, $2, $3, true, $4, $5)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [PLEX_PLAYLIST_NAME, PLEX_PLAYLIST_TYPE, channels.length, 'ok', JSON.stringify({ source: 'plex.tv', url: 'https://watch.plex.tv/live-tv', scraped_at: new Date().toISOString() })]);
    
    let playlistId;
    if (playlistResult.rows.length > 0) {
      playlistId = playlistResult.rows[0].id;
      console.log(`Created playlist: ${playlistId}`);
    } else {
      // Get existing playlist
      const existing = await client.query(`SELECT id FROM playlists WHERE name = $1`, [PLEX_PLAYLIST_NAME]);
      playlistId = existing.rows[0]?.id;
      console.log(`Using existing playlist: ${playlistId}`);
    }
    
    if (!playlistId) {
      throw new Error('Could not find or create playlist');
    }
    
    // Step 2: Delete old Plex channels for this playlist to avoid duplicates
    await client.query(`DELETE FROM channels WHERE playlist_id = $1`, [playlistId]);
    console.log('Cleared old Plex channels');
    
    // Step 3: Insert channels in batches
    const BATCH_SIZE = 100;
    let inserted = 0;
    
    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
      const batch = channels.slice(i, i + BATCH_SIZE);
      const values = [];
      const params = [];
      let pIdx = 1;
      
      for (const ch of batch) {
        const category = inferCategory(ch.slug);
        values.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9}, $${pIdx + 10}, $${pIdx + 11})`);
        params.push(
          playlistId,           // playlist_id
          null,                 // user_id (nullable, no RLS bypass needed for backend)
          ch.name,              // name
          ch.stream_base,       // stream_url (base URL, tokens added at playback)
          ch.logo_url,          // logo_url
          'Plex Live TV',       // group_title
          ch.plex_id,           // tvg_id
          ch.name,              // tvg_name
          'US',                 // country
          'en',                 // language
          category,             // category
          ch.slug               // stream_info->>'slug'
        );
        pIdx += 12;
      }
      
      // Build the query with stream_info as JSONB
      const queryText = `
        INSERT INTO channels (playlist_id, user_id, name, stream_url, logo_url, group_title, tvg_id, tvg_name, country, language, category, stream_info)
        VALUES ${values.map((v, idx) => {
          // Replace the stream_info param with a JSONB object
          const base = v.replace(`$${12 * (idx + 1)}`, `jsonb_build_object('slug', $${12 * (idx + 1)}, 'source', 'plex', 'scraped_at', NOW()::text)`);
          return base;
        }).join(', ')}
      `;
      
      await client.query(queryText, params);
      inserted += batch.length;
      console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${inserted}/${channels.length} channels`);
    }
    
    // Step 4: Update playlist channel count
    await client.query(`UPDATE playlists SET channel_count = $1, last_synced = NOW(), updated_at = NOW() WHERE id = $2`, [inserted, playlistId]);
    
    console.log(`\nDone! Imported ${inserted} Plex channels into playlist "${PLEX_PLAYLIST_NAME}" (${playlistId})`);
    
  } catch (err) {
    console.error('Import failed:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
    console.log('Disconnected');
  }
}

importChannels();
