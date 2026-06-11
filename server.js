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
import { parseWorldCup } from './backend/src/parsers/worldCupParser.js';
import { runDetectionCycle, processHighlightQueue } from './backend/src/workers/highlightClipper.js';
import { postAllReadyHighlights } from './backend/src/workers/socialPoster.js';
import authRouter from './routes/auth.js';
import playlistRouter from './routes/playlists.js';
import channelRouter from './routes/channels.js';
import userRouter from './routes/users.js';
import aiRouter from './ai.js';
import adminRouter from './routes/admin.js';
import sportsRouter from './routes/sports.js';
import { verifyToken, requireAuth } from './middleware/auth.js';
import { logger } from './utils/logger.js';
import { seedChannelsIfNeeded } from './scripts/seedChannels.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
// Trust Railway/Vercel load balancer so req.protocol reflects X-Forwarded-Proto (https)
// Without this, rewritten HLS segment URLs use http:// and get blocked as mixed content
app.set('trust proxy', 1);
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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  // Exclude stream proxy — HLS playback makes a request every ~4s per viewer
  skip: (req) => req.path.startsWith('/proxy/'),
});

// Separate generous limiter for the stream proxy
const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3000, // ~50 req/s — allows many simultaneous viewers with continuous HLS
  standardHeaders: false,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'AI rate limit exceeded.' },
});

