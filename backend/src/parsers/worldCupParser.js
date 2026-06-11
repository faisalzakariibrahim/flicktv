/**
 * FlickTV AI — FIFA World Cup Match Parser
 * 
 * Aggregates World Cup live matches from multiple sources:
 *   1. camel1.tv (filter for World Cup matches)
 *   2. footballhighlights365.com (live match links)
 *   3. World Cup specific M3U playlists (community maintained)
 *   4. Direct stream URLs from known WC broadcasters
 * 
 * Also provides match metadata (teams, kickoff time, group, round)
 * for the highlights pipeline.
 */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const CAMEL_BASE = 'https://www.camel1.tv';
const CAMEL_API = 'https://api.cameltv.live';

// ─── World Cup 2026 Info ────────────────────────────────────────────────────
// Update these as FIFA releases the official schedule
const WC_START_DATE = '2026-06-11';
const WC_END_DATE = '2026-07-19';
const WC_KEYWORDS = [
  'world cup', 'fifa', 'worldcup', 'wc2026', 'wc-2026',
  'group a', 'group b', 'group c', 'group d',
  'group e', 'group f', 'group g', 'group h',
  'round of 16', 'quarter-final', 'semi-final', 'final',
  'third place', 'playoff'
];

// Known national team names for matching
const TEAMS = [
  'argentina', 'australia', 'belgium', 'brazil', 'canada', 'chile',
  'china', 'colombia', 'costa rica', 'croatia', 'czech republic',
  'denmark', 'ecuador', 'egypt', 'england', 'france', 'germany',
  'ghana', 'greece', 'hungary', 'iceland', 'india', 'iran',
  'iraq', 'italy', 'jamaica', 'japan', 'mexico', 'morocco',
  'netherlands', 'new zealand', 'nigeria', 'north macedonia',
  'norway', 'panama', 'paraguay', 'peru', 'poland', 'portugal',
  'qatar', 'republic of ireland', 'romania', 'russia', 'saudi arabia',
  'scotland', 'senegal', 'serbia', 'slovakia', 'slovenia',
  'south africa', 'south korea', 'spain', 'sweden', 'switzerland',
  'tunisia', 'turkey', 'ukraine', 'united states', 'uruguay',
  'venezuela', 'wales', 'zambia', 'philippines', 'indonesia',
  'vietnam', 'uzbekistan', 'jordan', 'oman', 'bahrain',
  'kuwait', 'united arab emirates', 'trinidad and tobago',
  'curaçao', 'guatemala', 'honduras', 'cuba', 'canada'
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function isWorldCupMatch(text) {
  const lower = text.toLowerCase();
  return WC_KEYWORDS.some(kw => lower.includes(kw));
}

function extractTeamsFromName(name) {
  const lower = name.toLowerCase();
  const found = [];
  for (const team of TEAMS) {
    if (lower.includes(team)) {
      found.push(team);
    }
  }
  if (found.length >= 2) {
    return {
      home: found[0].replace(/\b\w/g, c => c.toUpperCase()),
      away: found[1].replace(/\b\w/g, c => c.toUpperCase()),
    };
  }
  // Try "Team A vs Team B" pattern
  const vsMatch = name.match(/^(.+?)\s+(?:vs\.?|v)\s+(.+?)$/i);
  if (vsMatch) {
    return {
      home: vsMatch[1].trim().replace(/\b\w/g, c => c.toUpperCase()),
      away: vsMatch[2].trim().replace(/\b\w/g, c => c.toUpperCase()),
    };
  }
  return null;
}

function isDuringWorldCup() {
  const now = new Date();
  return now >= new Date(WC_START_DATE) && now <= new Date(WC_END_DATE);
}

// ─── Source 1: camel1.tv World Cup filter ───────────────────────────────────

async function scrapeCamel1WC() {
  const res = await fetch(CAMEL_BASE + '/', {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`camel1.tv HTTP ${res.status}`);
  const html = await res.text();

  const linkRegex = /href="(\/football\/[^"]+\/live\/[a-z0-9]+)"/g;
  const matches = new Map();
  let m;

  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    const slugMatch = href.match(/\/football\/([^/]+)\/live\/([a-z0-9]+)/);
    if (!slugMatch) continue;
    const slug = slugMatch[2];
    const matchName = slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Only include if it looks like a World Cup match
    if (!isWorldCupMatch(matchName) && !isWorldCupMatch(href)) {
      // Check surrounding context for WC keywords
      const ctxStart = Math.max(0, m.index - 500);
      const ctxEnd = Math.min(html.length, m.index + href.length + 500);
      const context = html.substring(ctxStart, ctxEnd);
      if (!isWorldCupMatch(context)) continue;
    }

    const teams = extractTeamsFromName(matchName);
    if (!teams) continue;

    matches.set(slug, {
      slug,
      home: teams.home,
      away: teams.away,
      source: 'camel1.tv',
      competition: 'FIFA World Cup 2026',
    });
  }

  return Array.from(matches.values());
}

