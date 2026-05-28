/**
 * Fetch live channels from Pluto TV (public API) plus priority streams
 * (NBC News NOW, ABC News Live, CBS News, etc.).
 * Skips any stream_url already in the DB to prevent duplicates.
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { realtime: { transport: WebSocket } }
);

const TIMEOUT_MS  = 8000;
const CONCURRENCY = 12;

// ─── Priority streams — tested direct HLS URLs ────────────────────────────────
const PRIORITY = [
  {
    name: 'ABC News Live',
    stream_url: 'https://abcnews-streams.akamaized.net/hls/live/2023560/abcnewshudson1/master_4000.m3u8',
    category: 'news', country: 'US', is_hd: true,
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/ABC_News_logo_2013.png/120px-ABC_News_logo_2013.png',
  },
  {
    name: 'CBS News 24/7',
    stream_url: 'https://jmp2.uk/plu-6350fdd266e9ea0007bedec5.m3u8',
    category: 'news', country: 'US', is_hd: true,
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/CBS_News.svg/120px-CBS_News.svg.png',
  },
  {
    name: 'CBS News New York',
    stream_url: 'https://cbsn-ny.cbsnstream.cbsnews.com/out/v1/ec3897d58a9b45129a77d67aa247d136/master.m3u8',
    category: 'news', country: 'US', is_hd: true,
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/CBS_News.svg/120px-CBS_News.svg.png',
  },
  {
    name: 'CBS News Chicago',
    stream_url: 'https://cbsn-chi.cbsnstream.cbsnews.com/out/v1/b2fc0d5715d54908adf07f97d2616646/master.m3u8',
    category: 'news', country: 'US', is_hd: true,
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/CBS_News.svg/120px-CBS_News.svg.png',
  },
  {
    name: 'AccuWeather Now',
    stream_url: 'https://cdn-ue1-prod.tsv2.amagi.tv/linear/amg00684-accuweather-accuweather-plex/playlist.m3u8',
    category: 'news', country: 'US', is_hd: false,
    logo_url: null,
  },
  {
    name: 'Bloomberg Originals',
    stream_url: 'https://86fdc85a.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfQmxvb21iZXJnT3JpZ2luYWxzX0hMUw/playlist.m3u8',
    category: 'news', country: 'US', is_hd: true,
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Bloomberg_logo.svg/120px-Bloomberg_logo.svg.png',
  },
];

// ─── Pluto TV category → FlickTV category ────────────────────────────────────
const CAT_MAP = {
  'News':                 'news',
  'Sports':               'sports',
  'Movies':               'movies',
  'Entertainment':        'entertainment',
  'Kids & Family':        'kids',
  'Kids':                 'kids',
  'Music':                'music',
  'Comedy':               'entertainment',
  'Drama':                'movies',
  'Reality':              'entertainment',
  'Science & Technology': 'documentary',
  'Food':                 'entertainment',
  'Lifestyle':            'entertainment',
  'Crime':                'documentary',
  'History':              'documentary',
  'Animals & Nature':     'documentary',
  'Automotive':           'entertainment',
  'Travel':               'documentary',
  'Business':             'news',
  'Weather':              'news',
  'Latino':               'entertainment',
  'Spanish':              'entertainment',
  'Faith & Spirituality': 'entertainment',
  'Español':              'entertainment',
};

function mapCat(cat) {
  return CAT_MAP[cat] || 'entertainment';
}

// Build a Pluto TV stream URL that works without auth headers
function buildPlutoUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.searchParams.set('appName', 'web');
    u.searchParams.set('appVersion', '5.11.0');
    u.searchParams.set('deviceDNT', '0');
    u.searchParams.set('deviceId', 'web-flicktv');
    u.searchParams.set('deviceMake', 'Chrome');
    u.searchParams.set('deviceModel', 'web');
    u.searchParams.set('deviceType', 'web');
    u.searchParams.set('deviceVersion', 'unknown');
    u.searchParams.set('marketingRegion', 'US');
    u.searchParams.set('sid', 'flicktv-session');
    return u.toString();
  } catch {
    return rawUrl;
  }
}

async function testStream(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
    });
    clearTimeout(t);
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('mpegurl') || ct.includes('video') || ct.includes('octet') || url.includes('.m3u8');
  } catch {
    clearTimeout(t);
    return false;
  }
}

async function runBatch(items, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    results.push(...await Promise.all(items.slice(i, i + CONCURRENCY).map(fn)));
  }
  return results;
}

async function fetchPlutoTV() {
  console.log('\n[Pluto TV] Fetching channel list…');
  try {
    const res = await fetch('https://api.pluto.tv/v2/channels.json', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Origin': 'https://pluto.tv',
        'Referer': 'https://pluto.tv/',
      },
    });
    if (!res.ok) { console.log(`  HTTP ${res.status}`); return []; }
    const channels = await res.json();
    console.log(`  ${channels.length} channels in API`);

    const ADULT = ['adult', 'xxx', '18+', 'erotic', 'porn', 'sex'];
    const parsed = channels
      .filter(ch => {
        if (!ch.name || !ch.stitched?.urls?.length) return false;
        const low = (ch.name + ' ' + (ch.category || '')).toLowerCase();
        return !ADULT.some(k => low.includes(k));
      })
      .map(ch => {
        const rawUrl = ch.stitched.urls[0].url;
        return {
          name: ch.name.trim(),
          stream_url: buildPlutoUrl(rawUrl),
          logo_url: ch.colorLogoPNG?.path || ch.logo?.path || ch.thumbnail?.path || null,
          category: mapCat(ch.category),
          country: 'US',
          language: 'eng',
          group_title: `Pluto TV — ${ch.category || 'Entertainment'}`,
          tvg_id: ch._id || null,
          tvg_name: ch.name || null,
          is_hd: false,
          is_4k: false,
          is_live: true,
          is_working: true,
          user_id: null,
        };
      });

    console.log(`  Testing ${parsed.length} Pluto TV streams (CONCURRENCY=${CONCURRENCY})…`);
    let pass = 0;
    const results = await runBatch(parsed, async ch => {
      const ok = await testStream(ch.stream_url);
      process.stdout.write(ok ? '✓' : '.');
      if (ok) pass++;
      return ok ? ch : null;
    });
    const working = results.filter(Boolean);
    console.log(`\n  → ${working.length} / ${parsed.length} Pluto TV channels working`);
    return working;
  } catch (e) {
    console.log(`  Failed: ${e.message}`);
    return [];
  }
}

async function main() {
  console.log('=== FlickTV Platform Channel Fetcher ===\n');

  const { data: existing } = await supabase
    .from('channels').select('stream_url').is('user_id', null);
  const existingUrls = new Set((existing || []).map(r => r.stream_url));
  console.log(`Existing channels in DB: ${existingUrls.size}`);

  const toInsert = [];

  // ── Priority streams ──────────────────────────────────────────────────────
  console.log('\nTesting priority streams:');
  for (const ch of PRIORITY) {
    process.stdout.write(`  ${ch.name.padEnd(25)} `);
    if (existingUrls.has(ch.stream_url)) { console.log('(already in DB)'); continue; }
    const ok = await testStream(ch.stream_url);
    console.log(ok ? '✓' : '✗');
    if (ok) toInsert.push({ ...ch, is_live: true, is_working: true, user_id: null });
  }

  // ── Pluto TV ──────────────────────────────────────────────────────────────
  const pluto = await fetchPlutoTV();
  for (const ch of pluto) {
    if (!existingUrls.has(ch.stream_url)) toInsert.push(ch);
  }

  if (!toInsert.length) { console.log('\nNo new channels to add.'); return; }

  // Dedup within batch
  const seen = new Set();
  const deduped = toInsert.filter(ch => {
    if (seen.has(ch.stream_url)) return false;
    seen.add(ch.stream_url); return true;
  });

  console.log(`\nInserting ${deduped.length} new channels…`);
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < deduped.length; i += CHUNK) {
    const { error } = await supabase.from('channels').insert(deduped.slice(i, i + CHUNK));
    if (error && !error.message?.includes('duplicate')) console.error('Insert error:', error.message);
    else inserted += deduped.slice(i, i + CHUNK).length;
  }

  const { count } = await supabase
    .from('channels').select('id', { count: 'exact', head: true }).is('user_id', null);

  console.log(`\n✓ Inserted ${inserted} new channels`);
  console.log(`Total channels in DB: ${count}`);
}

main().catch(console.error);