app.use('/api/', globalLimiter);
app.use('/api/', proxyLimiter);
app.use('/api/ai/', aiLimiter);

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ─── Admin Dashboard (static) ─────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/admin', express.static(path.join(__dirname, 'backend', 'public'), { index: 'admin.html' }));
app.get('/admin', (_req, res) => res.redirect('/admin/'));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/playlists', verifyToken, playlistRouter);
app.use('/api/channels', verifyToken, channelRouter);  // soft auth — public browsing OK
app.use('/api/users', requireAuth, userRouter);
app.use('/api/ai', requireAuth, aiRouter);
app.use('/api/admin', adminRouter);
app.use('/api/sports', sportsRouter);  // public — no auth needed

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ─── Stream Proxy (CORS bypass + HLS manifest rewriting + Plex token injection) ──
app.get('/api/proxy/stream', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const decoded = decodeURIComponent(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    // Detect Plex EPG provider URLs and inject auth token
    const isPlex = decoded.includes('epg.provider.plex.tv') || decoded.includes('epg-ipv4.provider.plex.tv');
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'Referer': new URL(decoded).origin + '/',
      'Origin': new URL(decoded).origin,
    };
    if (isPlex) {
      // Plex web player public token — allows unauthenticated HLS playback
      fetchHeaders['X-Plex-Token'] = '9F1pDPzr73oL_idfzXye';
      fetchHeaders['X-Plex-Product'] = 'FlickTV';
    }

    const response = await fetch(decoded, {
      signal: controller.signal,
      headers: fetchHeaders,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    // Plex returns 401 without token, 302 with token
    if (response.status === 401) {
      return res.status(401).json({ error: 'Stream authentication required' });
    }
    if (!response.ok && response.status !== 302) {
      return res.status(response.status).json({ error: `Upstream ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || '';
    const isHLS = contentType.includes('mpegurl') || decoded.includes('.m3u8') || response.url.includes('.m3u8');

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Range');

    if (isHLS) {
      // Rewrite manifest so all segment/sub-playlist URLs go through this proxy
      const text = await response.text();
      // Use the final URL (after redirects) as the base for manifest rewriting
      const finalUrl = response.url || decoded;
      const rewritten = rewriteM3U8(text, finalUrl, req);
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(rewritten);
    }

    res.set('Content-Type', contentType || 'video/mp2t');
    response.body.pipe(res);
  } catch (err) {
    logger.error('Stream proxy error', err);
    res.status(502).json({ error: 'Stream unavailable' });
  }
});

function rewriteM3U8(content, manifestUrl, req) {
  const base = new URL(manifestUrl);
  const proxyBase = `${req.protocol}://${req.get('host')}/api/proxy/stream?url=`;

  return content.split('\n').map(line => {
    const trimmed = line.trim();
    // Skip empty lines and pure directive lines (but NOT lines with URIs in them)
    if (!trimmed || (trimmed.startsWith('#') && !trimmed.includes('URI="'))) return line;

    // Rewrite URI="..." attributes inside tags (e.g. #EXT-X-KEY, #EXT-X-MAP)
    if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
      return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
        return `URI="${proxyBase}${encodeURIComponent(resolveUrl(uri, base))}"`;
      });
    }

    // Segment / sub-playlist URL lines
    if (!trimmed.startsWith('#')) {
      const absolute = resolveUrl(trimmed, base);
      return `${proxyBase}${encodeURIComponent(absolute)}`;
    }

    return line;
  }).join('\n');
}

function resolveUrl(url, base) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `${base.protocol}${url}`;
  if (url.startsWith('/')) return `${base.protocol}//${base.host}${url}`;
  return new URL(url, base.href).href;
}

// ─── M3U Parse Endpoint ───────────────────────────────────────────────────────
app.post('/api/parse/m3u', async (req, res) => {
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
app.post('/api/parse/epg', async (req, res) => {
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
app.post('/api/stream/health', async (req, res) => {
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

// ─── World Cup API ─────────────────────────────────────────────────────────────

// Public: Get World Cup matches
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
app.post('/api/worldcup/discover', async (_req, res) => {
  try {
    const result = await parseWorldCup();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Trigger goal detection
app.post('/api/worldcup/detect', async (_req, res) => {
  try {
    const result = await runDetectionCycle();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Trigger highlight rendering
app.post('/api/worldcup/render', async (_req, res) => {
  try {
    const result = await processHighlightQueue();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Post highlights to social media
app.post('/api/worldcup/post', async (_req, res) => {
  try {
    const result = await postAllReadyHighlights();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Add a World Cup match manually
app.post('/api/worldcup/matches', async (req, res) => {
  try {
    const { data, error } = await supabase.from('world_cup_matches').insert(req.body).select().single();
    if (error) throw error;
    res.json({ success: true, match: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Update a World Cup match
app.put('/api/worldcup/matches/:id', async (req, res) => {
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
  logger.info(`FlickTV AI backend running on port ${PORT}`);
  seedChannelsIfNeeded().catch(err => logger.error('Seed error', err));
  // World Cup worker: match discovery + goal detection
  startWorldCupCron();
});

// ─── World Cup Cron ────────────────────────────────────────────────────────────
import cron from 'node-cron';

function startWorldCupCron() {
  // Match discovery: every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const wc = await parseWorldCup();
      if (wc.channels.length) {
        const { data: existing } = await supabase.from('channels').select('stream_url');
        const existingUrls = new Set(existing?.map(c => c.stream_url) || []);
        const newCh = wc.channels.filter(ch => !existingUrls.has(ch.stream_url));
        if (newCh.length) {
          for (let i = 0; i < newCh.length; i += 50) {
            const batch = newCh.slice(i, i + 50).map(ch => ({
              name: ch.name, stream_url: ch.stream_url, logo_url: ch.logo_url,
              group_title: ch.group_title || 'FIFA World Cup 2026',
              tvg_id: ch.tvg_id, tvg_name: ch.tvg_name || ch.name,
              country: ch.country, language: ch.language, category: 'sports',
              is_hd: ch.is_hd || false, is_4k: ch.is_4k || false,
              is_live: true, is_working: true, stream_info: ch.stream_info || {},
            }));
            const { data: inserted } = await supabase.from('channels').insert(batch).select();
            if (inserted) inserted.forEach(c => existingUrls.add(c.stream_url));
          }
        }
        logger.info(`WC Discovery: +${newCh.length} channels from ${wc.matches.length} matches`);
      }
    } catch (err) { logger.error('WC discovery error:', err.message); }
  });

  // Goal detection + highlight rendering: every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    try { await runDetectionCycle(); } catch (err) { logger.error('WC detection error:', err.message); }
  });

  // Social media posting: every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try { await postAllReadyHighlights(); } catch (err) { logger.error('WC posting error:', err.message); }
  });

  logger.info('✅ World Cup cron started (discovery 5min, detection 2min, posting 10min)');
}

export default app;
