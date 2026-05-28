import { supabase } from '../server.js';
import { logger } from '../utils/logger.js';

// Soft auth: populates req.user if a valid token is present, but never blocks.
export async function verifyToken(req, _res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.query.token;

  if (!token) return next();

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      req.user = user;
      req.token = token;
    }
  } catch (err) {
    logger.error('Token verification failed', err);
  }
  next();
}

// Hard auth: use this on routes that truly require a logged-in user.
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.query.token;

  if (!token) return res.status(401).json({ error: 'Missing authorization header' });

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    logger.error('Token verification failed', err);
    res.status(401).json({ error: 'Token verification failed' });
  }
}

// Must be used after requireAuth.
export async function requireAdmin(req, res, next) {
  // Check password-based auth first (for admin dashboard)
  const pwd = req.headers['x-admin-password'] || req.query.admin_password;
  if (pwd && pwd === process.env.ADMIN_PASSWORD) {
    req.user = { role: 'admin' };
    return next();
  }

  // Fall back to JWT-based admin check
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });

  try {
    const { data, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', req.user.id)
      .single();

    if (error || !data?.is_admin) return res.status(403).json({ error: 'Admin access required' });
    next();
  } catch (err) {
    logger.error('Admin check failed', err);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}

// Password-only auth for admin dashboard (no JWT required)
export function requireAdminPassword(req, res, next) {
  const pwd = req.headers['x-admin-password'] || req.query.admin_password;
  if (pwd && pwd === process.env.ADMIN_PASSWORD) {
    req.user = { role: 'admin' };
    return next();
  }
  return res.status(401).json({ error: 'Invalid admin password' });
}
