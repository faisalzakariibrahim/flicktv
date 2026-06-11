import cron from 'node-cron';
import fetch from 'node-fetch';
import { parseM3U } from '../parsers/m3uParser.js';
import { parseCamel1 } from '../parsers/camel1Parser.js';
import { parseWorldCup } from '../parsers/worldCupParser.js';
import { supabase } from '../server.js';
import { logger } from '../utils/logger.js';

export function startDailyChannelScan() {
  // Run daily at 12:00 AM (midnight) in server local time
  cron.schedule('0 0 * * *', async () => {
    logger.info('⏰ Daily channel scan starting...');
    await runScan();
  });

  logger.info('✅ Daily channel scan scheduled (every day at 12:00 AM)');
}

export async function runScan() {
  const startTime = Date.now();

  try {
    // 1. Get all active scan sources from DB
    const { data: dbSources } = await supabase
      .from('scan_sources')
      .select('*')
      .eq('is_active', true);

    // 2. Built-in iptv-org sources
    const defaultSources = getDefaultScanSources();
    const allSources = [...(dbSources || []), ...defaultSources];

    if (!allSources.length) {
      logger.warn('No scan sources configured, skipping daily scan');
      return { success: true, message: 'No sources', totalNew: 0 };
    }

    // 3. Get all existing URLs for de-duplication
    let from = 0;
    const batchSize = 1000;
    let existingUrls = new Set();
    while (true) {
      const { data } = await supabase.from('channels').select('stream_url').range(from, from + batchSize - 1);
      if (!data || data.length === 0) break;
      data.forEach(c => existingUrls.add(c.stream_url));
      from += batchSize;
      if (data.length < batchSize) break;
    }

    let totalScanned = 0;
    let totalNew = 0;
    const errors = [];
    const skipped = [];

    // 4. Scan each source
    for (const source of allSources) {
      try {
        const response = await fetch(source.url, {
          headers: { 'User-Agent': 'FlickTV/1.0' },
          timeout: 30000,
        });

        if (!response.ok) {
          skipped.push({ name: source.name, reason: `HTTP ${response.status}` });
          continue;
        }

        const text = await response.text();

        // Validate it looks like M3U
        if (!text.trim().startsWith('#EXTM3U')) {
          skipped.push({ name: source.name, reason: 'Not valid M3U' });
          continue;
        }

        const parsed = parseM3U(text);
        totalScanned += parsed.length;

        const newChannels = parsed.filter(ch => !existingUrls.has(ch.stream_url));

        // Insert in batches of 50
        for (let i = 0; i < newChannels.length; i += 50) {
          const batch = newChannels.slice(i, i + 50).map(ch => ({
            name: ch.name,
            stream_url: ch.stream_url,
            logo_url: ch.logo_url,
            group_title: ch.group_title,
            tvg_id: ch.tvg_id,
            tvg_name: ch.tvg_name || ch.name,
            country: ch.country || source.country || null,
            language: ch.language,
            category: ch.category || source.category || 'general',
            is_hd: ch.is_hd || false,
            is_4k: ch.is_4k || false,
            is_live: true,
            is_working: true,
            stream_info: {},
          }));

          const { data: inserted, error } = await supabase.from('channels').insert(batch).select();
          if (error) {
            errors.push({ source: source.name, msg: error.message });
          } else if (inserted) {
            totalNew += inserted.length;
            inserted.forEach(c => existingUrls.add(c.stream_url));
          }
        }

        // Update last_scanned_at for DB sources
        if (source.id) {
          await supabase.from('scan_sources')
            .update({ last_scanned_at: new Date(), channel_count: parsed.length })
            .eq('id', source.id);
        }

      } catch (err) {
        skipped.push({ name: source.name, reason: err.message });
      }
    }

    // 5. Handle camel1.tv sources (live match scraping)
    const camel1Sources = allSources.filter(s => s.source_type === 'camel1');
    for (const source of camel1Sources) {
      try {
        logger.info(`⏰ Scanning camel1.tv for live matches...`);
        const result = await parseCamel1();
        if (!result.channels.length) {
          skipped.push({ name: source.name, reason: result.message || 'No live matches' });
          continue;
        }

        totalScanned += result.total;
        const newChannels = result.channels.filter(ch => !existingUrls.has(ch.stream_url));

        for (let i = 0; i < newChannels.length; i += 50) {
          const batch = newChannels.slice(i, i + 50);
          const { data: inserted, error } = await supabase.from('channels').insert(batch).select();
          if (error) {
            errors.push({ source: source.name, msg: error.message });
          } else if (inserted) {
            totalNew += inserted.length;
            inserted.forEach(c => existingUrls.add(c.stream_url));
          }
        }

        if (source.id) {
          await supabase.from('scan_sources')
            .update({ last_scanned_at: new Date(), channel_count: result.total })
            .eq('id', source.id);
        }

        logger.info(`⏰ camel1.tv scan: +${newChannels.length} new channels from ${result.matches} matches`);
      } catch (err) {
        skipped.push({ name: source.name, reason: err.message });
      }
    }

    // 6. World Cup match scraping (during WC period)
    try {
      logger.info(`⏰ Scanning World Cup matches...`);
      const wcResult = await parseWorldCup();
      if (wcResult.channels.length) {
        totalScanned += wcResult.channels.length;
        const newChannels = wcResult.channels.filter(ch => !existingUrls.has(ch.stream_url));

        for (let i = 0; i < newChannels.length; i += 50) {
          const batch = newChannels.slice(i, i + 50);
          const { data: inserted, error } = await supabase.from('channels').insert(batch).select();
          if (error) {
            errors.push({ source: 'worldcup', msg: error.message });
          } else if (inserted) {
            totalNew += inserted.length;
            inserted.forEach(c => existingUrls.add(c.stream_url));
          }
        }
        logger.info(`⏰ World Cup: +${newChannels.length} new channels from ${wcResult.matches.length} matches`);
      }
    } catch (err) {
      skipped.push({ name: 'World Cup', reason: err.message });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const result = {
      success: true,
      elapsed: `${elapsed}s`,
      sourcesScanned: allSources.length,
      totalScanned,
      totalNew,
      errors,
      skipped,
    };

    logger.info(`⏰ Daily scan complete: +${totalNew} new channels in ${elapsed}s`, result);
    return result;

  } catch (err) {
    logger.error('Daily scan failed:', err);
    return { success: false, error: err.message };
  }
}

function getDefaultScanSources() {
  const base = 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams';
  const cats = ['news', 'sports', 'movies', 'kids', 'music', 'documentary', 'religious', 'general'];
  const langs = ['ara', 'fra', 'spa', 'hin', 'por', 'rus', 'urd', 'tur', 'deu', 'ita'];
  const countries = ['us', 'gb', 'ca', 'au', 'in', 'pk', 'ng', 'za', 'eg', 'ae', 'sa', 'iq', 'jo', 'lb', 'ma'];

  const sources = [];
  for (const c of cats) sources.push({ name: `iptv-org: ${c}`, url: `${base}/${c}.m3u`, category: c });
  for (const l of langs) sources.push({ name: `iptv-org: ${l}`, url: `${base}/${l}.m3u`, language: l });
  for (const c of countries) sources.push({ name: `iptv-org: ${c.toUpperCase()}`, url: `${base}/${c}.m3u`, country: c });
  return sources;
}
