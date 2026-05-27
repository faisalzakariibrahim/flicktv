/**
 * Fetch iptv-org playlists, quick-test each stream, collect working ones.
 * Uses 4s HEAD timeout (fast scan). Target: 500+ channels.
 */

import fetch from 'node-fetch';
import { parseM3U } from '../parsers/m3uParser.js';

const TIMEOUT_MS = 4000;
const CONCURRENCY = 8;   // parallel stream checks
const PER_SOURCE = 80;   // max to test per source before moving on
const TARGET_PER = 20;   // working channels to keep per source

const SOURCES = [
  // ── Categories ─────────────────────────────────────────────────────────
  { key: 'news-cat',          category: 'news',          url: 'https://iptv-org.github.io/iptv/categories/news.m3u',          target: 30 },
  { key: 'sports-cat',        category: 'sports',        url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',        target: 30 },
  { key: 'movies-cat',        category: 'movies',        url: 'https://iptv-org.github.io/iptv/categories/movies.m3u',        target: 25 },
  { key: 'entertainment-cat', category: 'entertainment', url: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u', target: 25 },
  { key: 'kids-cat',          category: 'kids',          url: 'https://iptv-org.github.io/iptv/categories/kids.m3u',          target: 20 },
  { key: 'music-cat',         category: 'music',         url: 'https://iptv-org.github.io/iptv/categories/music.m3u',         target: 20 },
  { key: 'documentary-cat',   category: 'documentary',   url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u',   target: 20 },
  { key: 'religious-cat',     category: 'entertainment', url: 'https://iptv-org.github.io/iptv/categories/religious.m3u',     target: 15 },
  { key: 'business-cat',      category: 'news',          url: 'https://iptv-org.github.io/iptv/categories/business.m3u',      target: 15 },

  // ── Languages ──────────────────────────────────────────────────────────
  { key: 'arabic',    category: null, url: 'https://iptv-org.github.io/iptv/languages/ara.m3u',    target: 40 },
  { key: 'french',    category: null, url: 'https://iptv-org.github.io/iptv/languages/fra.m3u',    target: 20 },
  { key: 'spanish',   category: null, url: 'https://iptv-org.github.io/iptv/languages/spa.m3u',    target: 20 },
  { key: 'hindi',     category: null, url: 'https://iptv-org.github.io/iptv/languages/hin.m3u',    target: 20 },
  { key: 'portuguese',category: null, url: 'https://iptv-org.github.io/iptv/languages/por.m3u',    target: 15 },

  // ── African countries ───────────────────────────────────────────────────
  { key: 'nigeria',   category: 'entertainment', url: 'https://iptv-org.github.io/iptv/countries/ng.m3u',  target: 20 },
  { key: 'ghana',     category: 'entertainment', url: 'https://iptv-org.github.io/iptv/countries/gh.m3u',  target: 15 },
  { key: 'kenya',     category: 'entertainment', url: 'https://iptv-org.github.io/iptv/countries/ke.m3u',  target: 15 },
  { key: 'egypt',     category: 'news',          url: 'https://iptv-org.github.io/iptv/countries/eg.m3u',  target: 20 },
  { key: 'southafrica',category:'entertainment', url: 'https://iptv-org.github.io/iptv/countries/za.m3u',  target: 15 },
  { key: 'ethiopia',  category: 'entertainment', url: 'https://iptv-org.github.io/iptv/countries/et.m3u',  target: 10 },
  { key: 'tanzania',  category: 'entertainment', url: 'https://iptv-org.github.io/iptv/countries/tz.m3u',  target: 10 },
  { key: 'uganda',    category: 'entertainment', url: 'https://iptv-org.github.io/iptv/countries/ug.m3u',  target: 10 },

  // ── UK / International English ─────────────────────────────────────────
  { key: 'uk',        category: 'news',          url: 'https://iptv-org.github.io/iptv/countries/gb.m3u',  target: 20 },
  { key: 'usa',       category: 'news',          url: 'https://iptv-org.github.io/iptv/countries/us.m3u',  target: 25 },
];

// Priority channels always included (pre-verified)
const PRIORITY = [
  { name: 'DW English',       stream_url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',       category: 'news',        country: 'DE', is_hd: true,  logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/120px-Deutsche_Welle_symbol_2012.svg.png' },
  { name: 'CGTN',             stream_url: 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8',                         category: 'news',        country: 'CN', is_hd: true,  logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/CGTN_logo.svg/120px-CGTN_logo.svg.png' },
  { name: 'Arirang TV',       stream_url: 'https://amdlive-ch02-ctnd-com.akamaized.net/arirang_2ch/smil:arirang_2ch.smil/playlist.m3u8', category: 'news', country: 'KR', is_hd: true, logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Arirang_TV_Logo.svg/120px-Arirang_TV_Logo.svg.png' },
  { name: 'Al Jazeera Arabic',stream_url: 'https://live-hls-web-aja.getaj.net/AJA/index.m3u8',                                  category: 'news',        country: 'QA', is_hd: true,  logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Aljazeera_eng.svg/120px-Aljazeera_eng.svg.png' },
  { name: 'France 24 Arabic', stream_url: 'https://static.france24.com/live/F24_AR_LO_HLS/live_ios/master.m3u8',                category: 'news',        country: 'FR', is_hd: true,  logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/France_24_Logo.svg/120px-France_24_Logo.svg.png' },
  { name: 'France 24 English',stream_url: 'https://static.france24.com/live/F24_EN_LO_HLS/live_ios/master.m3u8',                category: 'news',        country: 'FR', is_hd: true,  logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/France_24_Logo.svg/120px-France_24_Logo.svg.png' },
  { name: 'France 24 French', stream_url: 'https://static.france24.com/live/F24_FR_LO_HLS/live_ios/master.m3u8',                category: 'news',        country: 'FR', is_hd: true,  logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/France_24_Logo.svg/120px-France_24_Logo.svg.png' },
  { name: 'NASA TV',          stream_url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',              category: 'documentary', country: 'US', is_hd: true,  logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/120px-NASA_logo.svg.png' },
  { name: 'NHK World Japan',  stream_url: 'https://nhkwlive-ojp.akamaized.net/hls/live/2003459/nhkwlive-ojp-en/index.m3u8',    category: 'news',        country: 'JP', is_hd: true,  logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/NHK_World_logo.svg/120px-NHK_World_logo.svg.png' },
  { name: 'WION',             stream_url: 'https://wionlive-lh.akamaihd.net/i/wionlive_1@589461/master.m3u8',                   category: 'news',        country: 'IN', is_hd: true,  logo_url: null },
];

async function testStream(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
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

async function runBatch(items, test) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(test));
    results.push(...batchResults);
  }
  return results;
}

function inferCategory(ch, override) {
  if (override) return override;
  return ch.category || 'entertainment';
}

async function fetchAndTest(source) {
  console.log(`\n[${source.key}] Fetching…`);
  let channels = [];
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) { console.log(`  HTTP ${res.status}`); return []; }
    const text = await res.text();
    channels = parseM3U(text);
  } catch (e) {
    console.log(`  Fetch failed: ${e.message}`);
    return [];
  }

  // Filter basics
  const ADULT = ['adult', 'xxx', '18+', 'erotic', 'porn', 'sex'];
  const filtered = channels.filter(ch => {
    if (!ch.stream_url || !ch.name) return false;
    const low = ((ch.group_title || '') + ' ' + ch.name).toLowerCase();
    return !ADULT.some(k => low.includes(k));
  });

  console.log(`  ${filtered.length} channels after filter, testing up to ${PER_SOURCE}…`);
  const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, PER_SOURCE);
  const working = [];

  const results = await runBatch(shuffled, async ch => {
    const ok = await testStream(ch.stream_url);
    if (ok) {
      process.stdout.write('✓');
      return {
        name: ch.name.trim(),
        stream_url: ch.stream_url,
        logo_url: ch.logo_url || null,
        category: inferCategory(ch, source.category),
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
      };
    }
    process.stdout.write('.');
    return null;
  });

  for (const r of results) {
    if (r && working.length < source.target) working.push(r);
  }
  console.log(`\n  → ${working.length} working`);
  return working;
}

async function main() {
  console.log('=== FlickTV Channel Scanner — target 500+ ===\n');

  // Test priority channels first
  console.log('Priority channels:');
  const priorityWorking = [];
  for (const ch of PRIORITY) {
    process.stdout.write(`  ${ch.name.padEnd(25)} `);
    const ok = await testStream(ch.stream_url);
    console.log(ok ? '✓' : '✗');
    if (ok) priorityWorking.push({ ...ch, is_live: true, is_working: true, user_id: null });
  }

  const fromSources = [];
  for (const source of SOURCES) {
    const found = await fetchAndTest(source);
    fromSources.push(...found);
  }

  // Merge + deduplicate by stream_url
  const all = [...priorityWorking, ...fromSources];
  const seen = new Set();
  const unique = all.filter(ch => {
    if (seen.has(ch.stream_url)) return false;
    seen.add(ch.stream_url);
    return true;
  });

  const byCategory = unique.reduce((a, c) => { a[c.category] = (a[c.category] || 0) + 1; return a; }, {});
  console.log(`\n=== ${unique.length} verified working channels ===`);
  console.log('By category:', byCategory);

  const outPath = new URL('./working_channels.json', import.meta.url).pathname;
  const { writeFileSync } = await import('fs');
  writeFileSync(outPath, JSON.stringify(unique, null, 2));
  console.log(`Saved to scripts/working_channels.json`);
}

main().catch(console.error);
