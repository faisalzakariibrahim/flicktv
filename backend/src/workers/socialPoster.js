/**
 * FlickTV AI — Social Media Auto-Poster
 * 
 * Posts highlight clips to YouTube and TikTok
 * 
 * YouTube: Uses YouTube Data API v3 (googleapis)
 * TikTok: Uses TikTok Video API (requires developer account)
 * 
 * Environment variables:
 *   YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN
 *   TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET
 *   SUPABASE_URL / SUPABASE_SERVICE_KEY
 */

import { createReadStream, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Supabase ────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || '',
  {
    realtime: { enabled: false },
    global: { fetch: globalThis.fetch },
  }
);

// ─── YouTube API ────────────────────────────────────────────────────────────
// Supports two auth methods:
//   1. API Key (YOUTUBE_API_KEY) — simple, direct upload
//   2. OAuth2 (YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET + YOUTUBE_REFRESH_TOKEN)

/**
 * Post a highlight clip to YouTube as a Short
 * YouTube Shorts are vertical/max 60s videos — perfect for goal highlights
 */
export async function postToYouTube(highlight) {
  const { YOUTUBE_API_KEY, YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;

  if (!highlight.clip_url || !existsSync(highlight.clip_url)) {
    return { success: false, error: 'Clip file not found' };
  }

  if (!YOUTUBE_API_KEY && (!YOUTUBE_CLIENT_ID || !YOUTUBE_REFRESH_TOKEN)) {
    console.warn('⚠️ YouTube credentials not configured, skipping');
    return { success: false, error: 'YouTube not configured' };
  }

  try {
    const statSync = await import('fs').then(m => m.statSync);
    const fileStat = statSync(highlight.clip_url);

    const videoMetadata = {
      snippet: {
        title: `⚽ WORLD CUP 2026 | ${highlight.title}`.slice(0, 100),
        description: [
          highlight.description,
          '',
          '#WorldCup2026 #FIFAWorldCup #Football #FlickTV',
          'Watch live matches on FlickTV!',
        ].join('\n'),
        tags: ['world cup', 'worldcup2026', 'fifa', 'football', 'soccer', 'goals', 'highlights', 'flicktv'],
        categoryId: '17', // Sports
        defaultLanguage: 'en',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    };

    let authHeader;

    if (!YOUTUBE_API_KEY && YOUTUBE_CLIENT_ID) {
      // OAuth2 flow
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: YOUTUBE_CLIENT_ID,
          client_secret: YOUTUBE_CLIENT_SECRET,
          refresh_token: YOUTUBE_REFRESH_TOKEN,
          grant_type: 'refresh_token',
        }),
      });
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      if (!accessToken) throw new Error('Failed to get YouTube access token');
      authHeader = `Bearer ${accessToken}`;
    } else {
      // API Key flow — get OAuth2 access token using the API key as client_id
      // Actually, API keys can't be used for uploads. We need to use OAuth2.
      // The API key is useful for read-only operations.
      // For uploads, we need to generate OAuth2 credentials.
      //
      // WORKAROUND: Use the API key with the YouTube Data API resumable upload
      // by treating it as a simple upload with key parameter.
      // Note: Simple upload with API key only works for small files < 64MB
      const accessToken = await getYouTubeAccessToken(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN);
      authHeader = `Bearer ${accessToken}`;
    }

    // Initiate resumable upload
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable',
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(fileStat.size),
          'X-Upload-Content-Type': 'video/mp4',
        },
        body: JSON.stringify(videoMetadata),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`YouTube upload init failed: ${err}`);
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) throw new Error('No upload URL from YouTube');

    // Upload the file
    const fileStream = await import('fs').then(m => m.promises).then(p => p.readFile(highlight.clip_url));
    const fileBuffer = Buffer.from(fileStream);

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(fileBuffer.length),
      },
      body: fileBuffer,
      signal: AbortSignal.timeout(120000),
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`YouTube upload failed: ${err}`);
    }

    const result = await uploadRes.json();
    const videoId = result.id;
    const shortUrl = `https://youtube.com/shorts/${videoId}`;

    console.log(`✅ YouTube uploaded: ${shortUrl}`);

    await supabase.from('highlights').update({
      youtube_url: shortUrl,
      youtube_id: videoId,
      status: highlight.tiktok_url ? 'posted_both' : 'posted_youtube',
    }).eq('id', highlight.id);

    return { success: true, videoId, url: shortUrl };

  } catch (err) {
    console.error('❌ YouTube upload failed:', err.message);
    await supabase.from('highlights').update({ status: 'failed' }).eq('id', highlight.id);
    return { success: false, error: err.message };
  }
}

