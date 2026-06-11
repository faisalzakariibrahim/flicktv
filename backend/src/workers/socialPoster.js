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

/**
 * Post a highlight clip to YouTube as a Short
 * YouTube Shorts are vertical/max 60s videos — perfect for goal highlights
 */
export async function postToYouTube(highlight) {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;
  
  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_REFRESH_TOKEN) {
    console.warn('⚠️ YouTube credentials not configured, skipping');
    return { success: false, error: 'YouTube not configured' };
  }

  if (!highlight.clip_url || !existsSync(highlight.clip_url)) {
    return { success: false, error: 'Clip file not found' };
  }

  try {
    // Get OAuth2 access token
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

    // Get clip file stats
    const statSync = await import('fs').then(m => m.statSync);
    const fileStat = statSync(highlight.clip_url);
    
    // Upload video via resumable upload
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

    // Initiate resumable upload
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
    const fileStream = createReadStream(highlight.clip_url);
    const chunks = [];
    for await (const chunk of fileStream) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

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
    const videoUrl = `https://youtube.com/watch?v=${videoId}`;
    const shortUrl = `https://youtube.com/shorts/${videoId}`;

    console.log(`✅ YouTube uploaded: ${shortUrl}`);

    // Update highlight record
    await supabase.from('highlights').update({
      youtube_url: shortUrl,
      youtube_id: videoId,
      status: highlight.tiktok_url ? 'posted_both' : 'posted_youtube',
    }).eq('id', highlight.id);

    return { success: true, videoId, url: shortUrl };

  } catch (err) {
    console.error('❌ YouTube upload failed:', err.message);
    await supabase.from('highlights').update({
      status: 'failed',
    }).eq('id', highlight.id);
    return { success: false, error: err.message };
  }
}

// ─── TikTok API ─────────────────────────────────────────────────────────────

/**
 * Post a highlight clip to TikTok
 * Uses the TikTok for Developers Video API
 * Note: Requires TikTok developer account + app approval
 * 
 * For a simpler approach, we can use browser automation to post manually,
 * or use services like Bland.ai for automated posting.
 */
export async function postToTikTok(highlight) {
  const { TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET } = process.env;

  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    console.warn('⚠️ TikTok credentials not configured, skipping');
    return { success: false, error: 'TikTok not configured' };
  }

  if (!highlight.clip_url || !existsSync(highlight.clip_url)) {
    return { success: false, error: 'Clip file not found' };
  }

  try {
    // Step 1: Get access token
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'video.publish',
      }),
      signal: AbortSignal.timeout(15000),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token || tokenData.data?.access_token;
    if (!accessToken) throw new Error(`TikTok auth failed: ${JSON.stringify(tokenData)}`);

    // Step 2: Publish video
    const publishUrl = 'https://open.tiktokapis.com/v2/video/publish/';
    const videoMetadata = {
      text: [
        `⚽ WORLD CUP 2026 HIGHLIGHT 🔥`,
        highlight.title,
        highlight.description,
        '',
        '#WorldCup2026 #FIFAWorldCup #Football #FlickTV #Goals #Soccer',
      ].join('\n').slice(0, 2200), // TikTok caption limit
    };

    const formData = new FormData();
    formData.append('video', new Blob([await import('fs').then(m => m.promises).then(p => p.readFile(highlight.clip_url))]), 'video/mp4');
    formData.append('text', videoMetadata.text);

    const publishRes = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
      signal: AbortSignal.timeout(120000),
    });

    const publishResult = await publishRes.json();
    
    if (!publishRes.ok || publishResult.error_code) {
      throw new Error(`TikTok publish failed: ${JSON.stringify(publishResult)}`);
    }

    const tiktokId = publishResult.data?.publish_id;
    const tiktokUrl = `https://tiktok.com/@flicktv/video/${tiktokId}`;

    console.log(`✅ TikTok posted: ${tiktokUrl}`);

    // Update highlight record
    await supabase.from('highlights').update({
      tiktok_url: tiktokUrl,
      tiktok_id: tiktokId,
      status: highlight.youtube_url ? 'posted_both' : 'posted_tiktok',
    }).eq('id', highlight.id);

    return { success: true, tiktokId, url: tiktokUrl };

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
