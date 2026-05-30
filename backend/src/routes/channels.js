/**
 * FlickTV AI — Channels Routes
 */
import { Router } from 'express';
import { supabase } from '../server.js';

const router = Router();

// GET /api/channels — paginated channel list
router.get('/', async (req, res) => {
  const { category, country, hd, search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  // Build query: return user's channels + system channels (user_id IS NULL)
  let baseQuery = supabase
    .from('channels')
    .select('*', { count: 'exact' })
    .or(`user_id.eq.${req.user.id},user_id.is.null`)
    .order('name')
    .range(offset, offset + limit - 1);

  if (category)  baseQuery = baseQuery.eq('category', category);
  if (country)   baseQuery = baseQuery.eq('country', country);
  if (hd === 'true') baseQuery = baseQuery.eq('is_hd', true);
  if (search)    baseQuery = baseQuery.ilike('name', `%${search}%`);

  const { data, error, count } = await baseQuery;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ channels: data, total: count, page: +page, limit: +limit });
});

// GET /api/channels/trending
router.get('/trending', async (req, res) => {
  const { data } = await supabase.rpc('get_trending_channels', { p_limit: 20 });
  const channelIds = data?.map(r => r.channel_id) || [];

  if (!channelIds.length) return res.json([]);

  const { data: channels } = await supabase
    .from('channels')
    .select('*')
    .in('id', channelIds)
    .or(`user_id.eq.${req.user.id},user_id.is.null`);

  res.json(channels || []);
});

// GET /api/channels/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Channel not found' });
  res.json(data);
});

// POST /api/channels/:id/report — report broken stream
router.post('/:id/report', async (req, res) => {
  await supabase
    .from('channels')
    .update({ is_working: false, last_checked: new Date() })
    .eq('id', req.params.id);
  res.json({ success: true });
});

export default router;
