/**
 * FlickTV AI — Playlist Routes
 * Handles M3U URL, M3U file upload, and Xtream Codes playlist management.
 */

import { Router } from 'express';
import fetch from 'node-fetch';
import { supabase } from '../server.js';
import { logger } from '../utils/logger.js';
import { parseM3U } from '../parsers/m3uParser.js';

const router = Router();

// ─── List Playlists ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('playlists')
      .select('id, name, type, url, channel_count, is_active, last_synced, sync_status, sync_error, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ playlists: data });
  } catch (err) {
    logger.error('List playlists error', err);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

// ─── Get Single Playlist ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ playlist: data });
  } catch (err) {
    logger.error('Get playlist error', err);
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

// ─── Create Playlist ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, type, url, xtream_user, xtream_pass, raw_content } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required' });
  }

  const validTypes = ['m3u_url', 'm3u_file', 'xtream', 'local'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
  }

  if (type === 'm3u_url' && !url) {
    return res.status(400).json({ error: 'url is required for m3u_url type' });
  }
  if (type === 'xtream' && (!url || !xtream_user || !xtream_pass)) {
    return res.status(400).json({ error: 'url, xtream_user, and xtream_pass are required for Xtream' });
  }

  try {
    const { data: playlist, error } = await supabase
      .from('playlists')
      .insert({
        user_id: req.user.id,
        name,
        type,
        url: url || null,
        xtream_user: xtream_user || null,
        xtream_pass: xtream_pass || null,
        raw_content: raw_content || null,
        sync_status: 'pending',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Kick off sync in background (non-blocking)
    syncPlaylist(playlist, req.user.id).catch(err =>
      logger.error('Background sync error', { playlistId: playlist.id, err })
    );

    res.status(201).json({ playlist, message: 'Playlist created. Syncing channels...' });
  } catch (err) {
    logger.error('Create playlist error', err);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// ─── Update Playlist ──────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { name, url, xtream_user, xtream_pass, is_active } = req.body;

  try {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (url !== undefined) updates.url = url;
    if (xtream_user !== undefined) updates.xtream_user = xtream_user;
    if (xtream_pass !== undefined) updates.xtream_pass = xtream_pass;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('playlists')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ playlist: data });
  } catch (err) {
    logger.error('Update playlist error', err);
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

// ─── Delete Playlist ──────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('playlists')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Playlist deleted' });
  } catch (err) {
    logger.error('Delete playlist error', err);
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

// ─── Sync Playlist ────────────────────────────────────────────────────────────
router.post('/:id/sync', async (req, res) => {
  try {
    const { data: playlist, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !playlist) return res.status(404).json({ error: 'Playlist not found' });

    // Mark as syncing
    await supabase
      .from('playlists')
      .update({ sync_status: 'syncing' })
      .eq('id', playlist.id);

    // Run sync async
    syncPlaylist(playlist, req.user.id).catch(err =>
      logger.error('Sync error', { playlistId: playlist.id, err })
    );

    res.json({ message: 'Sync started' });
  } catch (err) {
    logger.error('Sync trigger error', err);
    res.status(500).json({ error: 'Failed to start sync' });
  }
});

// ─── Sync Logic ───────────────────────────────────────────────────────────────
async function syncPlaylist(playlist, userId) {
  try {
    let channels = [];

    if (playlist.type === 'm3u_url') {
      channels = await fetchAndParseM3U(playlist.url);
    } else if (playlist.type === 'm3u_file' || playlist.type === 'local') {
      channels = parseM3U(playlist.raw_content);
    } else if (playlist.type === 'xtream') {
      channels = await fetchXtreamChannels(playlist.url, playlist.xtream_user, playlist.xtream_pass);
    }

    if (channels.length === 0) {
      await supabase.from('playlists').update({
        sync_status: 'error',
        sync_error: 'No channels found in playlist',
      }).eq('id', playlist.id);
      return;
    }

    // Delete existing channels for this playlist, then insert fresh batch
    await supabase.from('channels').delete().eq('playlist_id', playlist.id);

    // Insert in batches of 500 to avoid request size limits
    const BATCH = 500;
    for (let i = 0; i < channels.length; i += BATCH) {
      const batch = channels.slice(i, i + BATCH).map(ch => ({
        ...ch,
        playlist_id: playlist.id,
        user_id: userId,
      }));
      await supabase.from('channels').insert(batch);
    }

    await supabase.from('playlists').update({
      channel_count: channels.length,
      last_synced: new Date(),
      sync_status: 'ok',
      sync_error: null,
    }).eq('id', playlist.id);

    logger.info(`Playlist synced`, { playlistId: playlist.id, channelCount: channels.length });
  } catch (err) {
    logger.error('Playlist sync failed', { playlistId: playlist.id, err });
    await supabase.from('playlists').update({
      sync_status: 'error',
      sync_error: err.message,
    }).eq('id', playlist.id);
  }
}

async function fetchAndParseM3U(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)' },
    timeout: 30000,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching M3U`);
  const content = await response.text();
  return parseM3U(content);
}

async function fetchXtreamChannels(server, username, password) {
  const url = `${server}/player_api.php?username=${username}&password=${password}&action=get_live_streams`;
  const response = await fetch(url, { timeout: 30000 });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching Xtream channels`);
  const raw = await response.json();

  return raw.map(ch => ({
    name: ch.name,
    stream_url: `${server}/live/${username}/${password}/${ch.stream_id}.m3u8`,
    logo_url: ch.stream_icon || null,
    group_title: ch.category_name || null,
    tvg_id: ch.epg_channel_id || null,
    tvg_name: ch.name,
    is_live: true,
    is_hd: /\bHD\b/i.test(ch.name),
    is_4k: /\b4K|UHD\b/i.test(ch.name),
    category: inferCategoryFromGroup(ch.category_name, ch.name),
  }));
}

function inferCategoryFromGroup(group, name) {
  const text = ((group || '') + ' ' + (name || '')).toLowerCase();
  if (/news/.test(text)) return 'news';
  if (/sport|football|soccer/.test(text)) return 'sports';
  if (/movie|film/.test(text)) return 'movies';
  if (/kids|children|cartoon/.test(text)) return 'kids';
  if (/music/.test(text)) return 'music';
  if (/documentary/.test(text)) return 'documentary';
  if (/religious/.test(text)) return 'religious';
  return 'general';
}

export default router;
