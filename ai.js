/**
 * FlickTV AI — AI Routes
 * Flick AI assistant powered by Claude
 */

import { Router } from 'express';
import { anthropic, supabase } from './server.js';

const router = Router();

// ─── Flick AI Chat ────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const { message, sessionId, context } = req.body;
  const userId = req.user.id;

  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    // Load or create AI session
    let session = null;
    if (sessionId) {
      const { data } = await supabase
        .from('ai_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();
      session = data;
    }

    const messages = session?.messages || [];

    // Build context-aware system prompt
    const systemPrompt = buildSystemPrompt(context);

    // Add user message to history
    messages.push({ role: 'user', content: message });

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.slice(-20), // keep last 20 turns
    });

    const assistantMessage = response.content[0].text;
    messages.push({ role: 'assistant', content: assistantMessage });

    // Parse intent from the response
    const intent = detectIntent(message);

    // Execute intent-based actions
    let actionResult = null;
    if (intent.type === 'search_channels') {
      actionResult = await searchChannelsForUser(intent.query, userId);
    } else if (intent.type === 'play_channel') {
      actionResult = await findChannel(intent.query, userId);
    } else if (intent.type === 'recommendations') {
      actionResult = await getAIRecommendations(userId);
    }

    // Save/update session
    let newSessionId = sessionId;
    if (!sessionId) {
      const { data } = await supabase.from('ai_sessions').insert({
        user_id: userId,
        messages,
        intent: intent.type,
      }).select().single();
      newSessionId = data?.id;
    } else {
      await supabase
        .from('ai_sessions')
        .update({ messages, intent: intent.type, updated_at: new Date() })
        .eq('id', sessionId);
    }

    res.json({
      sessionId: newSessionId,
      message: assistantMessage,
      intent,
      actionResult,
    });

  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: 'Flick AI is temporarily unavailable' });
  }
});

