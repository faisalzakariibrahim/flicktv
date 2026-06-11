/**
 * FlickTV AI — Production Backend
 * Node.js + Express + Supabase + AI
 * Phase 1 MVP
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';
import { parseM3U } from './parsers/m3uParser.js';
import { parseXMLTV } from './parsers/xmltvParser.js';
import authRouter from './routes/auth.js';
import playlistRouter from './routes/playlists.js';
import channelRouter from './routes/channels.js';
import userRouter from './routes/users.js';
import aiRouter from './routes/ai.js';
import adminRouter from './routes/admin.js';
import { startStreamHealthWorker } from './workers/streamHealthWorker.js';
import { startDailyChannelScan } from './workers/dailyScanWorker.js';
import { startWorldCupWorker } from './workers/worldCupWorker.js';
import { verifyToken } from './middleware/auth.js';
import { logger } from './utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Supabase ────────────────────────────────────────────────────────────────
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── Anthropic ───────────────────────────────────────────────────────────────
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'AI rate limit exceeded.' },
});

app.use('/api/', globalLimiter);
app.use('/api/ai/', aiLimiter);

// ─── Request Logging ──────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip, ua: req.get('user-agent') });
  next();
});

// ─── Admin Dashboard (static) ─────────────────────────────────────────────────
app.use('/admin', express.static(path.join(__dirname, '..', 'public'), { index: 'admin.html' }));
// Redirect /admin to /admin/ so express.static serves the index file
app.get('/admin', (_req, res) => res.redirect('/admin/'));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/playlists', verifyToken, playlistRouter);
app.use('/api/channels', verifyToken, channelRouter);
app.use('/api/users', verifyToken, userRouter);
app.use('/api/ai', verifyToken, aiRouter);
app.use('/api/admin', verifyToken, adminRouter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ─── Stream Proxy (avoids CORS issues for HLS streams) ───────────────────────
app.get('/api/proxy/stream', verifyToken, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const decoded = decodeURIComponent(url);
    const response = await fetch(decoded, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)',
      },
    });

    // Forward headers
    res.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    res.set('Access-Control-Allow-Origin', '*');

    response.body.pipe(res);
  } catch (err) {
    logger.error('Stream proxy error', err);
    res.status(502).json({ error: 'Stream unavailable' });
  }
});

// ─── M3U Parser Endpoint ─────────────────────────────────────────────────────
app.post('/api/parse/m3u', verifyToken, async (req, res) => {
  const { url, content } = req.body;

  try {
    let m3uContent = content;

    if (url && !content) {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)' },
        timeout: 30000,
      });
      m3uContent = await response.text();
    }

    if (!m3uContent) return res.status(400).json({ error: 'No M3U content provided' });

    const channels = parseM3U(m3uContent);
    res.json({ success: true, count: channels.length, channels });
  } catch (err) {
    logger.error('M3U parse error', err);
    res.status(500).json({ error: 'Failed to parse M3U' });
  }
});

// ─── XMLTV / EPG Parser ───────────────────────────────────────────────────────
app.post('/api/parse/epg', verifyToken, async (req, res) => {
  const { url } = req.body;
  try {
    const response = await fetch(url, { timeout: 60000 });
    const xml = await response.text();
    const epg = parseXMLTV(xml);
    res.json({ success: true, ...epg });
  } catch (err) {
    logger.error('EPG parse error', err);
    res.status(500).json({ error: 'Failed to parse EPG' });
  }
});

// ─── Stream Health Check ──────────────────────────────────────────────────────
app.post('/api/stream/health', verifyToken, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)' },
    });
    clearTimeout(timeout);

    res.json({
      alive: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
    });
  } catch {
    res.json({ alive: false, status: 0, error: 'Stream unreachable' });
  }
});

// ─── Xtream Codes API ─────────────────────────────────────────────────────────
app.post('/api/xtream/authenticate', verifyToken, async (req, res) => {
  const { server, username, password } = req.body;

  try {
    const url = `${server}/player_api.php?username=${username}&password=${password}`;
    const response = await fetch(url, { timeout: 15000 });
    const data = await response.json();

    if (data.user_info) {
      res.json({ success: true, userInfo: data.user_info, serverInfo: data.server_info });
    } else {
      res.status(401).json({ error: 'Invalid Xtream credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Xtream connection failed' });
  }
});

app.post('/api/xtream/channels', verifyToken, async (req, res) => {
  const { server, username, password } = req.body;
  try {
    const url = `${server}/player_api.php?username=${username}&password=${password}&action=get_live_streams`;
    const response = await fetch(url, { timeout: 30000 });
    const channels = await response.json();
    res.json({ success: true, channels });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Xtream channels' });
  }
});

// ─── World Cup API ─────────────────────────────────────────────────────────────
import { parseWorldCup } from './parsers/worldCupParser.js';
import { runDetectionCycle, processHighlightQueue } from './workers/highlightClipper.js';
import { postAllReadyHighlights } from './workers/socialPoster.js';

// Public: Get World Cup matches (no auth needed)
app.get('/api/worldcup/matches', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('world_cup_matches')
      .select('*, match_events(*)')
      .order('kickoff_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ success: true, matches: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: Get live World Cup matches
app.get('/api/worldcup/live', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('v_live_matches')
      .select('*')
      .limit(20);
    if (error) throw error;
    res.json({ success: true, matches: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: Get highlights
app.get('/api/worldcup/highlights', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('highlights')
      .select('*, world_cup_matches(home_team, away_team, home_flag, away_flag)')
      .in('status', ['ready', 'posted_youtube', 'posted_tiktok', 'posted_both'])
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ success: true, highlights: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Trigger World Cup match discovery
app.post('/api/worldcup/discover', verifyToken, async (_req, res) => {
  try {
    const { triggerDiscovery } = await import('./workers/worldCupWorker.js');
    const result = await triggerDiscovery();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Trigger goal detection
app.post('/api/worldcup/detect', verifyToken, async (_req, res) => {
  try {
    const result = await runDetectionCycle();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Trigger highlight rendering
app.post('/api/worldcup/render', verifyToken, async (_req, res) => {
  try {
    const result = await processHighlightQueue();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Post highlights to social media
app.post('/api/worldcup/post', verifyToken, async (_req, res) => {
  try {
    const result = await postAllReadyHighlights();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Add a World Cup match manually
app.post('/api/worldcup/matches', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('world_cup_matches').insert(req.body).select().single();
    if (error) throw error;
    res.json({ success: true, match: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Update a World Cup match
app.put('/api/worldcup/matches/:id', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('world_cup_matches')
      .update({ ...req.body, updated_at: new Date() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, match: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 FlickTV AI Backend running on port ${PORT}`);
});

// ─── Background Workers ───────────────────────────────────────────────────────
startStreamHealthWorker();
startDailyChannelScan();
startWorldCupWorker();

export default app;
