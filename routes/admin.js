/**
 * FlickTV AI — Admin Routes
 * Supports both password-based auth (admin dashboard) and JWT+is_admin (API)
 */

import { Router } from 'express';
import { supabase } from '../server.js';
import { logger } from '../utils/logger.js';
import { requireAdminPassword } from '../middleware/auth.js';
import { parseM3U } from '../parsers/m3uParser.js';
import fetch from 'node-fetch';

const router = Router();

// All admin routes require admin role (password or JWT)
router.use(requireAdminPassword);

// ═══════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const [{ count: total }, { count: working }, { count: notWorking }] = await Promise.all([
      supabase.from('channels').select('*', { count: 'exact', head: true }),
      supabase.from('channels').select('*', { count: 'exact', head: true }).eq('is_working', true),
      supabase.from('channels').select('*', { count: 'exact', head: true }).eq('is_working', false),
    ]);

    const { data: byCategory } = await supabase
      .from('channels')
      .select('category', { count: 'exact' });

    const categoryMap = {};
    for (const row of (byCategory || [])) {
      categoryMap[row.category] = (categoryMap[row.category] || 0) + 1;
    }

    const { data: lastScan } = await supabase
      .from('channels')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    // Also get user stats
    const [{ count: totalUsers }, { count: totalPlaylists }] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('playlists').select('id', { count: 'exact', head: true }),
    ]);

    res.json({
      total: total || 0,
      working: working || 0,
      notWorking: notWorking || 0,
      byCategory,
      lastScan: lastScan?.[0]?.created_at || null,
      total_users: totalUsers || 0,
      total_playlists: totalPlaylists || 0,
    });
  } catch (err) {
    logger.error('Admin stats error', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CHANNEL MANAGEMENT
// ═══════════════════════════════════════════════════════════════
router.get('/channels', async (req, res) => {
  const {
    page = 1, limit = 50, search, category, country,
    is_working, is_hd, sort_by = 'created_at', sort_dir = 'desc'
  } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = supabase
    .from('channels')
    .select('*', { count: 'exact' })
    .order(sort_by, { ascending: sort_dir === 'asc' })
    .range(offset, offset + parseInt(limit) - 1);

  if (search) query = query.or(`name.ilike.%${search}%,stream_url.ilike.%${search}%`);
  if (category) query = query.eq('category', category);
  if (country) query = query.eq('country', country);
  if (is_working !== undefined) query = query.eq('is_working', is_working === 'true');
  if (is_hd !== undefined) query = query.eq('is_hd', is_hd === 'true');

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({
    channels: data,
    total: count,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(count / parseInt(limit)),
  });
});

router.post('/channels', async (req, res) => {
  const { name, stream_url, logo_url, category, country, language, group_title, is_hd, is_4k } = req.body;
  if (!name || !stream_url) return res.status(400).json({ error: 'name and stream_url are required' });

  const { data: existing } = await supabase.from('channels').select('id').eq('stream_url', stream_url).single();
  if (existing) return res.status(409).json({ error: 'Channel with this stream URL already exists', id: existing.id });

  const { data, error } = await supabase.from('channels').insert({
    name, stream_url, logo_url: logo_url || null, category: category || 'general',
    country: country || null, language: language || null, group_title: group_title || null,
    is_hd: is_hd || false, is_4k: is_4k || false, is_live: true, is_working: true, stream_info: {},
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/channels/:id', async (req, res) => {
  const updates = { ...req.body, updated_at: new Date() };
  delete updates.id;
  const { data, error } = await supabase.from('channels').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/channels/:id', async (req, res) => {
  const { error } = await supabase.from('channels').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.post('/channels/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
  const { error } = await supabase.from('channels').delete().in('id', ids);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, deleted: ids.length });
});

router.post('/channels/:id/reverify', async (req, res) => {
  const { data: channel } = await supabase.from('channels').select('stream_url').eq('id', req.params.id).single();
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(channel.stream_url, { method: 'HEAD', signal: controller.signal, headers: { 'User-Agent': 'FlickTV/1.0' } });
    clearTimeout(timer);
    const isAlive = response.ok;
    await supabase.from('channels').update({ is_working: isAlive, last_checked: new Date(), updated_at: new Date() }).eq('id', req.params.id);
    res.json({ alive: isAlive, status: response.status });
  } catch {
    await supabase.from('channels').update({ is_working: false, last_checked: new Date(), updated_at: new Date() }).eq('id', req.params.id);
    res.json({ alive: false, status: 0 });
  }
});

// ═══════════════════════════════════════════════════════════════
// SCAN SOURCES MANAGEMENT
// ═══════════════════════════════════════════════════════════════
router.get('/scan-sources', async (req, res) => {
  const { data, error } = await supabase.from('scan_sources').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/scan-sources', async (req, res) => {
  const { name, url, source_type = 'm3u', category = null, country = null, is_active = true } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url are required' });
  const { data, error } = await supabase.from('scan_sources').insert({ name, url, source_type, category, country, is_active }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/scan-sources/:id', async (req, res) => {
  const updates = { ...req.body, updated_at: new Date() };
  delete updates.id;
  const { data, error } = await supabase.from('scan_sources').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/scan-sources/:id', async (req, res) => {
  const { error } = await supabase.from('scan_sources').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.post('/scan-sources/:id/test', async (req, res) => {
  const { data: source } = await supabase.from('scan_sources').select('url').eq('id', req.params.id).single();
  if (!source) return res.status(404).json({ error: 'Source not found' });
  try {
    const response = await fetch(source.url, { headers: { 'User-Agent': 'FlickTV/1.0' }, timeout: 15000 });
    const text = await response.text();
    const channels = parseM3U(text);
    res.json({ success: true, channelCount: channels.length, sample: channels.slice(0, 3).map(c => c.name) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// RUN SCAN (manual trigger)
// ═══════════════════════════════════════════════════════════════
router.post('/scan', async (req, res) => {
  const startTime = Date.now();

  const { data: sources, error: srcError } = await supabase.from('scan_sources').select('*').eq('is_active', true);
  if (srcError) return res.status(500).json({ error: srcError.message });

  const defaultSources = getDefaultScanSources();
  const allSources = [...(sources || []), ...defaultSources];

  let totalScanned = 0, totalNew = 0;
  const totalErrors = [], skipped = [];

  let from = 0, batchSize = 1000;
  let existingUrls = new Set();
  while (true) {
    const { data } = await supabase.from('channels').select('stream_url').range(from, from + batchSize - 1);
    if (!data || data.length === 0) break;
    data.forEach(c => existingUrls.add(c.stream_url));
    from += batchSize;
    if (data.length < batchSize) break;
  }

  for (const source of allSources) {
    try {
      const response = await fetch(source.url, { headers: { 'User-Agent': 'FlickTV/1.0' }, timeout: 30000 });
      const text = await response.text();
      const parsed = parseM3U(text);
      totalScanned += parsed.length;
      const newChannels = parsed.filter(ch => !existingUrls.has(ch.stream_url));

      for (let i = 0; i < newChannels.length; i += 50) {
        const batch = newChannels.slice(i, i + 50).map(ch => ({
          name: ch.name, stream_url: ch.stream_url, logo_url: ch.logo_url,
          group_title: ch.group_title, tvg_id: ch.tvg_id, tvg_name: ch.tvg_name || ch.name,
          country: ch.country || source.country || null, language: ch.language,
          category: ch.category || source.category || 'general',
          is_hd: ch.is_hd || false, is_4k: ch.is_4k || false, is_live: true, is_working: true, stream_info: {},
        }));
        const { data: inserted, error } = await supabase.from('channels').insert(batch).select();
        if (error) totalErrors.push({ source: source.name, error: error.message });
        else if (inserted) { totalNew += inserted.length; inserted.forEach(c => existingUrls.add(c.stream_url)); }
      }
    } catch (err) { skipped.push({ source: source.name, error: err.message }); }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  res.json({ success: true, elapsed: `${elapsed}s`, sourcesScanned: allSources.length, totalScanned, totalNew, totalExisting: existingUrls.size, errors: totalErrors, skipped });
});

function getDefaultScanSources() {
  const iptvBase = 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams';
  const categories = ['news', 'sports', 'movies', 'kids', 'music', 'documentary', 'religious', 'general'];
  const languages = ['ara', 'fra', 'spa', 'hin', 'por', 'rus', 'urd', 'tur', 'deu', 'ita'];
  const countries = ['us', 'gb', 'ca', 'au', 'in', 'pk', 'ng', 'za', 'eg', 'ae', 'sa', 'iq', 'jo', 'lb', 'ma', 'tn', 'dz', 'fr', 'de', 'es'];
  const sources = [];
  for (const cat of categories) sources.push({ name: `iptv-org: ${cat}`, url: `${iptvBase}/${cat}.m3u`, source_type: 'm3u', category: cat });
  for (const lang of languages) sources.push({ name: `iptv-org: ${lang}`, url: `${iptvBase}/${lang}.m3u`, source_type: 'm3u', language: lang });
  for (const c of countries) sources.push({ name: `iptv-org: ${c.toUpperCase()}`, url: `${iptvBase}/${c}.m3u`, source_type: 'm3u', country: c });
  return sources;
}

// ═══════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════
router.get('/users', async (req, res) => {
  const { page = 1, limit = 50, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    let query = supabase
      .from('users')
      .select('id, email, display_name, plan, is_admin, is_banned, streams_watched, created_at, last_seen_at', { count: 'exact' })
      .range(offset, offset + parseInt(limit) - 1)
      .order('created_at', { ascending: false });
    if (search) query = query.ilike('email', `%${search}%`);
    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ users: data, total: count });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch users' }); }
});

router.put('/users/:id/ban', async (req, res) => {
  const { banned } = req.body;
  try {
    const { data, error } = await supabase.from('users').update({ is_banned: !!banned }).eq('id', req.params.id).select('id, email, is_banned').single();
    if (error || !data) return res.status(404).json({ error: 'User not found' });
    res.json({ user: data });
  } catch (err) { res.status(500).json({ error: 'Failed to update user' }); }
});

router.put('/users/:id/plan', async (req, res) => {
  const { plan } = req.body;
  const validPlans = ['free', 'premium', 'enterprise'];
  if (!validPlans.includes(plan)) return res.status(400).json({ error: `plan must be one of: ${validPlans.join(', ')}` });
  try {
    const { data, error } = await supabase.from('users').update({ plan }).eq('id', req.params.id).select('id, email, plan').single();
    if (error || !data) return res.status(404).json({ error: 'User not found' });
    res.json({ user: data });
  } catch (err) { res.status(500).json({ error: 'Failed to change plan' }); }
});

router.get('/events', async (req, res) => {
  const { event_type, limit = 100 } = req.query;
  try {
    let query = supabase.from('analytics_events').select('id, user_id, event_type, channel_id, device_type, created_at').order('created_at', { ascending: false }).limit(parseInt(limit));
    if (event_type) query = query.eq('event_type', event_type);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ events: data });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch events' }); }
});

export default router;
