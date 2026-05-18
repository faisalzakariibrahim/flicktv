/**
 * FlickTV AI — Playlists Routes
 */
import { Router } from 'express';
import { supabase } from '../server.js';
import { parseM3U } from '../parsers/m3uParser.js';
import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/playlists — list user's playlists
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('playlists')
    .select('*, channels(count)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/playlists — add new playlist
router.post('/', async (req, res) => {
  const { name, type, url, xtream_user, xtream_pass } = req.body;

  if (!name || !type) return res.status(400).json({ error: 'name and type required' });

  const { data, error } = await supabase.from('playlists').insert({
    user_id: req.user.id,
    name, type, url, xtream_user, xtream_pass,
    sync_status: 'pending',
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });

  // Trigger async sync
  syncPlaylist(data.id, req.user.id).catch(err =>
    logger.error('Playlist sync failed', { id: data.id, err: err.message })
  );

  res.status(201).json(data);
});

// POST /api/playlists/:id/sync — force re-sync
router.post('/:id/sync', async (req, res) => {
  const { id } = req.params;
  const { data: playlist } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  await supabase.from('playlists').update({ sync_status: 'syncing' }).eq('id', id);

  syncPlaylist(id, req.user.id)
    .then(() => logger.info(`Playlist ${id} synced`))
    .catch(err => logger.error('Sync error', err));

  res.json({ message: 'Sync started' });
});

// DELETE /api/playlists/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Sync Helper ─────────────────────────────────────────────────────────────
async function syncPlaylist(playlistId, userId) {
  const { data: playlist } = await supabase
    .from('playlists').select('*').eq('id', playlistId).single();

  if (!playlist) throw new Error('Playlist not found');

  let channels = [];

  if (playlist.type === 'm3u_url' && playlist.url) {
    const res = await fetch(playlist.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)' },
      timeout: 60000,
    });
    const content = await res.text();
    channels = parseM3U(content);
  }

  // Delete old channels for this playlist
  await supabase.from('channels').delete().eq('playlist_id', playlistId);

  // Batch insert new channels (500 at a time)
  const batchSize = 500;
  for (let i = 0; i < channels.length; i += batchSize) {
    const batch = channels.slice(i, i + batchSize).map(ch => ({
      ...ch,
      playlist_id: playlistId,
      user_id: userId,
    }));
    await supabase.from('channels').insert(batch);
  }

  await supabase.from('playlists').update({
    sync_status: 'ok',
    last_synced: new Date(),
    channel_count: channels.length,
  }).eq('id', playlistId);
}

export default router;
