/**
 * FlickTV AI — Stream Health Worker
 * Runs every 30 minutes, checks all channels for liveness
 */
import cron from 'node-cron';
import fetch from 'node-fetch';
import { supabase } from '../server.js';
import { logger } from '../utils/logger.js';

const BATCH_SIZE = 50;
const TIMEOUT_MS = 8000;

export function startStreamHealthWorker() {
  // Run every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    logger.info('🏥 Stream health check starting...');
    await runHealthCheck();
  });

  logger.info('✅ Stream health worker scheduled (every 30 min)');
}

async function runHealthCheck() {
  const { data: channels } = await supabase
    .from('channels')
    .select('id, stream_url')
    .eq('is_live', true)
    .limit(500);

  if (!channels?.length) return;

  let checked = 0, alive = 0, dead = 0;

  for (let i = 0; i < channels.length; i += BATCH_SIZE) {
    const batch = channels.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(ch => checkStream(ch.stream_url))
    );

    const updates = batch.map((ch, idx) => {
      const result = results[idx];
      const isAlive = result.status === 'fulfilled' && result.value.alive;
      if (isAlive) alive++; else dead++;
      checked++;
      return { id: ch.id, alive: isAlive, ms: result.value?.ms || 0 };
    });

    // Batch update DB
    for (const u of updates) {
      await supabase.from('channels')
        .update({ is_working: u.alive, last_checked: new Date() })
        .eq('id', u.id);

      await supabase.from('stream_health_logs').insert({
        channel_id: u.id,
        is_alive: u.alive,
        response_ms: u.ms,
      });
    }
  }

  logger.info(`🏥 Health check complete: ${checked} checked, ${alive} alive, ${dead} dead`);
}

async function checkStream(url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)' },
    });
    clearTimeout(timer);

    return { alive: res.ok, ms: Date.now() - start };
  } catch {
    return { alive: false, ms: Date.now() - start };
  }
}
