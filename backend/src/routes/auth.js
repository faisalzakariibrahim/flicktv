/**
 * FlickTV AI — Auth Routes
 * Uses Supabase Auth under the hood
 */
import { Router } from 'express';
import { supabase } from '../server.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });

  // Create user profile
  await supabase.from('users').insert({
    id: data.user.id,
    email,
    display_name: displayName || email.split('@')[0],
    provider: 'email',
  });

  res.status(201).json({ user: data.user, session: data.session });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  // Update last_seen
  await supabase.from('users').update({ last_seen_at: new Date() }).eq('id', data.user.id);

  res.json({ user: data.user, session: data.session });
});

// POST /api/auth/logout
router.post('/logout', verifyToken, async (req, res) => {
  await supabase.auth.signOut();
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  const { data: profile } = await supabase
    .from('users')
    .select('*, subscriptions(*)')
    .eq('id', req.user.id)
    .single();
  res.json(profile);
});

// POST /api/auth/guest
router.post('/guest', async (req, res) => {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('users').insert({
    id: data.user.id,
    display_name: 'Guest',
    provider: 'guest',
    plan: 'free',
  });

  res.json({ user: data.user, session: data.session });
});

export default router;
