/**
 * FlickTV AI — World Cup Highlight Generator
 * 
 * Two core functions:
 *   1. Goal/event detection via football-data.org API (free tier)
 *   2. Stream clipping via ffmpeg to create highlight videos
 * 
 * Usage:
 *   node highlightClipper.js --mode detect     (check for new goals)
 *   node highlightClipper.js --mode clip       (render queued highlights)
 *   node highlightClipper.js --mode all        (detect + clip)
 * 
 * Environment variables:
 *   FOOTBALL_DATA_API_KEY  — free key from football-data.org
 *   HIGHLIGHT_OUTPUT_DIR   — where to save clips (default: ./highlights)
 *   SUPABASE_URL / SUPABASE_SERVICE_KEY
 */

import { spawn, execSync } from 'child_process';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HIGHLIGHT_DIR = process.env.HIGHLIGHT_OUTPUT_DIR || path.join(__dirname, '..', '..', 'highlights');

// ─── Supabase ────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// ─── football-data.org API ─────────────────────────────────────────────────
// Free tier: 10 requests/minute, covers World Cup
const FDA_BASE = 'https://api.football-data.org/v4';
const FDA_KEY = process.env.FOOTBALL_DATA_API_KEY || '';

async function fdaRequest(endpoint) {
  const res = await fetch(`${FDA_BASE}${endpoint}`, {
    headers: { 'X-Auth-Token': FDA_KEY },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Rate limited by football-data.org');
    throw new Error(`football-data.org HTTP ${res.status}`);
  }
  return res.json();
}

// ─── API-Football (paid, more reliable) ─────────────────────────────────────
const API_FB_BASE = 'https://v3.football.api-sports.io';
const API_FB_KEY = process.env.API_FOOTBALL_KEY || '';

async function fetchWCMatchesFromAPI() {
  // Try API-Football first (paid tier, more reliable)
  if (API_FB_KEY) {
    try {
      const res = await fetch(`${API_FB_BASE}/fixtures?league=1&season=2026`, {
        headers: { 'x-apisports-key': API_FB_KEY },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
      const data = await res.json();
      if (data.response?.length) {
        return data.response.map(f => ({
          id: f.fixture.id,
          home_team: f.teams.home.name,
          away_team: f.teams.away.name,
          home_score: f.goals.home ?? 0,
          away_score: f.goals.away ?? 0,
          status: f.fixture.status.short,
          kickoff_at: f.fixture.date,
          round: f.league.round,
          stream_url: null,
          external_id: f.fixture.id,
        }));
      }
    } catch (err) {
      console.warn('⚠️ API-Football failed, falling back:', err.message);
    }
  }

  // Try free football-data.org
  if (FDA_KEY) {
    try {
      const data = await fdaRequest('/competitions/WC/matches?season=2026');
      return (data.matches || []).map(m => ({
        id: m.id,
        home_team: m.homeTeam?.name,
        away_team: m.awayTeam?.name,
        home_score: m.score?.fullTime?.home ?? 0,
        away_score: m.score?.fullTime?.away ?? 0,
        status: m.status,
        kickoff_at: m.utcDate,
        round: m.stage,
        stream_url: null,
      }));
    } catch (err) {
      console.warn('⚠️ football-data.org failed:', err.message);
    }
  }

  // Fallback: return matches from our DB
  const { data } = await supabase
    .from('world_cup_matches')
    .select('*')
    .in('status', ['live', 'halftime', 'scheduled'])
    .order('kickoff_at', { ascending: false })
    .limit(50);
  return data || [];
}

/**
 * Detect score changes / new events by comparing API data with our DB
 * Returns array of new events to process
 */
export async function detectNewEvents() {
  const apiMatches = await fetchWCMatchesFromAPI();
  const newEvents = [];

  for (const match of apiMatches) {
    // Find the match in our DB — try external_id first, then team names
    let dbMatch = null;
    if (match.external_id) {
      const { data: dbById } = await supabase
        .from('world_cup_matches')
        .select('*')
        .eq('match_id_ext', String(match.external_id))
        .limit(1);
      if (dbById?.length) dbMatch = dbById[0];
    }
    if (!dbMatch) {
      const homeName = match.homeTeam?.name || match.home_team;
      const awayName = match.awayTeam?.name || match.away_team;
      if (!homeName || !awayName) continue;
      const { data: dbByTeams } = await supabase
        .from('world_cup_matches')
        .select('*')
        .ilike('home_team', `%${homeName}%`)
        .ilike('away_team', `%${awayName}%`)
        .limit(1);
      if (dbByTeams?.length) dbMatch = dbByTeams[0];
    }
    if (!dbMatch) continue;

    // Check status change — handle both API formats
    let status = dbMatch.status || 'scheduled';
    const apiStatus = match.status?.toUpperCase?.() || match.status || '';
    if (apiStatus === 'IN_PLAY' || apiStatus === 'LIVE' || apiStatus === '1H' || apiStatus === '2H') status = 'live';
    else if (apiStatus === 'PAUSED' || apiStatus === 'HT') status = 'halftime';
    else if (apiStatus === 'FINISHED' || apiStatus === 'FT') status = 'finished';

    if (status !== dbMatch.status) {
      await supabase.from('world_cup_matches')
        .update({ status, updated_at: new Date() })
        .eq('id', dbMatch.id);
    }

    // Check score change — handle both API-Football and football-data.org formats
    const apiHomeScore = match.home_score ?? match.score?.fullTime?.home ?? match.goals?.home ?? 0;
    const apiAwayScore = match.away_score ?? match.score?.fullTime?.away ?? match.goals?.away ?? 0;

    if (apiHomeScore !== dbMatch.home_score || apiAwayScore !== dbMatch.away_score) {
      // Detect goals
      while (apiHomeScore > dbMatch.home_score) {
        newEvents.push({
          match_id: dbMatch.id,
          event_type: 'goal',
          team: 'home',
          player: match.homeTeam?.name || homeName,
          minute: null,
          priority: dbMatch.round === 'final' ? 1 : 3,
        });
        dbMatch.home_score++;
      }
      while (apiAwayScore > dbMatch.away_score) {
        newEvents.push({
          match_id: dbMatch.id,
          event_type: 'goal',
          team: 'away',
          player: match.awayTeam?.name || awayName,
          minute: null,
          priority: dbMatch.round === 'final' ? 1 : 3,
        });
        dbMatch.away_score++;
      }

      // Update scores in DB
      await supabase.from('world_cup_matches')
        .update({ home_score: apiHomeScore, away_score: apiAwayScore, status, updated_at: new Date() })
        .eq('id', dbMatch.id);

      // Record events in match_events table
      for (const evt of newEvents.filter(e => e.match_id === dbMatch.id)) {
        await supabase.from('match_events').insert({
          match_id: evt.match_id,
          event_type: evt.event_type,
          team: evt.team,
          player: evt.player,
          minute: evt.minute,
        });
      }
    }
  }

  return newEvents;
}

/**
 * Clip a highlight from a live stream using ffmpeg
 * Captures the last N seconds of the stream at the current moment
 * 
 * For goals: capture from ~30s before to ~15s after
 * For full match: not practical in real-time, just clip key moments
 */
export async function clipHighlight(matchId, streamUrl, eventType, minute, outputPath) {
  return new Promise((resolve, reject) => {
    if (!streamUrl) {
      return reject(new Error('No stream URL available'));
    }

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    let ffmpegArgs;
    
    if (eventType === 'goal') {
      // Clip 45 seconds: starts 30s before the goal, ends 15s after
      // For live streams, we capture from "now - 15s" for 45s total
      const clipDuration = 45;
      const offsetSeconds = 15; // how far back from "now" to start
      
      ffmpegArgs = [
        '-ss', String(offsetSeconds),     // start 15s ago
        '-i', streamUrl,                   // input stream
        '-t', String(clipDuration),       // duration
        '-c:v', 'libx264',               // video codec
        '-preset', 'ultrafast',           // speed over quality
        '-crf', '28',                      // quality (lower = better)
        '-c:a', 'aac',
        '-b:a', '128k',
        '-vf', 'scale=1080:-1,format=yuv420p', // normalize for social media
        '-movflags', '+faststart',         // web-optimized
        '-y',                              // overwrite output
        outputPath,
      ];
    } else {
      // Default 30s clip
      ffmpegArgs = [
        '-ss', '15',
        '-i', streamUrl,
        '-t', '30',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-vf', 'scale=1080:-1,format=yuv420p',
        '-movflags', '+faststart',
        '-y',
        outputPath,
      ];
    }

    console.log(`🎬 Clipping highlight: ${eventType} at ${minute}' (${streamUrl.slice(0, 50)}...)`);

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    let stderr = '';

    ffmpeg.stderr.on('data', d => { stderr += d.toString(); });
    ffmpeg.on('close', code => {
      if (code === 0 && existsSync(outputPath)) {
        const stat = execSync(`stat -f%z "${outputPath}" 2>/dev/null || stat -c%s "${outputPath}"`);
        console.log(`✅ Clip saved: ${outputPath} (${(Number(stat) / 1024 / 1024).toFixed(1)}MB)`);
        resolve({ success: true, path: outputPath, size: Number(stat) });
      } else {
        console.error(`❌ ffmpeg exited ${code}: ${stderr.slice(-500)}`);
        resolve({ success: false, error: `ffmpeg exit ${code}` });
      }
    });

    // Timeout after 90 seconds
    setTimeout(() => {
      ffmpeg.kill('SIGTERM');
      resolve({ success: false, error: 'timeout' });
    }, 90000);
  });
}

/**
 * Add text overlay (match info, score, "GOAL!" text) to a video
 * Requires ffmpeg with drawtext filter
 */
export async function addOverlay(inputPath, outputPath, options) {
  const { title, subtitle, homeTeam, awayTeam, homeScore, awayScore, minute } = options;

  const drawTexts = [];
  if (title) {
    drawTexts.push(`text='${title}':fontsize=64:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=10:x=(w-text_w)/2:y=40`);
  }
  if (homeTeam && awayTeam) {
    drawTexts.push(`text='${homeTeam} ${homeScore||0} - ${awayScore||0} ${awayTeam}':fontsize=36:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8:x=(w-text_w)/2:y=120`);
  }

  if (drawTexts.length === 0) {
    // No overlay needed, just copy
    execSync(`cp "${inputPath}" "${outputPath}"`);
    return outputPath;
  }

  const filterStr = drawTexts.join(',');

  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -y -i "${inputPath}" -vf "${filterStr}" -c:v libx264 -preset ultrafast -crf 28 -c:a copy "${outputPath}"`;
    try {
      execSync(cmd, { timeout: 60000, stdio: 'pipe' });
      resolve(outputPath);
    } catch (err) {
      // Fallback: just copy without overlay
      execSync(`cp "${inputPath}" "${outputPath}"`);
      resolve(outputPath);
    }
  });
}

/**
 * Generate a thumbnail from a clip using ffmpeg
 */
export async function generateThumbnail(videoPath, outputPath) {
  return new Promise((resolve) => {
    try {
      execSync(
        `ffmpeg -y -i "${videoPath}" -ss 00:00:02 -vframes 1 -vf "scale=400:-1" "${outputPath}"`,
        { timeout: 15000, stdio: 'pipe' }
      );
      resolve(outputPath);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Process the highlight queue: clip + render pending highlights
 */
export async function processHighlightQueue() {
  const { data: queue } = await supabase
    .from('highlight_queue')
    .select('*, world_cup_matches(*)')
    .eq('status', 'queued')
    .order('priority', { ascending: true })
    .limit(5);

  if (!queue?.length) {
    console.log('📭 No highlights in queue');
    return { processed: 0 };
  }

  const results = [];
  for (const item of queue) {
    const match = item.world_cup_matches;
    if (!match) continue;

    // Mark as processing
    await supabase.from('highlight_queue').update({ status: 'processing' }).eq('id', item.id);

    const slug = `${match.home_team}-${match.away_team}-${item.minute || 'live'}`.replace(/\s+/g, '_');
    const clipPath = path.join(HIGHLIGHT_DIR, `${slug}.mp4`);
    const thumbPath = path.join(HIGHLIGHT_DIR, `${slug}.jpg`);

    // Create highlight record
    const { data: highlight } = await supabase.from('highlights').insert({
      match_id: item.match_id,
      event_id: null,
      title: `⚽ ${item.event_type === 'goal' ? 'GOAL!' : item.event_type.toUpperCase()} — ${match.home_team} vs ${match.away_team}${item.minute ? ` (${item.minute}')` : ''}`,
      description: `${match.home_team} ${match.home_score} - ${match.away_score} ${match.away_team}`,
      event_type: item.event_type,
      minute: item.minute,
      status: 'rendering',
    }).select().single();

    try {
      // Clip the stream
      const clipResult = await clipHighlight(
        item.match_id,
        match.stream_url,
        item.event_type,
        item.minute,
        clipPath
      );

      if (clipResult.success) {
        // Generate thumbnail
        await generateThumbnail(clipPath, thumbPath);

        // Add overlay
        const overlayPath = path.join(HIGHLIGHT_DIR, `${slug}_overlay.mp4`);
        await addOverlay(clipPath, overlayPath, {
          title: item.event_type === 'goal' ? '⚽ GOAL!' : item.event_type.toUpperCase(),
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          homeScore: match.home_score,
          awayScore: match.away_score,
          minute: item.minute,
        });

        // Update highlight record
        const finalPath = existsSync(overlayPath) ? overlayPath : clipPath;
        await supabase.from('highlights').update({
          clip_url: finalPath,
          thumbnail_url: existsSync(thumbPath) ? thumbPath : null,
          duration_secs: item.event_type === 'goal' ? 45 : 30,
          status: 'ready',
        }).eq('id', highlight.id);

        await supabase.from('highlight_queue').update({
          status: 'done',
          processed_at: new Date(),
        }).eq('id', item.id);

        results.push({ success: true, highlight: highlight.id });
        console.log(`✅ Highlight rendered: ${match.home_team} vs ${match.away_team} (${item.event_type})`);
      } else {
        await supabase.from('highlights').update({ status: 'failed' }).eq('id', highlight.id);
        await supabase.from('highlight_queue').update({
          status: 'failed',
          error: clipResult.error,
          retry_count: item.retry_count + 1,
        }).eq('id', item.id);
        results.push({ success: false, error: clipResult.error });
      }
    } catch (err) {
      await supabase.from('highlights').update({ status: 'failed' }).eq('id', highlight.id);
      await supabase.from('highlight_queue').update({
        status: 'failed',
        error: err.message,
      }).eq('id', item.id);
      results.push({ success: false, error: err.message });
    }
  }

  return { processed: results.length, results };
}

/**
 * Main detection loop — runs via cron every 2 min during matches
 */
export async function runDetectionCycle() {
  console.log('🔍 Starting goal detection cycle...');
  const startTime = Date.now();

  // Find live matches with stream URLs
  const { data: liveMatches } = await supabase
    .from('world_cup_matches')
    .select('*')
    .in('status', ['live', 'halftime'])
    .not('stream_url', 'is.null');

  if (!liveMatches?.length) {
    console.log('📭 No live matches to monitor');
    return { detected: 0, rendered: 0 };
  }

  console.log(`📺 Monitoring ${liveMatches.length} live matches`);

  // Check for new events
  const newEvents = await detectNewEvents();

  if (newEvents.length > 0) {
    console.log(`⚽ Found ${newEvents.length} new events!`);
    
    // Queue highlights
    for (const evt of newEvents) {
      await supabase.from('highlight_queue').insert({
        match_id: evt.match_id,
        event_type: evt.event_type,
        minute: evt.minute,
        player: evt.player,
        team: evt.team,
        priority: evt.priority,
      });
    }
  }

  // Process any queued highlights
  const renderResult = await processHighlightQueue();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Cycle complete in ${elapsed}s — ${newEvents.length} events, ${renderResult.processed} rendered`);

  return {
    detected: newEvents.length,
    rendered: renderResult.processed,
    elapsed: `${elapsed}s`,
    events: newEvents,
  };
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

const mode = process.argv.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'all';

if (mode === 'detect' || mode === 'all') {
  runDetectionCycle().then(r => {
    console.log('Detection result:', JSON.stringify(r, null, 2));
    process.exit(r.detected >= 0 ? 0 : 1);
  });
}

if (mode === 'clip' || mode === 'all') {
  processHighlightQueue().then(r => {
    console.log('Render result:', JSON.stringify(r, null, 2));
    process.exit(0);
  });
}

export default runDetectionCycle;
