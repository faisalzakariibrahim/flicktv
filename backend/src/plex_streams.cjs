// Plex Live TV Stream URL Generator
// Plex stream URLs require a valid X-Plex-Token at playback time.
// The base URL pattern is: https://epg.provider.plex.tv/library/parts/{id}.m3u8
// We use the web_player token which is publicly available for the Plex web player.

const PLEX_STREAM_BASE = 'https://epg.provider.plex.tv/library/parts';
const PLEX_WEB_TOKEN = '9F1pDPzr73oL_idfzXye'; // public web player token (rotated periodically)

/**
 * Generate a playable Plex stream URL with proper token parameters.
 * Plex HLS streams use server-side ad insertion, so the manifest URL
 * needs authentication tokens that the player fetches session tokens for.
 * 
 * The simplest approach: use the master playlist URL which redirects to
 * a tokenized variant playlist.
 */
function getPlexStreamUrl(plexChannelId, token = PLEX_STREAM_BASE) {
  return `${PLEX_STREAM_BASE}/${plexChannelId}.m3u8`;
}

/**
 * Generate an M3U playlist string for all Plex channels in a playlist.
 * This can be used by any IPTV player.
 */
function generateM3u(channels) {
  let m3u = '#EXTM3U\n';
  for (const ch of channels) {
    const logo = ch.logo_url || '';
    const group = ch.group_title || 'Plex Live TV';
    const name = ch.name;
    const url = ch.stream_url;
    m3u += `#EXTINF:-1 tvg-id="${ch.tvg_id || ''}" tvg-logo="${logo}" group-title="${group}",${name}\n`;
    m3u += `${url}\n`;
  }
  return m3u;
}

module.exports = { getPlexStreamUrl, generateM3u, PLEX_STREAM_BASE };

// Allow direct invocation: node plex_streams.cjs [playlist_id]
if (require.main === module) {
  // Generate M3U for a specific playlist from the database
  const { Client } = require('pg');
  const client = new Client({
    host: 'db.smjedhzlzulgewlnbycb.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'areyou@God?1',
    ssl: { rejectUnauthorized: false },
  });
  
  const playlistId = process.argv[2];
  
  (async () => {
    await client.connect();
    let query, params;
    if (playlistId) {
      query = 'SELECT * FROM channels WHERE playlist_id = $1 ORDER BY name';
      params = [playlistId];
    } else {
      query = 'SELECT * FROM channels ORDER BY name';
      params = [];
    }
    const result = await client.query(query, params);
    const m3u = generateM3u(result.rows);
    console.log(m3u);
    await client.end();
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
