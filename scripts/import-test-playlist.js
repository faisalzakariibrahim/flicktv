/**
 * One-off script: import the free test IPTV playlist for the first user in the DB.
 * Run from /Users/kingfaisal/FLICKTV with: node scripts/import-test-playlist.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { parseM3U } from '../parsers/m3uParser.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const TEST_M3U = process.env.TEST_M3U_URL || 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';

async function main() {
  // 1. Find the first user
  const { data: users, error: uErr } = await supabase.from('users').select('id, email').limit(1);
  if (uErr || !users?.length) { console.error('No users found:', uErr?.message); process.exit(1); }
  const user = users[0];
  console.log(`Importing for user: ${user.email} (${user.id})`);

  // 2. Create playlist record
  const { data: playlist, error: pErr } = await supabase
    .from('playlists')
    .insert({ user_id: user.id, name: 'Free IPTV', type: 'm3u_url', url: TEST_M3U, sync_status: 'syncing' })
    .select().single();
  if (pErr) { console.error('Failed to create playlist:', pErr.message); process.exit(1); }
  console.log(`Playlist created: ${playlist.id}`);

  // 3. Fetch and parse M3U
  console.log(`Fetching: ${TEST_M3U}`);
  const res = await fetch(TEST_M3U, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)' } });
  if (!res.ok) { console.error(`HTTP ${res.status}`); process.exit(1); }
  const content = await res.text();
  const channels = parseM3U(content);
  console.log(`Parsed ${channels.length} channels`);

  // 4. Insert channels in batches
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < channels.length; i += BATCH) {
    const batch = channels.slice(i, i + BATCH).map(ch => ({ ...ch, playlist_id: playlist.id, user_id: user.id }));
    const { error } = await supabase.from('channels').insert(batch);
    if (error) console.warn(`Batch ${i}-${i + BATCH} error:`, error.message);
    else inserted += batch.length;
    process.stdout.write(`\r  Inserted ${inserted}/${channels.length}...`);
  }

  // 5. Update playlist status
  await supabase.from('playlists').update({ sync_status: 'ok', channel_count: inserted, last_synced: new Date() }).eq('id', playlist.id);

  console.log(`\n✓ Done! ${inserted} channels imported.\n`);

  // 6. Preview first 20 channels
  const { data: preview } = await supabase
    .from('channels')
    .select('name, category, is_live, is_hd, is_4k, country')
    .eq('playlist_id', playlist.id)
    .order('name')
    .limit(20);

  console.log('─── Sample channels ───────────────────────────────────');
  preview?.forEach(ch => {
    const tags = [ch.category, ch.is_live && 'LIVE', ch.is_hd && 'HD', ch.is_4k && '4K', ch.country].filter(Boolean).join(' | ');
    console.log(`  ${ch.name.padEnd(40)} ${tags}`);
  });
  console.log('───────────────────────────────────────────────────────');
}

main().catch(err => { console.error(err); process.exit(1); });
