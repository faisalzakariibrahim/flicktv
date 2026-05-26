/**
 * FlickTV AI — M3U Playlist Parser
 * Handles M3U, M3U8, extended M3U formats
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
      currentChannel = parseExtInf(line);
    } else if (line.startsWith('#') || !line) {
      continue;
    } else if (currentChannel) {
      currentChannel.stream_url = line;
      currentChannel.is_live = isLiveStream(line);
      channels.push(currentChannel);
      currentChannel = null;
    }
  }

  return channels;
}

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

  const commaIdx = line.lastIndexOf(',');
  if (commaIdx !== -1) {
    channel.name = line.substring(commaIdx + 1).trim();
  }

  const attrRegex = /(\w[\w-]*)="([^"]*)"/g;
  let match;
  while ((match = attrRegex.exec(line)) !== null) {
    const [, key, value] = match;
    switch (key.toLowerCase()) {
      case 'tvg-id':       channel.tvg_id = value || null; break;
      case 'tvg-name':     channel.tvg_name = value || null; break;
      case 'tvg-logo':     channel.logo_url = value || null; break;
      case 'group-title':  channel.group_title = value || null; break;
      case 'tvg-country':  channel.country = value?.toLowerCase() || null; break;
      case 'tvg-language': channel.language = value?.toLowerCase() || null; break;
    }
  }

  const nameUpper = (channel.name + ' ' + channel.group_title).toUpperCase();
  channel.is_4k = /\b(4K|UHD|2160P)\b/.test(nameUpper);
  channel.is_hd = channel.is_4k || /\b(HD|FHD|1080[PI]|720P)\b/.test(nameUpper);
  channel.category = inferCategory(channel.group_title, channel.name);

  return channel;
}

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
