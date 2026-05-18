/**
 * FlickTV AI — JWT Auth Middleware
 */
import jwt from 'jsonwebtoken';
import { supabase } from '../server.js';

export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.substring(7);

  try {
    // Verify with Supabase (handles JWT validation + expiry)
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check if user is banned
    const { data: profile } = await supabase
      .from('users')
      .select('id, plan, is_banned, is_admin')
      .eq('id', user.id)
      .single();

    if (profile?.is_banned) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    req.user = { ...user, ...profile };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token verification failed' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function requirePremium(req, res, next) {
  if (req.user?.plan === 'free') {
    return res.status(402).json({ error: 'Premium plan required', upgrade_url: '/upgrade' });
  }
  next();
}
