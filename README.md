<p align="center">
  <img src="docs/banner.png" alt="FlickTV AI" width="600"/>
</p>

<h1 align="center">FlickTV AI</h1>

<p align="center">
  <strong>AI-Powered IPTV Streaming Platform</strong><br/>
  Cross-platform · Netflix-grade UI · Flick AI Assistant · M3U/Xtream/EPG
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-Expo-blue?logo=expo" />
  <img src="https://img.shields.io/badge/Backend-Node.js_Express-green?logo=node.js" />
  <img src="https://img.shields.io/badge/Database-Supabase-teal?logo=supabase" />
  <img src="https://img.shields.io/badge/AI-Claude_API-purple?logo=anthropic" />
  <img src="https://img.shields.io/badge/Deploy-Docker_+_Vercel-black?logo=docker" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" />
</p>

---

## What is FlickTV AI?

FlickTV AI is a production-ready, cross-platform IPTV player and aggregator. It does **not** host any content — it is purely a player that lets users connect their own legal IPTV subscriptions, M3U playlists, and Xtream Codes sources.

### Platforms
| Platform       | Status  |
|----------------|---------|
| iOS            | ✅ Phase 1 |
| Android        | ✅ Phase 1 |
| Android TV     | 🔜 Phase 3 |
| Web            | ✅ Phase 1 |
| Smart TV       | 🔜 Phase 3 |

---

## Features

### Core (Phase 1)
- 📺 HLS / M3U8 live stream playback
- 📋 M3U URL, M3U file, Xtream Codes, local file import
- 🔍 Full-text channel search with category filters
- ❤️ Favorites & watch history
- 🌐 Country, language, HD/4K filters
- 🔐 Auth: Email, Google, Apple, Guest mode

### AI (Phase 2)
- ✨ **Flick AI** — Claude-powered chat assistant
  - "Play Ghana News" → finds & plays instantly
  - "Find sports channels" → curated list
  - "Fix broken stream" → diagnoses & suggests fixes
  - "Recommend channels" → personalized by watch history
- 🎙️ Voice search via Whisper
- 🤖 AI stream auto-repair
- 🌍 AI subtitle translation

### Advanced (Phase 3+)
- 📅 EPG / TV Guide (XMLTV)
- 📱 Multi-device cloud sync
- 📼 Cloud DVR (Premium)
- 📺 Android TV + Smart TV interface
- 🏢 Enterprise: Hotels, Churches, IPTV Providers

---

## Tech Stack

```
apps/
├── mobile/          React Native (Expo) — iOS + Android + TV
└── web/             Next.js 14 — Web + Smart TV browser

backend/             Node.js + Express API
database/            Supabase (PostgreSQL + pgvector + RLS)
```

| Layer       | Technology |
|-------------|-----------|
| Mobile      | React Native, Expo, expo-router |
| Web         | Next.js 14, Tailwind CSS |
| Video       | react-native-video, HLS.js, ExoPlayer |
| Backend     | Node.js, Express, Redis |
| Database    | Supabase (PostgreSQL), pgvector |
| AI          | Claude API (Anthropic), OpenAI Whisper |
| Auth        | Supabase Auth (Google, Apple, Email) |
| Deploy      | Docker, Vercel, Cloudflare CDN |
| CI/CD       | GitHub Actions |

---

## Getting Started

### Prerequisites
- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- Docker (for backend)
- Supabase account
- Anthropic API key

### 1. Clone
```bash
git clone https://github.com/faisalzakariibrahim/Flicktv.git
cd Flicktv
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY
npm install
docker-compose up -d
```

### 3. Database
```bash
# In your Supabase dashboard → SQL Editor
# Run: database/migrations/001_initial_schema.sql
```

### 4. Mobile App
```bash
cd apps/mobile
cp .env.example .env
# Fill in EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_API_URL
npm install
npx expo start
```

### 5. Web App
```bash
cd apps/web
npm install
npm run dev
```

---

## Environment Variables

### Backend `.env`
```env
PORT=3001
NODE_ENV=development
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
ANTHROPIC_API_KEY=sk-ant-...
ALLOWED_ORIGINS=http://localhost:3000,https://flicktv.ai
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
```

### Mobile `.env`
```env
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_API_URL=http://localhost:3001
```

---

## Project Structure

```
Flicktv/
├── apps/
│   ├── mobile/                   # React Native (Expo)
│   │   └── src/
│   │       ├── screens/          # Home, Live, Search, Favorites, Profile, Player
│   │       ├── components/       # ChannelCard, StreamPlayer, FlickAIChat, EPGGuide
│   │       ├── stores/           # Zustand: auth, channels, player
│   │       ├── lib/              # Supabase client, API helpers
│   │       └── constants/        # Theme, colors, typography
│   └── web/                      # Next.js web app
│
├── backend/                      # Node.js + Express API
│   └── src/
│       ├── routes/               # auth, playlists, channels, ai, admin
│       ├── parsers/              # M3U parser, XMLTV/EPG parser
│       ├── middleware/           # JWT auth, rate limiting, logging
│       └── workers/              # Stream health checker (cron)
│
├── database/
│   ├── migrations/               # SQL schema files
│   └── seeds/                    # Sample data
│
├── docs/                         # Architecture, API docs, deployment guides
└── .github/workflows/            # CI/CD pipelines
```

---

## Roadmap

- [x] Phase 1 — MVP: Player, Import, Basic UI, Flick AI
- [ ] Phase 2 — AI Engine, EPG, Push Notifications
- [ ] Phase 3 — Smart TV, Cloud DVR, Premium Features
- [ ] Phase 4 — Enterprise, Analytics, White-label

---

## Legal & Compliance

FlickTV AI is an **IPTV aggregator and player only**.
- ❌ Does NOT host, store, or distribute any content
- ✅ Users import their own legally obtained IPTV subscriptions
- ✅ Compliant with Apple App Store and Google Play policies
- ✅ DMCA-safe architecture

---

## License

MIT © 2025 [Faisal Zakari Ibrahim](https://github.com/faisalzakariibrahim)

Built with ❤️ and AI — part of the **Flicktek** ecosystem.
