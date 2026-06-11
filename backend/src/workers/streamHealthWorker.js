/**
 * FlickTV AI — Stream Health Worker
 * Periodically checks all channels for stream liveness.
 *
 * Design:
 *   - Uses setInterval (no extra deps) so it works with the existing backend.
 *   - Checks channels in batches with configurable concurrency.
 *   - For HLS (.m3u8) URLs: sends a GET request and validates the response
 *     contains a valid M3U8 manifest (more reliable than HEAD which many
 *     CDNs reject).
 *   - For other URLs: sends a HEAD request first; falls back to a ranged
 *     GET if HEAD returns 405 (method not allowed).
 *   - Marks a channel as "not working" only after N consecutive failures
 *     (avoids false positives from transient network blips).
 *   - Logs every check to stream_health_logs for historical analysis.
 *   - Emits structured stats after each run for admin dashboards.
 *
 * Config (env vars, all optional):
 *   HEALTH_CHECK_INTERVAL_MS   — ms between runs  (default: 30 * 60 * 1000)
 *   HEALTH_CHECK_BATCH_SIZE    — channels per batch (default: 50)
 *   HEALTH_CHECK_CONCURRENCY   — parallel checks   (default: 10)
 *   HEALTH_CHECK_TIMEOUT_MS    — per-stream timeout (default: 10000)
 *   HEALTH_CHECK_FAILURES      — consecutive failures before marking dead (default: 2)
 */

import fetch from 'node-fetch';
import { supabase } from '../server.js';
import { logger } from '../utils/logger.js';

// ─── Configuration ────────────────────────────────────────────────────────────

const INTERVAL_MS     = parseInt(process.env.HEALTH_CHECK_INTERVAL_MS  || String(30 * 60 * 1000));
const BATCH_SIZE      = parseInt(process.env.HEALTH_CHECK_BATCH_SIZE   || '50');
const CONCURRENCY     = parseInt(process.env.HEALTH_CHECK_CONCURRENCY  || '10');
const TIMEOUT_MS      = parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS   || '10000');
const FAILURES_TO_DEAD = parseInt(process.env.HEALTH_CHECK_FAILURES    || '2');

// ─── State ────────────────────────────────────────────────────────────────────

let consecutiveFailures = new Map(); // channelId -> count
let lastRunStats = null;
let timer = null;

// ─── Public API ───────────────────────────────────────────────────────────────

export function startStreamHealthWorker() {
  logger.info(`🏥 Stream health worker starting (interval: ${INTERVAL_MS / 60000}min, ` +
    `batch: ${BATCH_SIZE}, concurrency: ${CONCURRENCY}, timeout: ${TIMEOUT_MS}ms, ` +
    `failures-to-dead: ${FAILURES_TO_DEAD})`);

  // Run immediately on startup, then on interval
  runHealthCheck().catch(err => logger.error('Initial health check failed', err));
  timer = setInterval(() => {
    runHealthCheck().catch(err => logger.error('Health check run failed', err));
  }, INTERVAL_MS);
}

export function stopStreamHealthWorker() {
  if (timer) { clearInterval(timer); timer = null; }
  logger.info('🏥 Stream health worker stopped');
}

/** Returns stats from the most recent check run. */
export function getLastRunStats() {
  return lastRunStats;
}

// ─── Core Logic ───────────────────────────────────────────────────────────────

