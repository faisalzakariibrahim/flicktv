/**
 * Fetch iptv-org category playlists, test each stream, collect working ones.
 * Target: 6-8 per category, ~50 total.
 */

import fetch from 'node-fetch';
import { parseM3U } from '../parsers/m3uParser.js';

const RAILWAY = 'https://flicktv-production.up.railway.app';
const TIMEOUT_MS = 8000;
const PER_CATEGORY = 8;

const SOURCES = [
  { category: 'news',          url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
  { category: 'sports',        url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
  { category: 'movies',        url: 'https://iptv-org.github.io/iptv/categories/movies.m3u' },
  { category: 'entertainment', url: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u' },
  { category: 'kids',          url: 'https://iptv-org.github.io/iptv/categories/kids.m3u' },
  { category: 'music',         url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
  { category: 'documentary',   url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u' },
];

// Well-known reliable channels to always include
const PRIORITY = [
  { name: 'Al Jazeera English', stream_url: 'https://live-hls-web-aje.getaj.net/AJE/01.m3u8', category: 'news', logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Aljazeera_eng.svg/200px-Aljazeera_eng.svg.png', country: 'QA', is_hd: true },
  { name: 'France 24 English',  stream_url: 'https://static.france24.com/live/F24_EN_LO_HLS/live_ios/master.m3u8', category: 'news', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/France_24_Logo.svg/200px-France_24_Logo.svg.png', country: 'FR', is_hd: true },
  { name: 'DW English',         stream_url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8', category: 'news', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/200px-Deutsche_Welle_symbol_2012.svg.png', country: 'DE', is_hd: true },
  { name: 'NASA TV',            stream_url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8', category: 'documentary', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/200px-NASA_logo.svg.png', country: 'US', is_hd: true },
  { name: 'Euronews English',   stream_url: 'https://euronews-euronews-1-eu.rakuten.wurl.tv/playlist.m3u8', category: 'news', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Euronews_2022.svg/200px-Euronews_2022.svg.png', country: 'FR', is_hd: false },
  { name: 'Sky News',           stream_url: 'https://skynews-i.akamaihd.net/hls/live/561033/skynews/skynews_1100k/master.m3u8', category: 'news', logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/80/Sky_News_logo.svg/200px-Sky_News_logo.svg.png', country: 'GB', is_hd: true },
  { name: 'NHK World',         stream_url: 'https://nhkwlive-ojp.akamaized.net/hls/live/2003459/nhkwlive-ojp-en/index.m3u8', category: 'news', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/NHK_World_logo.svg/200px-NHK_World_logo.svg.png', country: 'JP', is_hd: true },
  { name: 'CGTN',              stream_url: 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8', category: 'news', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/CGTN_logo.svg/200px-CGTN_logo.svg.png', country: 'CN', is_hd: true },
];

async function testStream(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const proxied = `${RAILWAY}/api/proxy/stream?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxied, { method: 'GET', signal: controller.signal });
    clearTimeout(t);
    const ct = res.headers.get('content-type') || '';
    const ok = res.ok && (ct.includes('mpegurl') || ct.includes('video') || ct.includes('octet') || url.includes('.m3u8'));
    return ok;
  } catch {
    clearTimeout(t);
    return false;
  }
}

async function fetchAndTest(source) {
  console.log(`\nFetching ${source.category}…`);
  let channels = [];
  try {
    const res = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await res.text();
    channels = parseM3U(text);
  } catch (e) {
    console.log(`  Failed to fetch: ${e.message}`);
    return [];
  }
  console.log(`  Parsed ${channels.length} channels, testing…`);

  const working = [];
  // Shuffle to get variety, not just alphabetical first
  const shuffled = channels.sort(() => Math.random() - 0.5);

  for (const ch of shuffled) {
    if (working.length >= PER_CATEGORY) break;
    if (!ch.stream_url || !ch.name) continue;
    process.stdout.write(`  Testing ${ch.name.slice(0, 40).padEnd(40)} … `);
    const ok = await testStream(ch.stream_url);
    console.log(ok ? '✓' : '✗');
    if (ok) {
      working.push({
        name: ch.name.trim(),
        stream_url: ch.stream_url,
        logo_url: ch.logo_url || null,
        category: source.category,
        country: ch.country || null,
        language: ch.language || null,
        group_title: ch.group_title || null,
        tvg_id: ch.tvg_id || null,
        tvg_name: ch.tvg_name || null,
        is_hd: ch.is_hd || false,
        is_4k: ch.is_4k || false,
        is_live: true,
        is_working: true,
        user_id: null,
      });
    }
  }
  console.log(`  → ${working.length} working in ${source.category}`);
  return working;
}

async function main() {
  console.log('=== FlickTV Channel Tester ===\n');
  console.log('Testing priority channels…');

  const priorityWorking = [];
  for (const ch of PRIORITY) {
    process.stdout.write(`  ${ch.name.padEnd(30)} … `);
    const ok = await testStream(ch.stream_url);
    console.log(ok ? '✓' : '✗');
    if (ok) priorityWorking.push({ ...ch, is_live: true, is_working: true, user_id: null });
  }

  const categoryWorking = [];
  for (const source of SOURCES) {
    const found = await fetchAndTest(source);
    categoryWorking.push(...found);
  }

  const all = [...priorityWorking, ...categoryWorking];
  // Deduplicate by stream_url
  const seen = new Set();
  const unique = all.filter(ch => {
    if (seen.has(ch.stream_url)) return false;
    seen.add(ch.stream_url);
    return true;
  });

  console.log(`\n=== RESULTS: ${unique.length} verified working channels ===`);
  unique.forEach((ch, i) => console.log(`${String(i+1).padStart(3)}. [${ch.category.padEnd(13)}] ${ch.name}`));

  // Output as JSON for the seeder
  const outPath = new URL('../scripts/working_channels.json', import.meta.url).pathname;
  const fs = await import('fs');
  fs.writeFileSync(outPath, JSON.stringify(unique, null, 2));
  console.log(`\nSaved to scripts/working_channels.json`);
}

main().catch(console.error);
