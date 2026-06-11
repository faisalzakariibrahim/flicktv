# FlickTV v2.0 — Feature Roadmap & Prioritized Backlog

> Generated: 2026-06-11
> Current state: 13,390 channels in DB (iptv-org 8,859 + Plex 665 + original)
> Live: flicktv.vercel.app (web) | flicktv-production.up.railway.app (backend)
> Mobile: Expo/React Native in mobile/, EAS configured for Android

---

## Current State Assessment

### What Works
- Backend API running on Railway (Express + Supabase)
- Web frontend on Vercel (single-file React prototype, mock data only)
- Mobile app shell with Expo Router (tabs, auth screens, player screen)
- Channel ingestion pipeline: iptv-org + Plex + priority streams
- EAS build config ready (APK + App Bundle defined)
- Stream health worker coded (cron every 30min)
- Daily channel scan worker coded (midnight cron)

### Critical Gaps
1. Web frontend uses **hardcoded mock data** (18 channels) — NOT connected to the real API
2. Pagination capped at 50 with **no "load more"** mechanism
3. Category display is **static/fake** — not driven by DB categories
4. Backend health workers are **coded but likely not running** (cron depends on node-cron in-process)
5. No auto-removal of dead channels
6. Mobile app has **no API integration** — all screens are UI shells
7. No EAS build has been submitted yet

---

## Prioritized Backlog

### P0 — CRITICAL (Do First)

#### Frontend: Connect to Real API
**File:** `apps/web/src/FlickTVPrototype.jsx` (1022 lines, single file)
- Replace hardcoded `CHANNELS` mock array with real API calls to backend
- Replace hardcoded `CATEGORIES` with dynamic fetch from `/api/channels/categories` (new endpoint needed)
- Fetch channels from `GET /api/channels?page=1&limit=50`
- **Effort:** 2-3 days
- **Impact:** Users see real channels instead of 18 fake ones

#### Frontend: Fix Pagination — "Load More"
**File:** `apps/web/src/FlickTVPrototype.jsx`
- Current: loads all channels at once, no pagination in the UI
- Add "Load More" button at bottom of channel grid
- Each click fetches next page: `GET /api/channels?page=N&limit=50`
- Track `total` from API response to hide button when all loaded
- Add loading spinner during fetch
- **Effort:** 1 day
- **Impact:** Can browse all 13,390+ channels instead of being stuck at 50

#### Frontend: Fix Category Display
**File:** `apps/web/src/FlickTVPrototype.jsx`
- Current: 12 hardcoded categories with static emoji
- Replace with dynamic categories from DB (query distinct `group_title` or `category`)
- Category counts should reflect real channel counts
- Add "HD Only" and "Country" filter pills (API already supports `hd` and `country` params)
- **Effort:** 1 day
- **Impact:** Users can actually filter by real categories

#### Backend: Verify Workers Are Running
**Files:** `backend/src/workers/streamHealthWorker.js`, `dailyScanWorker.js`
- Code exists but depends on `node-cron` inside the process — verify it's actually scheduled
- Check Railway logs for health check output
- If not running, add startup logging and verify `node-cron` is installed as a dependency
- **Effort:** 0.5 day
- **Impact:** Dead channels get flagged; daily scan finds new channels

---

### P1 — HIGH (Do Next)

#### Backend: Channel Health Check — Production Hardening
**File:** `backend/src/workers/streamHealthWorker.js`
- Currently checks only 500 channels per run (`.limit(500)`) — at 13,390 channels this misses 96%
- Remove `.limit(500)` or paginate through ALL channels
- Add concurrency control to avoid overwhelming external streams (max 10 parallel HEAD requests)
- Add retry logic: fail 2 times before marking dead (avoid false positives from temporary outages)
- Store `consecutive_failures` counter; only mark dead after 3 consecutive failures
- **Effort:** 1.5 days
- **Impact:** Reliable dead channel detection at scale

