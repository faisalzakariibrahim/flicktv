# FlickTV AI — Architecture Overview

## System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                 │
│  iOS App  │  Android App  │  Web App  │  Android TV  │ Smart TV  │
└─────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS / WSS
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE CDN + WAF                          │
└─────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NGINX REVERSE PROXY                          │
└────────────────┬────────────┴──────────────────────────────────┘
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
┌─────────────┐     ┌────────────────┐
│  API Server │     │  Stream Proxy  │
│  (Express)  │     │  (HLS relay)   │
└──────┬──────┘     └────────────────┘
       │
  ┌────┴─────┐
  │          │
  ▼          ▼
Redis    Supabase
Cache    (Postgres)
          │
          ├── users
          ├── playlists
          ├── channels (pgvector)
          ├── watch_history
          ├── favorites
          ├── recommendations
          ├── epg_programs
          └── analytics_events (partitioned)

External APIs:
  ├── Claude API (Anthropic) — Flick AI
  ├── OpenAI Whisper — Voice search
  └── IPTV sources (user-provided)
```

## Data Flow

### IPTV Import
1. User provides M3U URL / Xtream Codes
2. Backend fetches & parses M3U (up to 50k channels)
3. Channels saved to Supabase with metadata
4. pgvector embeddings generated for AI search

### Flick AI Chat
1. User sends message
2. Intent detection (play / search / recommend / fix)
3. Context-aware Claude API call
4. DB query for matching channels
5. Response + channel results returned

### Stream Health
1. Cron job every 30 min
2. HEAD request to each stream URL (8s timeout)
3. Results stored in stream_health_logs
4. Broken streams auto-flagged (is_working = false)

## Security

- JWT via Supabase Auth
- Row Level Security on all tables
- Rate limiting (200 req/15min global, 20 req/min for AI)
- Input validation + sanitization
- Stream proxy hides user IP from IPTV providers
- No content stored — purely a player
