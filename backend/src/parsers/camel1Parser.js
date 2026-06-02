/**
 * FlickTV AI — Camel1.tv Live Match Parser
 * 
 * Scrapes camel1.tv for today's live football matches and extracts
 * direct .m3u8 stream URLs via the public API.
 * 
 * Pipeline:
 *   1. Fetch camel1.tv homepage HTML
 *   2. Extract live match links (/football/.../live/SLUG)
 *   3. For each match, call loadAnchorsByMatchId API to get stream URLs
 *   4. Return channel objects ready for DB insert
 */

const CAMEL_BASE = 'https://www.camel1.tv';
const CAMEL_API = 'https://api.cameltv.live';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

/**
 * Parse the match slug from a camel1.tv match URL
 * e.g. "/football/croatia-vs-belgium/live/vjxm8ghekw8vr6o" -> "vjxm8ghekw8vr6o"
 */
function extractSlug(href) {
  const m = href.match(/\/football\/[^/]+\/live\/([a-z0-9]+)/);
  return m ? m[1] : null;
}

/**
 * Extract team names from match URL slug
 * e.g. "croatia-vs-belgium" -> { home: "Croatia", away: "Belgium" }
 */
function extractTeamsFromHref(href) {
  const m = href.match(/\/football\/([^/]+)\/live\//);
  if (!m) return null;
  const parts = m[1].split('-vs-');
  if (parts.length < 2) return null;
  return {
    home: parts[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    away: parts[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  };
}

/**
 * Step 1: Scrape the camel1.tv homepage for live match links
 * Returns array of { slug, home, away, competition, href }
 */
async function scrapeLiveMatchLinks() {
  const res = await fetch(CAMEL_BASE + '/', {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`camel1.tv homepage HTTP ${res.status}`);
  const html = await res.text();

  // Extract all live match links
  const linkRegex = /href="(\/football\/[^"]+\/live\/[a-z0-9]+)"/g;
  const links = new Map(); // deduplicate by slug
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const slug = extractSlug(href);
    if (!slug || links.has(slug)) continue;

    const teams = extractTeamsFromHref(href);
    if (!teams) continue;

    // Try to extract competition name from surrounding HTML context
    // The competition name appears near the link in the HTML
    const contextStart = Math.max(0, match.index - 300);
    const contextEnd = Math.min(html.length, match.index + href.length + 300);
    const context = html.substring(contextStart, contextEnd);

    // Competition usually appears as text before the match link
    const compMatch = context.match(/competition["\s:]+([^",}]+)/i)
      || context.match(/>([^<]{3,50})<\/h3>/);
    const competition = compMatch ? compMatch[1].trim() : 'Football';

    links.set(slug, {
      slug,
      href,
      home: teams.home,
      away: teams.away,
      competition,
    });
  }

  return Array.from(links.values());
}

/**
 * Step 2: For each match, fetch stream URLs via the API
 */
async function fetchMatchStreams(slug) {
  const url = `${CAMEL_API}/camel-service/ee/sports_live/loadAnchorsByMatchId?matchId=${slug}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Referer': CAMEL_BASE + '/',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.success || !data.detail?.streams?.length) return null;

  return data.detail.streams;
}

/**
 * Main parser: get all live matches with their stream URLs
 */
export async function parseCamel1() {
  const matches = await scrapeLiveMatchLinks();
  if (!matches.length) {
    return { channels: [], message: 'No live matches found on camel1.tv' };
  }

  const channels = [];
  const errors = [];

  for (const match of matches) {
    try {
      const streams = await fetchMatchStreams(match.slug);
      if (!streams || !streams.length) {
        errors.push({ match: `${match.home} vs ${match.away}`, reason: 'No streams available' });
        continue;
      }

      for (const stream of streams) {
        const streamUrl = stream.streamUrlM3u8 || stream.streamUrl;
        if (!streamUrl) continue;

        const name = `${match.home} vs ${match.away}`;
        const isBackup = stream.isBackup === 1;
        const isCustom = stream.isCustom === 1;

        channels.push({
          name: isBackup ? `${name} (Backup)` : name,
          stream_url: streamUrl,
          logo_url: null,
          group_title: match.competition,
          tvg_id: `camel1-${match.slug}`,
          tvg_name: name,
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
            is_backup: isBackup,
            is_custom: isCustom,
          },
        });
      }
    } catch (err) {
      errors.push({ match: `${match.home} vs ${match.away}`, reason: err.message });
    }
  }

  return {
    channels,
    total: channels.length,
    matches: matches.length,
    errors,
  };
}

export default parseCamel1;