// ─── AI Recommendations ───────────────────────────────────────────────────────
router.get('/recommendations', async (req, res) => {
  const userId = req.user.id;

  try {
    // Get user's watch history
    const { data: history } = await supabase
      .from('watch_history')
      .select('channel_name, channel_id')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false })
      .limit(50);

    // Get all user's channels
    const { data: allChannels } = await supabase
      .from('channels')
      .select('id, name, category, group_title, country')
      .eq('user_id', userId)
      .limit(200);

    if (!allChannels || allChannels.length === 0) {
      return res.json({ recommendations: [], reason: 'No channels found' });
    }

    // Build prompt for Claude
    const historyText = history?.length
      ? `User recently watched: ${history.slice(0, 10).map(h => h.channel_name).join(', ')}`
      : 'User is new with no watch history';

    const channelList = allChannels.slice(0, 100)
      .map(c => `${c.id}|${c.name}|${c.category}|${c.country || 'unknown'}`)
      .join('\n');

    const prompt = `You are a TV recommendation engine for FlickTV AI.

${historyText}

Available channels (format: id|name|category|country):
${channelList}

Based on the watch history, recommend the TOP 10 most relevant channels.
Respond ONLY with valid JSON array, no preamble:
[{"channel_id": "uuid", "score": 0.95, "reason": "short explanation"}]`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    let recommendations = [];
    try {
      const text = response.content[0].text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);
      recommendations = parsed.slice(0, 10);
    } catch {
      recommendations = [];
    }

    // Store recommendations
    if (recommendations.length > 0) {
      await supabase.from('recommendations').delete().eq('user_id', userId);
      await supabase.from('recommendations').insert(
        recommendations.map(r => ({
          user_id: userId,
          channel_id: r.channel_id,
          score: r.score,
          reason: r.reason,
          algorithm: 'claude',
        }))
      );
    }

    res.json({ recommendations, generated_at: new Date() });

  } catch (err) {
    console.error('AI recommendations error:', err);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// ─── Stream Repair ────────────────────────────────────────────────────────────
router.post('/repair-stream', async (req, res) => {
  const { channelId, error } = req.body;
  const userId = req.user.id;

  try {
    // Get channel info
    const { data: channel } = await supabase
      .from('channels')
      .select('*, playlists(name, url, type)')
      .eq('id', channelId)
      .single();

    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const prompt = `You are a stream troubleshooter for FlickTV AI.

Channel: ${channel.name}
Stream URL: ${channel.stream_url}
Error: ${error || 'Stream not loading'}
Playlist type: ${channel.playlists?.type}

Provide a brief diagnosis and suggest 2-3 actionable fixes.
Respond as JSON: {"diagnosis": "...", "fixes": ["fix1", "fix2"], "likely_cause": "..."}`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    let result = { diagnosis: 'Stream unavailable', fixes: ['Check your internet connection', 'Try refreshing the stream', 'The channel may be temporarily offline'] };
    try {
      const text = response.content[0].text.replace(/```json|```/g, '').trim();
      result = JSON.parse(text);
    } catch {}

    // Mark channel as potentially broken
    await supabase.from('channels').update({ is_working: false, last_checked: new Date() }).eq('id', channelId);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Stream repair unavailable' });
  }
});

// ─── Voice Search ─────────────────────────────────────────────────────────────
router.post('/voice-search', async (req, res) => {
  const { transcript } = req.body;
  const userId = req.user.id;

  if (!transcript) return res.status(400).json({ error: 'Transcript required' });

  try {
    const prompt = `Extract a channel search query from this voice command: "${transcript}"
    
Respond as JSON only: {"query": "...", "intent": "play|search|recommend|info", "filters": {"category": null, "country": null, "language": null}}`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    let parsed = { query: transcript, intent: 'search', filters: {} };
    try {
      const text = response.content[0].text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(text);
    } catch {}

    // Execute search
    const { data: channels } = await supabase
      .from('channels')
      .select('id, name, logo_url, category, stream_url, is_hd')
      .eq('user_id', userId)
      .ilike('name', `%${parsed.query}%`)
      .limit(10);

    res.json({ ...parsed, results: channels || [] });
  } catch (err) {
    res.status(500).json({ error: 'Voice search failed' });
  }
});

// ─── Natural Language Search ─────────────────────────────────────────────────
router.post('/search', async (req, res) => {
  const { query } = req.body;
  const userId = req.user.id;

  if (!query) return res.status(400).json({ error: 'Search query required' });

  try {
    // Use Claude to parse natural language into structured filters
    const parsePrompt = `You are a channel search query parser for FlickTV AI.

User query: "${query}"

Extract structured filters from this natural language query.
Respond ONLY with valid JSON, no preamble:
{
  "search_terms": "keywords to match against channel names (comma-separated)",
  "category": "sports|news|movies|entertainment|kids|music|religious|documentary|null",
  "country": "full country name or null",
  "language": "language name or null",
  "is_hd": true|false|null,
  "is_live": true|false|null
}

Examples:
- "Show me soccer channels in Spanish" -> {"search_terms": "soccer,football", "category": "sports", "country": null, "language": "spanish", "is_hd": null, "is_live": true}
- "Find news from Africa" -> {"search_terms": "news,africa", "category": "news", "country": "africa", "language": null, "is_hd": null, "is_live": null}
- "Movie channels that are HD" -> {"search_terms": "movie", "category": "movies", "country": null, "language": null, "is_hd": true, "is_live": null}
- "BBC" -> {"search_terms": "bbc", "category": null, "country": null, "language": null, "is_hd": null, "is_live": null}
- "Kids cartoons" -> {"search_terms": "kids,cartoon,animation", "category": "kids", "country": null, "language": null, "is_hd": null, "is_live": null}`;

    const parseResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{ role: 'user', content: parsePrompt }],
    });

    let filters = { search_terms: query, category: null, country: null, language: null, is_hd: null, is_live: null };
    try {
      const text = parseResponse.content[0].text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);
      filters = { ...filters, ...parsed };
    } catch {
      // Fall back to raw query as search terms
    }

    // Build database query
    let dbQuery = supabase
      .from('channels')
      .select('id, name, logo_url, category, group_title, country, language, stream_url, is_hd, is_live, is_4k')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .limit(50);

    // Apply structured filters
    if (filters.category) {
      dbQuery = dbQuery.eq('category', filters.category);
    }
    if (filters.country) {
      dbQuery = dbQuery.or(`country.ilike.%${filters.country}%,group_title.ilike.%${filters.country}%`);
    }
    if (filters.language) {
      dbQuery = dbQuery.or(`language.ilike.%${filters.language}%,country.ilike.%${filters.language}%`);
    }
    if (filters.is_hd === true) {
      dbQuery = dbQuery.eq('is_hd', true);
    }
    if (filters.is_live === true) {
      dbQuery = dbQuery.eq('is_live', true);
    }

    // Search terms: try name and group matching
    if (filters.search_terms) {
      const terms = filters.search_terms.split(',').map(t => t.trim()).filter(Boolean);
      if (terms.length > 0) {
        const nameConditions = terms.map(t => `name.ilike.%${t}%`).join(',');
        const groupConditions = terms.map(t => `group_title.ilike.%${t}%`).join(',');
        dbQuery = dbQuery.or(`${nameConditions},${groupConditions}`);
      }
    }

    dbQuery = dbQuery.order('is_hd', { ascending: false }).order('name');

    const { data: channels, error } = await dbQuery;
    if (error) return res.status(500).json({ error: error.message });

    // If few results, ask Claude to rank/rerank for relevance
    let ranked = channels || [];
    if (ranked.length > 0 && ranked.length <= 50) {
      try {
        const channelList = ranked.slice(0, 30)
          .map(c => `${c.id}|${c.name}|${c.category || ''}|${c.group_title || ''}|${c.country || ''}`)
          .join('\n');

        const rankPrompt = `User searched: "${query}"
Filters detected: ${JSON.stringify(filters)}

Channels found:
${channelList}

Rank these channels by relevance to the user's query. Return ALL channel IDs sorted most-relevant first.
Respond ONLY with JSON array: ["uuid1", "uuid2", ...]`;

        const rankResponse = await anthropic.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 1024,
          messages: [{ role: 'user', content: rankPrompt }],
        });

        const rankText = rankResponse.content[0].text.replace(/```json|```/g, '').trim();
        const rankedIds = JSON.parse(rankText);
        if (Array.isArray(rankedIds) && rankedIds.length > 0) {
          const idOrder = new Map(rankedIds.map((id, i) => [id, i]));
          ranked = ranked.sort((a, b) => {
            const aIdx = idOrder.get(a.id) ?? 999;
            const bIdx = idOrder.get(b.id) ?? 999;
            return aIdx - bIdx;
          });
        }
      } catch {
        // Ranking failed, keep DB order
      }
    }

    // Log to analytics
    supabase.from('analytics_events').insert({
      user_id: userId,
      event_type: 'ai_search',
      payload: { query, filters, results_count: ranked.length },
    }).catch(() => {});

    res.json({
      query,
      filters,
      results: ranked,
      total: ranked.length,
    });

  } catch (err) {
    console.error('AI search error:', err);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildSystemPrompt(context) {
  return `You are Flick AI, the intelligent assistant for FlickTV AI — a premium IPTV streaming platform.

You help users:
- Find and play channels ("Play BBC News", "Find sports channels", "Show me kids channels")
- Get recommendations based on their viewing history
- Fix broken streams or playback issues
- Navigate the app and manage playlists
- Translate subtitles or explain content

Personality: Friendly, concise, helpful. You're like a knowledgeable streaming guide.

Current user context: ${JSON.stringify(context || {})}

Always be helpful and specific. If you can find a channel or solve a problem, do it.
Keep responses under 150 words unless explaining something complex.`;
}

function detectIntent(message) {
  const lower = message.toLowerCase();

  if (/play|watch|stream|open/i.test(lower)) {
    return { type: 'play_channel', query: extractQuery(lower, /(?:play|watch|stream|open)\s+(.+)/i) };
  }
  if (/find|search|show|look for/i.test(lower)) {
    return { type: 'search_channels', query: extractQuery(lower, /(?:find|search|show|look for)\s+(.+)/i) };
  }
  if (/recommend|suggest|what should/i.test(lower)) {
    return { type: 'recommendations', query: null };
  }
  if (/fix|broken|not working|error/i.test(lower)) {
    return { type: 'fix_stream', query: null };
  }
  if (/translate|subtitle/i.test(lower)) {
    return { type: 'translate', query: null };
  }

  return { type: 'general', query: message };
}

function extractQuery(text, regex) {
  const match = text.match(regex);
  return match ? match[1].trim() : text;
}

async function searchChannelsForUser(query, userId) {
  const { data } = await supabase
    .from('channels')
    .select('id, name, logo_url, category, stream_url, is_hd, is_live')
    .eq('user_id', userId)
    .ilike('name', `%${query}%`)
    .limit(5);
  return data;
}

async function findChannel(query, userId) {
  const { data } = await supabase
    .from('channels')
    .select('id, name, logo_url, stream_url, is_hd, is_live')
    .eq('user_id', userId)
    .ilike('name', `%${query}%`)
    .limit(1)
    .single();
  return data;
}

async function getAIRecommendations(userId) {
  const { data } = await supabase
    .from('recommendations')
    .select('*, channels(id, name, logo_url, category)')
    .eq('user_id', userId)
    .order('score', { ascending: false })
    .limit(5);
  return data;
}

export default router;
