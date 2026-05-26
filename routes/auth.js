/**
 * FlickTV AI — Auth Routes
 * Handles email/password, Google, and Apple sign-in via Supabase Auth.
 * Social auth (Google/Apple) is initiated on the mobile client using
 * expo-auth-session / expo-apple-authentication. The resulting Supabase
 * session tokens are then used directly — this backend verifies them via
 * the verifyToken middleware on protected routes.
 */

import { Router } from 'express';
import { supabase } from '../server.js';
import { logger } from '../utils/logger.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// ─── Sign Up (email / password) ───────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  const { email, password, display_name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    // Create user profile row
    if (data.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        email,
        display_name: display_name || email.split('@')[0],
        provider: 'email',
      }, { onConflict: 'id' });
    }

    res.status(201).json({
      message: 'Account created. Check your email to confirm.',
      user: sanitizeUser(data.user),
      session: data.session,
    });
  } catch (err) {
    logger.error('Signup error', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// ─── Sign In (email / password) ───────────────────────────────────────────────
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });

    // Update last_seen
    await supabase
      .from('users')
      .update({ last_seen_at: new Date() })
      .eq('id', data.user.id);

    res.json({
      user: sanitizeUser(data.user),
      session: data.session,
    });
  } catch (err) {
    logger.error('Signin error', err);
    res.status(500).json({ error: 'Sign in failed' });
  }
});

// ─── Sync Social Auth Profile ─────────────────────────────────────────────────
// Called by the mobile app after completing Google or Apple sign-in.
// The app already has a valid Supabase session — this just ensures the
// user profile row exists with the correct provider info.
router.post('/sync-social', verifyToken, async (req, res) => {
  const { display_name, avatar_url } = req.body;
  const userId = req.user.id;
  const provider = req.user.app_metadata?.provider || 'google';

  try {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: req.user.email,
        display_name: display_name || req.user.user_metadata?.full_name || req.user.email?.split('@')[0],
        avatar_url: avatar_url || req.user.user_metadata?.avatar_url || null,
        provider,
        last_seen_at: new Date(),
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ user: data });
  } catch (err) {
    logger.error('Social sync error', err);
    res.status(500).json({ error: 'Profile sync failed' });
  }
});

// ─── Refresh Token ────────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) return res.status(401).json({ error: error.message });
    res.json({ session: data.session });
  } catch (err) {
    logger.error('Refresh error', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ─── Forgot Password ──────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'flicktv://reset-password',
    });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Password reset email sent' });
  } catch (err) {
    logger.error('Forgot password error', err);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// ─── Sign Out ─────────────────────────────────────────────────────────────────
router.post('/signout', verifyToken, async (req, res) => {
  try {
    await supabase.auth.admin.signOut(req.token);
    res.json({ message: 'Signed out successfully' });
  } catch (err) {
    // Non-fatal — client should clear tokens regardless
    logger.warn('Signout error', err);
    res.json({ message: 'Signed out' });
  }
});

// ─── Get Current Session ──────────────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, display_name, avatar_url, provider, plan, plan_expires_at, preferences, created_at, streams_watched')
      .eq('id', req.user.id)
      .single();

    if (error) return res.status(404).json({ error: 'User profile not found' });
    res.json({ user: data });
  } catch (err) {
    logger.error('Get me error', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    email_confirmed_at: user.email_confirmed_at,
    created_at: user.created_at,
  };
}

export default router;
