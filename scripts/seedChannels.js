/**
 * Auto-seeder: ensures the app always has channels.
 * Runs at server startup. Fetches from iptv-org if < MIN_CHANNELS system channels exist.
 * System channels have user_id = NULL and are visible to all users.
 */

import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';
import fetch from 'node-fetch';
import { parseM3U } from '../parsers/m3uParser.js';
import { logger } from '../utils/logger.js';

const MIN_CHANNELS = 500;

// Adult content groups to skip
const ADULT_KEYWORDS = ['adult', 'xxx', '18+', 'erotic', 'porn', 'sex'];

const SEED_SOURCES = [
  'https://iptv-org.github.io/iptv/index.m3u',
];

export async function seedChannelsIfNeeded() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { realtime: { transport: WebSocket } }
  );

  try {
    const { count, error: countErr } = await supabase
      .from('channels')
      .select('id', { count: 'exact', head: true })
      .is('user_id', null);

    if (countErr) {
      logger.error('Seed check failed', countErr);
      return;
    }

    if (count >= MIN_CHANNELS) {
      logger.info(`Seed: ${count} system channels present — skipping`);
      return;
    }

    logger.info(`Seed: only ${count} system channels — seeding from iptv-org…`);

    for (const url of SEED_SOURCES) {
      try {
        await seedFromUrl(supabase, url);
      } catch (err) {
        logger.error(`Seed source failed: ${url}`, err);
      }
    }
  } catch (err) {
    logger.error('seedChannelsIfNeeded error', err);
  }
}

async function seedFromUrl(supabase, url) {
  logger.info(`Fetching ${url}…`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)' },
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  const parsed = parseM3U(text);
  logger.info(`Parsed ${parsed.length} entries`);

  // Filter: require URL and name, skip adult
  const channels = parsed
    .filter(ch => {
      if (!ch.stream_url || !ch.name) return false;
      const lower = ((ch.group_title || '') + ' ' + ch.name).toLowerCase();
      return !ADULT_KEYWORDS.some(kw => lower.includes(kw));
    })
    .slice(0, 5000)
    .map(ch => ({
      user_id: null,
      name: ch.name.trim(),
      stream_url: ch.stream_url,
      logo_url: ch.logo_url || null,
      group_title: ch.group_title || null,
      tvg_id: ch.tvg_id || null,
      tvg_name: ch.tvg_name || null,
      country: ch.country || null,
      language: ch.language || null,
      category: ch.category || 'general',
      is_hd: ch.is_hd || false,
      is_4k: ch.is_4k || false,
      is_live: ch.is_live !== false,
      is_working: true,
    }));

  if (!channels.length) {
    logger.warn('No usable channels parsed');
    return;
  }

  // Batch insert in chunks — ignore duplicates via stream_url unique constraint
  const CHUNK = 500;
  let inserted = 0;

  for (let i = 0; i < channels.length; i += CHUNK) {
    const chunk = channels.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('channels')
      .insert(chunk);

    if (error) {
      // Duplicate stream_url errors are expected — just log at debug level
      if (!error.message?.includes('duplicate')) {
        logger.error(`Seed insert chunk error`, error.message);
      }
    } else {
      inserted += chunk.length;
    }
  }

  logger.info(`Seeded ${inserted} channels`);
}