async function runHealthCheck() {

  // Fetch all live channels
  let allChannels = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('channels')
      .select('id, stream_url, name, is_working')
      .eq('is_live', true)
      .range(from, from + 999);

    if (error) {
      logger.error('Failed to fetch channels for health check', error);
      return;
    }
    if (!data || data.length === 0) break;
    allChannels = allChannels.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }

  if (!allChannels.length) {
    logger.info('🏥 No live channels to check');
    lastRunStats = { checked: 0, alive: 0, dead: 0, newDead: 0, durationMs: 0, ranAt: new Date() };
    return;
  }

  let checked = 0;
  let alive = 0;
  let dead = 0;
  let newDead = 0; // channels that just crossed the failure threshold

  // Process in batches
  for (let i = 0; i < allChannels.length; i += BATCH_SIZE) {
    const batch = allChannels.slice(i, i + BATCH_SIZE);

    // Run checks with limited concurrency
    const results = [];
    for (let j = 0; j < batch.length; j += CONCURRENCY) {
      const slice = batch.slice(j, j + CONCURRENCY);
      const sliceResults = await Promise.allSettled(
        slice.map(ch => checkStream(ch.stream_url))
      );
      results.push(...sliceResults);
    }

    // Prepare DB writes
    const channelUpdates = [];
    const logInserts = [];

    for (let k = 0; k < batch.length; k++) {
      const ch = batch[k];
      const result = results[k];
      const isAlive = result.status === 'fulfilled' && result.value.alive;
      const responseMs = result.status === 'fulfilled' ? result.value.ms : TIMEOUT_MS;

      checked++;
      if (isAlive) {
        alive++;
        // Reset consecutive failure counter on success
        if (consecutiveFailures.has(ch.id)) consecutiveFailures.delete(ch.id);
      } else {
        dead++;
        // Increment consecutive failure counter
        const count = (consecutiveFailures.get(ch.id) || 0) + 1;
        consecutiveFailures.set(ch.id, count);

        // Only mark as dead if we've hit the threshold
        if (count >= FAILURES_TO_DEAD && ch.is_working !== false) {
          newDead++;
          channelUpdates.push({ id: ch.id, is_working: false, last_checked: new Date() });
        }
      }

      // Always log the check result
      logInserts.push({
        channel_id: ch.id,
        is_alive: isAlive,
        response_ms: responseMs,
        error: isAlive ? null : (result.status === 'rejected' ? String(result.reason) : 'non-ok status'),
      });

      // Update last_checked for every channel
      channelUpdates.push({ id: ch.id, last_checked: new Date() });
    }

    // Batch update channels (use individual updates since we can't do
    // bulk conditional updates with supabase-js easily)
    if (channelUpdates.length > 0) {
      // Deduplicate by id — keep the last entry per channel
      const deduped = new Map();
      for (const u of channelUpdates) deduped.set(u.id, u);
      const updates = Array.from(deduped.values());

      // Fire-and-forget with error logging
      for (const u of updates) {
        const fields = { last_checked: u.last_checked };
        if ('is_working' in u) fields.is_working = u.is_working;
        await supabase.from('channels').update(fields).eq('id', u.id);
      }
    }

    // Batch insert health logs
    if (logInserts.length > 0) {
      await supabase.from('stream_health_logs').insert(logInserts);
    }
  }

  const durationMs = Date.now() - runStart;
  lastRunStats = {
    checked,
    alive,
    dead,
    newDead,
    durationMs,
    ranAt: new Date(),
  };

  logger.info(`🏥 Health check: ${checked} checked, ${alive} alive, ${dead} dead, ${newDead} newly dead (${durationMs}ms)`);
}

// ─── Stream Check ─────────────────────────────────────────────────────────────

async function checkStream(url) {
  const start = Date.now();
  const isHLS = url.includes('.m3u8');

  try {
    if (isHLS) {
      return await checkHLS(url, start);
    }
    return await checkGeneric(url, start);
  } catch {
    return { alive: false, ms: Date.now() - start };
  }
}

/** HLS manifests: GET and verify the body starts with #EXTM3U */
async function checkHLS(url, start) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)',
        'Accept': 'application/vnd.apple.mpegurl, */*',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { alive: false, ms: Date.now() - start };
    }

    // Read just the first 200 bytes to verify it's an M3U8 manifest
    const reader = res.body.getReader();
    const { value } = await reader.read();
    reader.cancel();

    if (!value) return { alive: false, ms: Date.now() - start };
    const text = new TextDecoder().decode(value.slice(0, 200));
    const alive = text.trimStart().startsWith('#EXTM3U');

    return { alive, ms: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return { alive: false, ms: Date.now() - start };
  }
}

/** Generic stream: try HEAD first, fall back to ranged GET */
async function checkGeneric(url, start) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)' },
    });
    clearTimeout(timer);

    if (res.ok) return { alive: true, ms: Date.now() - start };

    // HEAD not allowed — try a ranged GET (minimal data)
    if (res.status === 405) {
      return await checkWithRange(url, start);
    }

    return { alive: false, ms: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return { alive: false, ms: Date.now() - start };
  }
}

/** Ranged GET: fetch only the first 1 byte to verify reachability */
async function checkWithRange(url, start) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)',
        'Range': 'bytes=0-0',
      },
    });
    clearTimeout(timer);

    // 200 (full response) or 206 (partial) both mean the stream is alive
    const alive = res.ok || res.status === 206;
    return { alive, ms: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return { alive: false, ms: Date.now() - start };
  }
}