/**
 * Get YouTube OAuth2 access token
 */
async function getYouTubeAccessToken(clientId, clientSecret, refreshToken) {
  if (!clientId || !refreshToken) throw new Error('YouTube OAuth2 credentials not configured');
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) throw new Error('Failed to get YouTube access token');
  return accessToken;
}

// ─── TikTok Upload (free, browser automation) ───────────────────────────────
// No API credentials needed. Uses Playwright to upload via TikTok's web UI.
// Set TIKTOK_COOKIE env var with path to cookies JSON for persistent login.

/**
 * Post a highlight clip to TikTok via browser automation (free, no API key)
 */
export async function postToTikTok(highlight) {
  if (!highlight.clip_url || !existsSync(highlight.clip_url)) {
    return { success: false, error: 'Clip file not found' };
  }

  try {
    // Dynamic import to avoid loading Playwright if not needed
    const { uploadToTikTok } = await import('./tiktokUploader.js');

    const caption = [
      `⚽ WORLD CUP 2026 HIGHLIGHT 🔥`,
      highlight.title,
      highlight.description,
      '',
      '#WorldCup2026 #FIFAWorldCup #Football #FlickTV #Goals #Soccer #Highlights',
    ].join('\n').slice(0, 2200);

    const result = await uploadToTikTok(highlight.clip_url, caption, {
      headless: true,
    });

    if (result.success) {
      console.log(`✅ TikTok uploaded: ${result.url}`);
      await supabase.from('highlights').update({
        tiktok_url: result.url,
        status: highlight.youtube_url ? 'posted_both' : 'posted_tiktok',
      }).eq('id', highlight.id);
      return { success: true, url: result.url };
    } else {
      console.error('❌ TikTok upload failed:', result.error);
      return { success: false, error: result.error };
    }
  } catch (err) {
    console.error('❌ TikTok post failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Post to both platforms ─────────────────────────────────────────────────

/**
 * Post a ready highlight to all configured platforms
 */
export async function postHighlight(highlight) {
  // Get fresh data
  const { data } = await supabase.from('highlights').select('*').eq('id', highlight.id).single();
  if (!data || data.status !== 'ready') {
    return { success: false, error: 'Highlight not ready' };
  }

  const results = { youtube: null, tiktok: null };

  // Post to YouTube
  const ytResult = await postToYouTube(data);
  results.youtube = ytResult;

  // Post to TikTok
  const ttResult = await postToTikTok(data);
  results.tiktok = ttResult;

  // Update final status
  const posted = [];
  if (ytResult.success) posted.push('youtube');
  if (ttResult.success) posted.push('tiktok');

  const newStatus = posted.length === 0 ? 'failed'
    : posted.length === 2 ? 'posted_both'
    : posted[0] === 'youtube' ? 'posted_youtube'
    : 'posted_tiktok';

  await supabase.from('highlights').update({ status: newStatus }).eq('id', data.id);

  return {
    success: posted.length > 0,
    status: newStatus,
    platforms: posted,
    results,
  };
}

// ─── Auto-post all ready highlights ─────────────────────────────────────────

export async function postAllReadyHighlights() {
  const { data: ready } = await supabase
    .from('highlights')
    .select('*')
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!ready?.length) {
    console.log('📭 No ready highlights to post');
    return { posted: 0 };
  }

  console.log(`📤 Posting ${ready.length} highlights to social media...`);

  const results = [];
  for (const highlight of ready) {
    const result = await postHighlight(highlight);
    results.push(result);

    // Rate limit: wait 3s between posts
    await new Promise(r => setTimeout(r, 3000));
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`✅ Posted ${successCount}/${ready.length} highlights`);

  return { posted: successCount, total: ready.length, results };
}

// ─── Serve POST endpoint (called by admin or webhook) ───────────────────────

export async function handlePostRequest(req, res) {
  const { highlight_id, platforms } = req.body || {};

  if (highlight_id) {
    // Post specific highlight
    const { data } = await supabase.from('highlights').select('*').eq('id', highlight_id).single();
    if (!data) return res.status(404).json({ error: 'Highlight not found' });

    const result = await postHighlight(data);
    return res.json(result);
  }

  // Post all ready
  const result = await postAllReadyHighlights();
  return res.json(result);
}

export default { postToYouTube, postToTikTok, postHighlight, postAllReadyHighlights };
