/**
 * FlickTV AI — World Cup Worker Orchestrator
 * 
 * Manages the full World Cup pipeline:
 *   1. Match discovery (every 5 min during WC period)
 *   2. Goal/event detection (every 2 min during live matches)
 *   3. Highlight rendering (every 2 min)
 *   4. Social media posting (every 10 min)
 * 
 * Runs as cron jobs on the Railway server
 */

import cron from 'node-cron';
import { parseWorldCup } from '../parsers/worldCupParser.js';
import { runDetectionCycle } from './highlightClipper.js';
import { postAllReadyHighlights } from './socialPoster.js';
import { supabase } from '../server.js';
import { logger } from '../utils/logger.js';

// ─── Match Discovery ───────────────────────────────────────────────────────
// Run every 5 minutes to find new World Cup matches
async function discoverMatches() {
  logger.info('🔍 World Cup match discovery...');
  
  try {
    const result = await parseWorldCup();
    
    if (!result.channels.length && !result.matches.length) {
      logger.info('No new World Cup matches found');
      return { newMatches: 0, newChannels: 0 };
    }

    // Insert matches into DB
    let newMatches = 0;
    for (const match of result.matches) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('world_cup_matches')
        .select('id')
        .ilike('home_team', `%${match.home}%`)
        .ilike('away_team', `%${match.away}%`)
        .limit(1);

      if (!existing?.length) {
        await supabase.from('world_cup_matches').insert({
          home_team: match.home,
          away_team: match.away,
          competition: match.competition,
          status: 'scheduled',
          stream_url: match.stream_urls?.[0] || null,
          round: 'group', // default, admin can update
        });
        newMatches++;
      }
    }

    // Insert channels
    let newChannels = 0;
    if (result.channels.length) {
      // Get existing URLs for dedup
      const { data: existing } = await supabase.from('channels').select('stream_url');
      const existingUrls = new Set(existing?.map(c => c.stream_url) || []);

      const newCh = result.channels.filter(ch => !existingUrls.has(ch.stream_url));
      
      if (newCh.length) {
        // Batch insert
        for (let i = 0; i < newCh.length; i += 50) {
          const batch = newCh.slice(i, i + 50).map(ch => ({
            name: ch.name,
            stream_url: ch.stream_url,
            logo_url: ch.logo_url,
            group_title: ch.group_title || 'FIFA World Cup 2026',
            tvg_id: ch.tvg_id,
            tvg_name: ch.tvg_name || ch.name,
            country: ch.country,
            language: ch.language,
            category: 'sports',
            is_hd: ch.is_hd || false,
            is_4k: ch.is_4k || false,
            is_live: true,
            is_working: true,
            stream_info: ch.stream_info || {},
          }));

          const { data: inserted } = await supabase.from('channels').insert(batch).select();
          if (inserted) {
            newChannels += inserted.length;
            // Also link to world_cup_matches if teams match
            for (const ch of inserted) {
              if (ch.stream_info?.home && ch.stream_info?.away) {
                await supabase.from('world_cup_matches')
                  .update({ channel_id: ch.id, stream_url: ch.stream_url })
                  .ilike('home_team', `%${ch.stream_info.home}%`)
                  .ilike('away_team', `%${ch.stream_info.away}%`);
              }
            }
          }
        }
      }
    }

    logger.info(`✅ Discovery: +${newMatches} matches, +${newChannels} channels`);
    return { newMatches, newChannels, errors: result.errors };

  } catch (err) {
    logger.error('Match discovery failed:', err);
    return { newMatches: 0, newChannels: 0, error: err.message };
  }
}

// ─── Schedule ──────────────────────────────────────────────────────────────

export function startWorldCupWorker() {
  // Match discovery: every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await discoverMatches();
  });

  // Goal detection + highlight rendering: every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    await runDetectionCycle();
  });

  // Social media posting: every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    logger.info('📤 Checking for highlights to post...');
    await postAllReadyHighlights();
  });

  logger.info('✅ World Cup worker started:');
  logger.info('   • Match discovery: every 5 min');
  logger.info('   • Goal detection: every 2 min');
  logger.info('   • Social posting: every 10 min');
}

// ─── Manual triggers (for admin dashboard) ─────────────────────────────────

export async function triggerDiscovery() {
  return await discoverMatches();
}

export async function triggerDetection() {
  return await runDetectionCycle();
}

export async function triggerPosting() {
  return await postAllReadyHighlights();
}

export default startWorldCupWorker;
