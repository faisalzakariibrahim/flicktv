/**
 * FlickTV AI — Admin Routes
 * All routes require verifyToken + requireAdmin (applied in server.js).
 */

import { Router } from 'express';
import { supabase } from '../server.js';
import { logger } from '../utils/logger.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// All admin routes require admin role
router.use(requireAdmin);

// ─── Platform Stats ───────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [users, channels, playlists, events24h] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('channels').select('id', { count: 'exact', head: true }),
      supabase.from('playlists').select('id', { count: 'exact', head: true }),
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    ]);

    res.json({
      total_users: users.count || 0,
      total_channels: channels.count || 0,
      total_playlists: playlists.count || 0,
      events_last_24h: events24h.count || 0,
    });
  } catch (err) {
    logger.error('Admin stats error', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── List Users ───────────────────────────────────────────────────────────────
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
  } catch (err) {
    logger.error('Admin list users error', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ─── Ban / Unban User ─────────────────────────────────────────────────────────
router.put('/users/:id/ban', async (req, res) => {
  const { banned } = req.body;
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot ban yourself' });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_banned: !!banned })
      .eq('id', req.params.id)
      .select('id, email, is_banned')
      .single();

    if (error || !data) return res.status(404).json({ error: 'User not found' });
    res.json({ user: data });
  } catch (err) {
    logger.error('Ban user error', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ─── Change User Plan ─────────────────────────────────────────────────────────
router.put('/users/:id/plan', async (req, res) => {
  const { plan } = req.body;
  const validPlans = ['free', 'premium', 'enterprise'];
  if (!validPlans.includes(plan)) {
    return res.status(400).json({ error: `plan must be one of: ${validPlans.join(', ')}` });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .update({ plan })
      .eq('id', req.params.id)
      .select('id, email, plan')
      .single();

    if (error || !data) return res.status(404).json({ error: 'User not found' });
    res.json({ user: data });
  } catch (err) {
    logger.error('Change plan error', err);
    res.status(500).json({ error: 'Failed to change plan' });
  }
});

// ─── Recent Analytics Events ──────────────────────────────────────────────────
router.get('/events', async (req, res) => {
  const { event_type, limit = 100 } = req.query;

  try {
    let query = supabase
      .from('analytics_events')
      .select('id, user_id, event_type, channel_id, device_type, created_at')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (event_type) query = query.eq('event_type', event_type);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ events: data });
  } catch (err) {
    logger.error('Admin events error', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

export default router;
