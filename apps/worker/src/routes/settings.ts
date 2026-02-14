import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { getRetentionDays, setRetentionDays } from '../services/settings';
import { jsonError } from '../utils/http';

const settings = new Hono<AppEnv>();

/**
 * Returns settings values.
 */
settings.get('/', async (c) => {
  const fallback = Number(c.env.LOG_RETENTION_DAYS ?? '30');
  const retention = await getRetentionDays(c.env.DB, Number.isNaN(fallback) ? 30 : fallback);
  return c.json({ log_retention_days: retention });
});

/**
 * Updates settings values.
 */
settings.put('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.log_retention_days) {
    return jsonError(c, 400, 'log_retention_days_required', 'log_retention_days_required');
  }
  const days = Number(body.log_retention_days);
  if (Number.isNaN(days) || days < 1) {
    return jsonError(c, 400, 'invalid_log_retention_days', 'invalid_log_retention_days');
  }
  await setRetentionDays(c.env.DB, days);
  return c.json({ ok: true });
});

export default settings;
