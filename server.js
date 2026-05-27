/**
 * FlickTV AI — Production Backend
 * Node.js + Express + Supabase + Anthropic Claude
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';
import { parseM3U } from './parsers/m3uParser.js';
import { parseXMLTV } from './parsers/xmltvParser.js';
import authRouter from './routes/auth.js';
import playlistRouter from './routes/playlists.js';
import channelRouter from './routes/channels.js';
import userRouter from './routes/users.js';
import aiRouter from './ai.js';
import adminRouter from './routes/admin.js';
import { verifyToken } from './middleware/auth.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3001;
const FREE_STREAM_LIMIT = parseInt(process.env.FREE_STREAM_LIMIT || '3');

// ─── Supabase ─────────────────────────────────────────────────────────────────
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { realtime: { transport: WebSocket } }
);

// ─── Anthropic ────────────────────────────────────────────────────────────────
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

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
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

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

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

// ─── Stream Proxy (CORS bypass for HLS) ──────────────────────────────────────
app.get('/api/proxy/stream', verifyToken, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    // ── Freemium gate ──────────────────────────────────────────────────────────
    const { data: user } = await supabase
      .from('users')
      .select('plan, streams_watched')
      .eq('id', req.user.id)
      .single();

    if (user?.plan === 'free' && (user?.streams_watched || 0) >= FREE_STREAM_LIMIT) {
      return res.status(402).json({
        error: 'Free plan limit reached',
        code: 'UPGRADE_REQUIRED',
        streams_used: user.streams_watched,
        streams_limit: FREE_STREAM_LIMIT,
        message: `You've used your ${FREE_STREAM_LIMIT} free streams. Upgrade to Premium to keep watching.`,
      });
    }

    // Increment stream counter for free users
    if (user?.plan === 'free') {
      await supabase
        .from('users')
        .update({ streams_watched: (user.streams_watched || 0) + 1 })
        .eq('id', req.user.id);
    }
    // ──────────────────────────────────────────────────────────────────────────

    const decoded = decodeURIComponent(url);
    const response = await fetch(decoded, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)' },
    });

    res.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    res.set('Access-Control-Allow-Origin', '*');
    response.body.pipe(res);
  } catch (err) {
    logger.error('Stream proxy error', err);
    res.status(502).json({ error: 'Stream unavailable' });
  }
});

// ─── M3U Parse Endpoint ───────────────────────────────────────────────────────
app.post('/api/parse/m3u', verifyToken, async (req, res) => {
  const { url, content } = req.body;

  try {
    let m3uContent = content;
    if (url && !content) {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)' },
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

// ─── EPG Parse Endpoint ───────────────────────────────────────────────────────
app.post('/api/parse/epg', verifyToken, async (req, res) => {
  const { url } = req.body;
  try {
    const response = await fetch(url);
    const xml = await response.text();
    const epg = await parseXMLTV(xml);
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
    res.json({ alive: response.ok, status: response.status, contentType: response.headers.get('content-type') });
  } catch {
    res.json({ alive: false, status: 0, error: 'Stream unreachable' });
  }
});

// ─── Xtream Auth ──────────────────────────────────────────────────────────────
app.post('/api/xtream/authenticate', verifyToken, async (req, res) => {
  const { server, username, password } = req.body;
  try {
    const url = `${server}/player_api.php?username=${username}&password=${password}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.user_info) {
      res.json({ success: true, userInfo: data.user_info, serverInfo: data.server_info });
    } else {
      res.status(401).json({ error: 'Invalid Xtream credentials' });
    }
  } catch {
    res.status(500).json({ error: 'Xtream connection failed' });
  }
});

app.post('/api/xtream/channels', verifyToken, async (req, res) => {
  const { server, username, password } = req.body;
  try {
    const url = `${server}/player_api.php?username=${username}&password=${password}&action=get_live_streams`;
    const response = await fetch(url);
    const channels = await response.json();
    res.json({ success: true, channels });
  } catch {
    res.status(500).json({ error: 'Failed to fetch Xtream channels' });
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
  logger.info(`FlickTV AI backend running on port ${PORT}`);
});

export default app;
