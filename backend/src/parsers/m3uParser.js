/**
 * FlickTV AI — M3U Playlist Parser
 */
export function parseM3U(content) {
  const channels = [];
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  if (!lines[0]?.startsWith('#EXTM3U')) {
    throw new Error('Invalid M3U: missing #EXTM3U header');
  }

  let current = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXTINF:')) {
      current = parseExtInf(line);
    } else if (!line.startsWith('#') && current) {
      current.stream_url = line;
      current.is_live = isLive(line);
      channels.push(current);
      current = null;
    }
  }

  return channels;
}

function parseExtInf(line) {
  const channel = {
    name: '', tvg_id: null, tvg_name: null,
    logo_url: null, group_title: null, country: null,
    language: null, is_hd: false, is_4k: false, category: 'general',
  };

  const comma = line.lastIndexOf(',');
  if (comma !== -1) channel.name = line.substring(comma + 1).trim();

  const attrs = /(\w[\w-]*)="([^"]*)"/g;
  let m;
  while ((m = attrs.exec(line)) !== null) {
    switch (m[1].toLowerCase()) {
      case 'tvg-id':       channel.tvg_id = m[2] || null; break;
      case 'tvg-name':     channel.tvg_name = m[2] || null; break;
      case 'tvg-logo':     channel.logo_url = m[2] || null; break;
      case 'group-title':  channel.group_title = m[2] || null; break;
      case 'tvg-country':  channel.country = m[2]?.toLowerCase() || null; break;
      case 'tvg-language': channel.language = m[2]?.toLowerCase() || null; break;
    }
  }

  const t = `${channel.name} ${channel.group_title}`.toUpperCase();
  channel.is_4k = /\b(4K|UHD|2160P)\b/.test(t);
  channel.is_hd = channel.is_4k || /\b(HD|FHD|1080[PI]|720P)\b/.test(t);
  channel.category = inferCategory(channel.group_title, channel.name);
  return channel;
}

function inferCategory(group = '', name = '') {
  const t = `${group} ${name}`.toLowerCase();
  if (/news|noticias/.test(t))          return 'news';
  if (/sport|football|soccer|cricket/.test(t)) return 'sports';
  if (/movie|film|cinema/.test(t))      return 'movies';
  if (/kids|children|cartoon|anime/.test(t)) return 'kids';
  if (/music|mtv|hits/.test(t))         return 'music';
  if (/documentary|discovery|nat\s?geo/.test(t)) return 'documentary';
  if (/religious|islamic|christian|quran/.test(t)) return 'religious';
  return 'general';
}

function isLive(url) {
  return url.includes('.m3u8') || url.includes('/live/') ||
         url.includes('udp://') || url.includes('rtp://');
}

export async function parseM3UFromURL(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'FlickTV/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseM3U(await res.text());
}