#### Backend: Auto-Remove Dead Channels
**New file:** `backend/src/workers/deadChannelCleaner.js`
- New cron: run daily, 2 hours after daily scan
- Query channels where `is_working = false` AND `consecutive_failures >= 3` AND `last_checked < NOW() - INTERVAL '7 days'`
- Move to `archived_channels` table (don't hard-delete — audit trail)
- Or: just set `is_active = false` so they're excluded from API responses
- Log count of removed channels
- **Effort:** 1 day
- **Impact:** DB stays clean, API responses stay fast, users don't see dead streams

#### Backend: New API Endpoints Needed
**File:** `backend/src/routes/channels.js`
- `GET /api/channels/categories` — return distinct categories with counts
- `GET /api/channels/countries` — return distinct countries with counts
- `DELETE /api/channels/dead` — admin endpoint to bulk-remove dead channels
- `GET /api/channels/stats` — total, by category, by country, alive/dead counts
- **Effort:** 1 day
- **Impact:** Frontend filters need this data

#### Mobile: API Integration Layer
**Dir:** `mobile/lib/`
- Create `api.js` — centralized API client (base URL, auth headers, error handling)
- Create `useChannels.js` — React hook for fetching paginated channels
- Create `useCategories.js` — hook for fetching categories
- Connect existing screen components to real data
- **Effort:** 2-3 days
- **Impact:** Mobile app shows real channels

---

### P2 — MEDIUM (Phase 2)

#### Frontend: Replace Prototype With Proper Next.js App
**Dir:** `apps/web/src/`
- Current: single 1022-line JSX file with inline styles
- Migrate to proper Next.js structure: `app/` directory, layout, pages
- Use Tailwind CSS (already in README deps but not installed)
- Split into components: ChannelGrid, ChannelCard, CategoryBar, SearchBar, Player
- Add proper routing: `/`, `/category/:id`, `/channel/:id`, `/search`
- **Effort:** 3-5 days
- **Impact:** Maintainable codebase, proper SEO, faster iteration

#### Mobile: Android Build via EAS
**File:** `mobile/eas.json` (already configured)
- Run `eas build --platform android --profile preview` for APK
- Run `eas build --platform android --profile production` for App Bundle
- Submit to Google Play Internal Track
- **Blockers:** Need Google Services JSON (`google-services.json`) for push notifications
- **Effort:** 1 day (build) + 1 day (store setup)
- **Impact:** Testable Android APK for stakeholders

#### Backend: Stream Verification on Import
**File:** `scripts/findWorkingChannels.js`
- Already exists: quick-tests each stream with 4s timeout
- Integrate into the import pipeline: only insert channels that pass health check
- Add post-import report: X channels tested, Y working, Z skipped
- **Effort:** 1 day
- **Impact:** New imports don't pollute DB with dead channels

#### Automation: Weekly iptv-org Re-Scrape
**File:** `scripts/fetchPlatformChannels.js` + `backend/src/workers/dailyScanWorker.js`
- Daily scan worker already coded — verify it runs on Railway
- If Railway process restarts daily, the cron won't fire at midnight reliably
- **Better approach:** Use GitHub Actions cron to trigger the scan via HTTP endpoint
- Create `POST /api/admin/trigger-scan` endpoint (admin auth required)
- GitHub Actions runs weekly, hits the endpoint, scan runs in the Railway process
- **Effort:** 1.5 days
- **Impact:** Reliable weekly refresh without depending on in-process cron

---

### P3 — LOW (Phase 3)

#### Backend: EPG / TV Guide Support
**New files:** `backend/src/routes/epg.js`, `backend/src/parsers/xmltvParser.js` (exists but unused)
- Parse XMLTV files from iptv-org or user-provided sources
- Store `epg_programs` table (already in schema)
- API: `GET /api/epg/:channelId` — current + upcoming programs
- **Effort:** 3 days
- **Impact:** TV Guide feature for users

#### Mobile: iOS Build via EAS
- Similar to Android but needs Apple Developer account
- Build with `eas build --platform ios --profile production`
- Submit to TestFlight
- **Effort:** 1 day (build) + App Store setup
- **Impact:** iOS testable build

#### Frontend: User Authentication
- Integrate Supabase Auth (Google, Apple, Email)
- Protected routes: Favorites, Watch History, Playlists
- Guest mode for browsing without account
- **Effort:** 2-3 days
- **Impact:** Personalized experience, cloud sync foundation

#### Frontend: Favorites & Watch History
- UI: heart icon on channel card, "Recently Watched" section
- API: `POST /api/users/favorites`, `GET /api/users/history`
- Sync across devices when logged in
- **Effort:** 2 days
- **Impact:** Core user retention feature

---

## Dependency Graph

```
P0: Connect Frontend to API ──┬── P0: Fix Pagination
                              ├── P0: Fix Categories
                              │
P0: Verify Workers Running ──┼── P1: Health Check Hardening
                              │        │
                              │        └── P1: Auto-Remove Dead
                              │
                              └── P1: New API Endpoints
                                       │
                                       ├── P1: Mobile API Integration
                                       │        │
                                       │        └── P2: Android EAS Build
                                       │
                                       └── P2: Next.js Migration
```

## Suggested Sprint Plan

### Sprint 1 (Week 1) — "Make It Real"
1. Connect frontend to real API (P0)
2. Fix pagination with "Load More" (P0)
3. Fix category display (P0)
4. Verify workers are running (P0)
5. Add new API endpoints (P1)

**Deliverable:** Web app shows real channels from DB, paginated, with working category filters.

### Sprint 2 (Week 2) — "Clean & Mobile"
1. Health check hardening (P1)
2. Auto-remove dead channels (P1)
3. Mobile API integration (P1)
4. Android EAS build (P2)

**Deliverable:** Dead channels auto-cleaned, mobile app shows real channels, Android APK available.

### Sprint 3 (Week 3) — "Polish & Scale"
1. Next.js migration (P2)
2. Stream verification on import (P2)
3. Weekly re-scrape automation (P2)
4. EPG support (P3)

**Deliverable:** Maintainable web codebase, reliable automation, TV guide data.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Railway in-process cron is unreliable | High | High | Move to GitHub Actions trigger |
| 13,390 channels slow down health checks | High | Medium | Concurrency limits + batch processing |
| Web prototype is unmaintainable long-term | High | Medium | Prioritize Next.js migration in Sprint 3 |
| Mobile API integration reveals auth gaps | Medium | High | Add auth endpoints early in Sprint 2 |
| EAS build fails (missing config) | Medium | Low | Test with `development` profile first |
| Supabase free tier limits hit | Low | High | Monitor usage, add caching layer |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `apps/web/src/FlickTVPrototype.jsx` | Web frontend (single file, 1022 lines) |
| `backend/src/server.js` | Express app entry, Supabase/Anthropic init |
| `backend/src/routes/channels.js` | Channel CRUD + pagination API |
| `backend/src/workers/streamHealthWorker.js` | 30-min health check cron |
| `backend/src/workers/dailyScanWorker.js` | Midnight channel scan cron |
| `mobile/app/` | Expo Router screens |
| `mobile/eas.json` | EAS build profiles |
| `scripts/findWorkingChannels.js` | Stream tester (4s timeout) |
| `scripts/fetchPlatformChannels.js` | Priority stream importer |
| `schema.sql` | Full DB schema (Supabase/PostgreSQL) |
| `docs/ARCHITECTURE.md` | System design doc |
