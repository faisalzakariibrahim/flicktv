import { Router } from 'express';
import { supabase } from '../server.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ─── List Channels ─────────────────────────────────────────────────────────────
// Public — no auth required. Unauthenticated users see all channels.
router.get('/', async (req, res) => {
  const { search, category, country, playlist_id, is_live, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = supabase
      .from('channels')
      .select('id, name, logo_url, category, group_title, country, is_hd, is_4k, is_live, is_working, stream_url', { count: 'exact' })
      .range(offset, offset + parseInt(limit) - 1)
      .order('name');

    // System channels (user_id IS NULL) are always visible.
    // Authenticated users also see their own private channels.
    if (req.user) {
      query = query.or(`user_id.is.null,user_id.eq.${req.user.id}`);
    } else {
      query = query.is('user_id', null);
    }

    if (search) query = query.ilike('name', `%${search}%`);
    if (category) query = query.eq('category', category);
    if (country) query = query.eq('country', country);
    if (playlist_id) query = query.eq('playlist_id', playlist_id);
    if (is_live === 'true') query = query.eq('is_live', true);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json({ channels: data, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    logger.error('List channels error', err);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// ─── Trending Channels ─────────────────────────────────────────────────────────
router.get('/trending', async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_trending_channels', { p_limit: 20 });
    if (error) return res.status(500).json({ error: error.message });

    if (!data?.length) return res.json({ channels: [] });

    const ids = data.map(r => r.channel_id);
    const { data: channels } = await supabase
      .from('channels')
      .select('id, name, logo_url, category, country, is_hd, is_live')
      .in('id', ids);

    const withCount = channels?.map(ch => ({
      ...ch,
      watch_count: data.find(r => r.channel_id === ch.id)?.watch_count || 0,
    })) || [];

    res.json({ channels: withCount });
  } catch (err) {
    logger.error('Trending channels error', err);
    res.status(500).json({ error: 'Failed to fetch trending channels' });
  }
});

// ─── List Favorites (auth required) ───────────────────────────────────────────
router.get('/me/favorites', async (req, res) => {
  if (!req.user) return res.json({ channels: [] });

  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('added_at, channels(id, name, logo_url, category, is_hd, is_live, stream_url)')
      .eq('user_id', req.user.id)
      .order('added_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const channels = data?.map(f => ({ ...f.channels, added_at: f.added_at })) || [];
    res.json({ channels });
  } catch (err) {
    logger.error('List favorites error', err);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// ─── Get Single Channel ────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    let query = supabase
      .from('channels')
      .select('*, playlists(name, type)')
      .eq('id', req.params.id);

    if (req.user) {
      query = query.or(`user_id.is.null,user_id.eq.${req.user.id}`);
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query.single();
    if (error || !data) return res.status(404).json({ error: 'Channel not found' });
    res.json({ channel: data });
  } catch (err) {
    logger.error('Get channel error', err);
    res.status(500).json({ error: 'Failed to fetch channel' });
  }
});

// ─── Update Channel (auth required) ───────────────────────────────────────────
router.put('/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Login required' });

  const allowed = ['name', 'logo_url', 'category', 'country', 'language', 'is_hd', 'is_working'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );

  try {
    const { data, error } = await supabase
      .from('channels')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Channel not found' });
    res.json({ channel: data });
  } catch (err) {
    logger.error('Update channel error', err);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// ─── Delete Channel (auth required) ───────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Login required' });

  try {
    const { error } = await supabase
      .from('channels')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Channel deleted' });
  } catch (err) {
    logger.error('Delete channel error', err);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// ─── Toggle Favorite (auth required) ──────────────────────────────────────────
router.post('/:id/favorite', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Login required to save favorites' });

  const channelId = req.params.id;
  const userId = req.user.id;

  try {
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('channel_id', channelId)
      .single();

    if (existing) {
      await supabase.from('favorites').delete().eq('id', existing.id);
      return res.json({ favorited: false });
    }

    await supabase.from('favorites').insert({ user_id: userId, channel_id: channelId });
    res.json({ favorited: true });
  } catch (err) {
    logger.error('Toggle favorite error', err);
    res.status(500).json({ error: 'Failed to update favorite' });
  }
});

// ─── Record Watch ──────────────────────────────────────────────────────────────
router.post('/:id/watch', async (req, res) => {
  const { duration_secs = 0, device_type } = req.body;

  try {
    const { data: channel } = await supabase
      .from('channels')
      .select('name, logo_url, stream_url')
      .eq('id', req.params.id)
      .single();

    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    // Only record history for authenticated users
    if (req.user) {
      await supabase.from('watch_history').insert({
        user_id: req.user.id,
        channel_id: req.params.id,
        channel_name: channel.name,
        channel_logo: channel.logo_url,
        stream_url: channel.stream_url,
        duration_secs,
        device_type: device_type || 'mobile',
      });

      await supabase.from('analytics_events').insert({
        user_id: req.user.id,
        event_type: 'stream_start',
        channel_id: req.params.id,
        device_type: device_type || 'mobile',
      });
    }

    res.json({ recorded: true });
  } catch (err) {
    logger.error('Record watch error', err);
    res.status(500).json({ error: 'Failed to record watch' });
  }
});

export default router;
