import { supabase } from '../server.js';
import { logger } from '../utils/logger.js';

/**
 * Verify Supabase JWT and attach user to req.user.
 * Works for email/password, Google, and Apple sessions — all token types are
 * issued by Supabase Auth, so a single getUser() call covers all providers.
 */
export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  // Also accept ?token= for video player requests that can't send headers
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    logger.error('Token verification failed', err);
    res.status(401).json({ error: 'Token verification failed' });
  }
}

/**
 * Enforce that the user is an admin (checks users.is_admin column).
 * Must be used AFTER verifyToken.
 */
export async function requireAdmin(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', req.user.id)
      .single();

    if (error || !data?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    logger.error('Admin check failed', err);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}
