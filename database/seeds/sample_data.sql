-- FlickTV AI — Sample Seed Data
-- Run after migrations for development/testing

-- Insert a test user (password: Test1234!)
INSERT INTO users (id, email, display_name, provider, plan) VALUES
  ('00000000-0000-0000-0000-000000000001', 'demo@flicktv.ai', 'Demo User', 'email', 'premium');

-- Sample public IPTV playlist (uses iptv-org free data)
INSERT INTO playlists (id, user_id, name, type, url, sync_status) VALUES
  ('00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000001',
   'IPTV-org Free Channels',
   'm3u_url',
   'https://iptv-org.github.io/iptv/index.m3u',
   'pending');