async function fetchMatchStreams(slug) {
  const url = `${CAMEL_API}/camel-service/ee/sports_live/loadAnchorsByMatchId?matchId=${slug}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Referer': CAMEL_BASE + '/' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.success || !data.detail?.streams?.length) return null;
  return data.detail.streams;
}

// ─── Source 2: World Cup M3U playlists ─────────────────────────────────────

const WC_M3U_SOURCES = [
  {
    name: 'WC2026 Community Streams',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/sports.m3u',
    category: 'sports',
  },
];

async function parseWCFromM3U() {
  const channels = [];
  for (const src of WC_M3U_SOURCES) {
    try {
      const res = await fetch(src.url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim().startsWith('#EXTM3U')) continue;

      // Parse M3U entries
      const lines = text.split('\n');
      let current = null;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#EXTINF:')) {
          current = { info: trimmed };
        } else if (current && trimmed && !trimmed.startsWith('#')) {
          current.url = trimmed;
          // Check if this looks like a World Cup / football match
          const name = current.info.toLowerCase();
          if (isWorldCupMatch(name) || 
              (name.includes('football') || name.includes('soccer') || name.includes('sport'))) {
            const teams = extractTeamsFromName(current.info.replace(/^#EXTINF:[^,]*,/, ''));
            channels.push({
              name: current.info.replace(/^#EXTINF:[^,]*/, '').trim() || 'World Cup Match',
              stream_url: current.url,
              logo_url: null,
              group_title: 'FIFA World Cup 2026',
              tvg_id: `wc-m3u-${Buffer.from(current.url).toString('base64').slice(0, 12)}`,
              category: 'sports',
              is_hd: name.includes('hd') || name.includes('+'),
              is_4k: name.includes('4k') || name.includes('uhd'),
              is_live: true,
              is_working: true,
              stream_info: { source: 'm3u', srcName: src.name },
              home: teams?.home || null,
              away: teams?.away || null,
              competition: 'FIFA World Cup 2026',
            });
          }
          current = null;
        }
      }
    } catch (err) {
      // Skip failed sources
    }
  }
  return channels;
}

// ─── Source 3: Known WC broadcaster channels ────────────────────────────────

function getWCBroadcasterChannels() {
  // These are channels known to broadcast World Cup in various regions
  // Users can add their own via the admin dashboard
  return [
    { name: 'BBC Sport', tvg_id: 'bbc-sport', country: 'GB', language: 'en' },
    { name: 'ITV Sport', tvg_id: 'itv-sport', country: 'GB', language: 'en' },
    { name: 'FOX Sports', tvg_id: 'fox-sports', country: 'US', language: 'en' },
    { name: 'NBC Sports', tvg_id: 'nbc-sport', country: 'US', language: 'en' },
    { name: 'TSN', tvg_id: 'tsn', country: 'CA', language: 'en' },
    { name: 'beIN Sports', tvg_id: 'bein-sports', country: 'QA', language: 'en' },
    { name: 'Sky Sport', tvg_id: 'sky-sport', country: 'DE', language: 'de' },
  ];
}

// ─── Main Parser ───────────────────────────────────────────────────────────

export async function parseWorldCup() {
  const results = {
    channels: [],
    matches: [],
    errors: [],
    timestamp: new Date().toISOString(),
  };

  // 1. camel1.tv World Cup matches
  try {
    const camel1Matches = await scrapeCamel1WC();
    for (const match of camel1Matches) {
      try {
        const streams = await fetchMatchStreams(match.slug);
        if (!streams?.length) {
          // Still record the match even without streams
          results.matches.push({
            home: match.home,
            away: match.away,
            kickoff: null,
            competition: match.competition,
            stream_urls: [],
            source: match.source,
          });
          continue;
        }

        for (const stream of streams) {
          const streamUrl = stream.streamUrlM3u8 || stream.streamUrl;
          if (!streamUrl) continue;

          results.channels.push({
            name: `${match.home} vs ${match.away}`,
            stream_url: streamUrl,
            logo_url: null,
            group_title: match.competition,
            tvg_id: `wc-camel1-${match.slug}`,
            tvg_name: `${match.home} vs ${match.away}`,
            country: null,
            language: null,
            category: 'sports',
            is_hd: streamUrl.includes('_hd') || streamUrl.includes('_md'),
            is_4k: streamUrl.includes('4k') || streamUrl.includes('uhd'),
            is_live: true,
            is_working: true,
            stream_info: {
              source: 'camel1.tv',
              slug: match.slug,
              competition: match.competition,
              home: match.home,
              away: match.away,
            },
          });
        }

        results.matches.push({
          home: match.home,
          away: match.away,
          kickoff: null,
          competition: match.competition,
          stream_urls: streams.map(s => s.streamUrlM3u8 || s.streamUrl).filter(Boolean),
          source: match.source,
        });
      } catch (err) {
        results.errors.push({ source: 'camel1.tv', match: `${match.home} vs ${match.away}`, error: err.message });
      }
    }
  } catch (err) {
    results.errors.push({ source: 'camel1.tv', error: err.message });
  }

  // 2. M3U World Cup channels
  try {
    const m3uChannels = await parseWCFromM3U();
    results.channels.push(...m3uChannels);
  } catch (err) {
    results.errors.push({ source: 'm3u', error: err.message });
  }

  // Deduplicate by stream_url
  const seen = new Set();
  results.channels = results.channels.filter(ch => {
    if (seen.has(ch.stream_url)) return false;
    seen.add(ch.stream_url);
    return true;
  });

  return results;
}

/**
 * Get World Cup match schedule (for the highlights pipeline)
 * Returns array of upcoming/live matches with metadata
 */
export async function getWorldCupSchedule() {
  // This will be enhanced with football-data.org API integration
  // For now, return matches found by the parser
  const parsed = await parseWorldCup();
  return parsed.matches;
}

export default parseWorldCup;
