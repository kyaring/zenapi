import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { addHours, nowIso } from '../utils/time';
import { generateToken, sha256Hex } from '../utils/crypto';
import { jsonError } from '../utils/http';
import { adminAuth } from '../middleware/adminAuth';

const auth = new Hono<AppEnv>();

/**
 * Logs in the admin user with a password.
 */
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.password) {
    return jsonError(c, 400, 'password_required', 'password_required');
  }

  if (body.password !== c.env.ADMIN_PASSWORD) {
    return jsonError(c, 401, 'invalid_password', 'invalid_password');
  }

  const rawToken = generateToken('admin_');
  const tokenHash = await sha256Hex(rawToken);
  const ttlHours = Number(c.env.SESSION_TTL_HOURS ?? '12');
  const expiresAt = addHours(new Date(), Number.isNaN(ttlHours) ? 12 : ttlHours).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO admin_sessions (id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)'
  )
    .bind(crypto.randomUUID(), tokenHash, expiresAt, nowIso())
    .run();

  return c.json({
    token: rawToken,
    expires_at: expiresAt
  });
});

/**
 * Invalidates the current admin session token.
 */
auth.post('/logout', adminAuth, async (c) => {
  const sessionId = c.get('adminSessionId');
  if (sessionId) {
    await c.env.DB.prepare('DELETE FROM admin_sessions WHERE id = ?')
      .bind(String(sessionId))
      .run();
  }
  return c.json({ ok: true });
});

export default auth;
