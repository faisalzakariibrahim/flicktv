/**
 * FlickTV AI — User Routes
 */

import { Router } from 'express';
import { supabase } from '../server.js';
import { logger } from '../utils/logger.js';

const router = Router();

const FREE_STREAM_LIMIT = parseInt(process.env.FREE_STREAM_LIMIT || '3');

// ─── Get Profile ──────────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, display_name, avatar_url, provider, plan, plan_expires_at, preferences, streams_watched, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) return res.status(404).json({ error: 'Profile not found' });

    const streamsRemaining = data.plan === 'free'
      ? Math.max(0, FREE_STREAM_LIMIT - (data.streams_watched || 0))
      : null;

    res.json({ user: { ...data, streams_remaining: streamsRemaining } });
  } catch (err) {
    logger.error('Get profile error', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ─── Update Profile ───────────────────────────────────────────────────────────
router.put('/me', async (req, res) => {
  const allowed = ['display_name', 'avatar_url', 'preferences'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, display_name, avatar_url, preferences')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ user: data });
  } catch (err) {
    logger.error('Update profile error', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── Watch History ────────────────────────────────────────────────────────────
router.get('/me/history', async (req, res) => {
  const { page = 1, limit = 30 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const { data, error, count } = await supabase
      .from('watch_history')
      .select('id, channel_id, channel_name, channel_logo, stream_url, watched_at, duration_secs', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('watched_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ history: data, total: count });
  } catch (err) {
    logger.error('Watch history error', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ─── Clear History ────────────────────────────────────────────────────────────
router.delete('/me/history', async (req, res) => {
  try {
    const { error } = await supabase
      .from('watch_history')
      .delete()
      .eq('user_id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Watch history cleared' });
  } catch (err) {
    logger.error('Clear history error', err);
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

// ─── Subscription Status ──────────────────────────────────────────────────────
router.get('/me/subscription', async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('plan, plan_expires_at, streams_watched')
      .eq('id', req.user.id)
      .single();

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    const isFree = user?.plan === 'free';
    const streamsUsed = user?.streams_watched || 0;

    res.json({
      plan: user?.plan || 'free',
      plan_expires_at: user?.plan_expires_at || null,
      subscription: sub || null,
      freemium: isFree ? {
        streams_used: streamsUsed,
        streams_limit: FREE_STREAM_LIMIT,
        streams_remaining: Math.max(0, FREE_STREAM_LIMIT - streamsUsed),
        limit_reached: streamsUsed >= FREE_STREAM_LIMIT,
      } : null,
    });
  } catch (err) {
    logger.error('Subscription status error', err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// ─── Upgrade Plan (placeholder — real payment via in-app purchase) ────────────
router.post('/me/subscription/upgrade', async (req, res) => {
  const { plan = 'premium', provider, provider_sub_id } = req.body;

  try {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1); // 1-month default

    await supabase.from('users').update({
      plan,
      plan_expires_at: expiresAt,
    }).eq('id', req.user.id);

    await supabase.from('subscriptions').upsert({
      user_id: req.user.id,
      plan,
      status: 'active',
      provider: provider || 'manual',
      provider_sub_id: provider_sub_id || null,
      starts_at: new Date(),
      ends_at: expiresAt,
    }, { onConflict: 'user_id' });

    res.json({ message: 'Plan upgraded successfully', plan, expires_at: expiresAt });
  } catch (err) {
    logger.error('Upgrade error', err);
    res.status(500).json({ error: 'Failed to upgrade plan' });
  }
});

// ─── Register Device ──────────────────────────────────────────────────────────
router.post('/me/devices', async (req, res) => {
  const { device_name, device_type, push_token } = req.body;

  try {
    await supabase.from('devices').upsert({
      user_id: req.user.id,
      device_name: device_name || 'Unknown device',
      device_type: device_type || 'mobile',
      push_token: push_token || null,
      last_active: new Date(),
    }, { onConflict: 'push_token' });

    res.json({ message: 'Device registered' });
  } catch (err) {
    logger.error('Register device error', err);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

export default router;
