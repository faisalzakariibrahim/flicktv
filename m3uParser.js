/**
 * FlickTV AI — M3U Playlist Parser
 * Handles M3U, M3U8, extended M3U formats
 */

/**
 * Parse an M3U playlist string into structured channel objects.
 * @param {string} content - Raw M3U content
 * @returns {Array} Array of channel objects
 */
export function parseM3U(content) {
  const channels = [];
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  if (!lines[0]?.startsWith('#EXTM3U')) {
    throw new Error('Invalid M3U format: missing #EXTM3U header');
  }

  let currentChannel = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXTINF:')) {
      // Parse metadata line
      currentChannel = parseExtInf(line);
    } else if (line.startsWith('#') || !line) {
      // Skip other directives / empty lines
      continue;
    } else if (currentChannel) {
      // This is the stream URL
      currentChannel.stream_url = line;
      currentChannel.is_live = isLiveStream(line);
      channels.push(currentChannel);
      currentChannel = null;
    }
  }

  return channels;
}

/**
 * Parse an #EXTINF line into a channel object.
 * Example: #EXTINF:-1 tvg-id="CNN" tvg-name="CNN" tvg-logo="..." group-title="News",CNN
 */
function parseExtInf(line) {
  const channel = {
    name: '',
    tvg_id: null,
    tvg_name: null,
    logo_url: null,
    group_title: null,
    country: null,
    language: null,
    is_hd: false,
    is_4k: false,
  };

  // Extract display name (after last comma)
  const commaIdx = line.lastIndexOf(',');
  if (commaIdx !== -1) {
    channel.name = line.substring(commaIdx + 1).trim();
  }

  // Extract attributes
  const attrRegex = /(\w[\w-]*)="([^"]*)"/g;
  let match;
  while ((match = attrRegex.exec(line)) !== null) {
    const [, key, value] = match;
    switch (key.toLowerCase()) {
      case 'tvg-id':      channel.tvg_id = value || null; break;
      case 'tvg-name':    channel.tvg_name = value || null; break;
      case 'tvg-logo':    channel.logo_url = value || null; break;
      case 'group-title': channel.group_title = value || null; break;
      case 'tvg-country': channel.country = value?.toLowerCase() || null; break;
      case 'tvg-language':channel.language = value?.toLowerCase() || null; break;
    }
  }

  // Infer HD/4K from name or group
  const nameUpper = (channel.name + ' ' + channel.group_title).toUpperCase();
  channel.is_4k = /\b(4K|UHD|2160P)\b/.test(nameUpper);
  channel.is_hd = channel.is_4k || /\b(HD|FHD|1080[PI]|720P)\b/.test(nameUpper);

  // Infer category from group
  channel.category = inferCategory(channel.group_title, channel.name);

  return channel;
}

/**
 * Infer channel category from group title and name.
 */
function inferCategory(group, name) {
  const text = ((group || '') + ' ' + (name || '')).toLowerCase();

  if (/news|noticias|nachrichten|nouvelles/.test(text)) return 'news';
  if (/sport|football|soccer|basketball|cricket|tennis|golf/.test(text)) return 'sports';
  if (/movie|film|cinema|kino/.test(text)) return 'movies';
  if (/kids|children|cartoon|anime|junior/.test(text)) return 'kids';
  if (/music|mtv|vevo|hits/.test(text)) return 'music';
  if (/documentary|discovery|national geographic|history/.test(text)) return 'documentary';
  if (/religious|islamic|christian|church|quran/.test(text)) return 'religious';
  if (/entertain|general|variety/.test(text)) return 'entertainment';

  return 'general';
}

/**
 * Determine if URL is likely a live stream vs VOD.
 */
function isLiveStream(url) {
  return (
    url.includes('.m3u8') ||
    url.includes(':8080') ||
    url.includes('/live/') ||
    url.includes('/stream') ||
    url.includes('udp://') ||
    url.includes('rtp://')
  );
}

/**
 * Parse M3U URL (fetches and parses).
 */
export async function parseM3UFromURL(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch M3U: HTTP ${response.status}`);
  }
  const content = await response.text();
  return parseM3U(content);
}

export default { parseM3U, parseM3UFromURL };
