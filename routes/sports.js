import { Router } from 'express';
import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

const router = Router();

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const LEAGUE_MAP = {
  soccer: [
    { id: 'eng.1',           name: 'Premier League',     flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { id: 'esp.1',           name: 'La Liga',             flag: '🇪🇸' },
    { id: 'ger.1',           name: 'Bundesliga',          flag: '🇩🇪' },
    { id: 'ita.1',           name: 'Serie A',             flag: '🇮🇹' },
    { id: 'fra.1',           name: 'Ligue 1',             flag: '🇫🇷' },
    { id: 'uefa.champions',  name: 'Champions League',    flag: '⭐' },
    { id: 'uefa.europa',     name: 'Europa League',       flag: '🟠' },
    { id: 'usa.1',           name: 'MLS',                 flag: '🇺🇸' },
    { id: 'sau.1',           name: 'Saudi Pro League',    flag: '🇸🇦' },
    { id: 'egy.1',           name: 'Egyptian Premier',    flag: '🇪🇬' },
    { id: 'all',             name: 'All Soccer',          flag: '⚽' },
  ],
  basketball: [
    { id: 'nba',             name: 'NBA',                 flag: '🏀' },
    { id: 'mens-college-basketball', name: 'NCAA',        flag: '🎓' },
  ],
  'american-football': [
    { id: 'nfl',             name: 'NFL',                 flag: '🏈' },
  ],
  hockey: [
    { id: 'nhl',             name: 'NHL',                 flag: '🏒' },
  ],
  tennis: [
    { id: 'tennis',          name: 'Tennis',              flag: '🎾' },
  ],
};

// Known sports channel stream URLs (from public iptv-org playlists)
const CHANNEL_STREAMS = {
  'Premier League':    'https://iptv-org.github.io/iptv/categories/sports.m3u',
  'Champions League':  'https://iptv-org.github.io/iptv/categories/sports.m3u',
  'La Liga':           'https://iptv-org.github.io/iptv/categories/sports.m3u',
  'NBA':               'https://iptv-org.github.io/iptv/categories/sports.m3u',
  'NFL':               'https://iptv-org.github.io/iptv/categories/sports.m3u',
};

function normaliseEvent(e, sport, leagueName, leagueFlag) {
  const competitors = e.competitions?.[0]?.competitors || [];
  const home = competitors.find(c => c.homeAway === 'home');
  const away = competitors.find(c => c.homeAway === 'away');
  const status = e.status?.type;

  return {
    id: e.id,
    sport,
    league: leagueName,
    leagueFlag,
    name: e.name || e.shortName,
    shortName: e.shortName,
    homeTeam: home?.team?.displayName || '',
    homeLogo: home?.team?.logo || '',
    homeScore: home?.score ?? null,
    awayTeam: away?.team?.displayName || '',
    awayLogo: away?.team?.logo || '',
    awayScore: away?.score ?? null,
    startTime: e.date,
    statusText: status?.shortDetail || status?.description || '',
    isLive: status?.state === 'in',
    isFinished: status?.state === 'post',
    isScheduled: status?.state === 'pre',
    thumbnail: e.competitions?.[0]?.details?.[0]?.athletesInvolved?.[0]?.headshot?.href || null,
    venueCity: e.competitions?.[0]?.venue?.address?.city || '',
  };
}

async function fetchLeague(sport, leagueId, leagueName, leagueFlag) {
  try {
    const sportPath = sport === 'soccer' ? 'soccer' : sport;
    const url = leagueId === 'all'
      ? `${ESPN_BASE}/${sportPath}/all/scoreboard`
      : `${ESPN_BASE}/${sportPath}/${leagueId}/scoreboard`;

    const res = await fetch(url, { headers: { 'User-Agent': 'FlickTV/1.0' } });
    if (!res.ok) return [];

    const data = await res.json();
    return (data.events || []).map(e => normaliseEvent(e, sport, leagueName, leagueFlag));
  } catch {
    return [];
  }
}

// GET /api/sports/schedule?sport=soccer&league=eng.1
router.get('/schedule', async (req, res) => {
  const { sport = 'soccer', league } = req.query;
  const sportLeagues = LEAGUE_MAP[sport] || LEAGUE_MAP.soccer;

  try {
    let events = [];

    if (league && league !== 'all') {
      const def = sportLeagues.find(l => l.id === league);
      if (def) {
        events = await fetchLeague(sport, def.id, def.name, def.flag);
      }
    } else {
      // Fetch top leagues in parallel, dedupe by event id
      const results = await Promise.all(
        sportLeagues.slice(0, 5).map(l => fetchLeague(sport, l.id, l.name, l.flag))
      );
      const seen = new Set();
      for (const batch of results) {
        for (const ev of batch) {
          if (!seen.has(ev.id)) { seen.add(ev.id); events.push(ev); }
        }
      }
    }

    // Sort: live first, then scheduled by time, finished last
    events.sort((a, b) => {
      const order = v => v.isLive ? 0 : v.isScheduled ? 1 : 2;
      if (order(a) !== order(b)) return order(a) - order(b);
      return new Date(a.startTime) - new Date(b.startTime);
    });

    res.json({ events, count: events.length });
  } catch (err) {
    logger.error('Sports schedule error', err);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// GET /api/sports/leagues — available sports & leagues
router.get('/leagues', (_req, res) => {
  res.json({ sports: Object.entries(LEAGUE_MAP).map(([sport, leagues]) => ({ sport, leagues })) });
});

export default router;
