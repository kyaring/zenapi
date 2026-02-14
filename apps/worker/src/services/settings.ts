import type { D1Database } from '@cloudflare/workers-types';
import { nowIso } from '../utils/time';

const RETENTION_KEY = 'log_retention_days';

/**
 * Returns the log retention days from settings or env fallback.
 */
export async function getRetentionDays(db: D1Database, fallback: number): Promise<number> {
  const setting = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(RETENTION_KEY).first();
  if (setting?.value) {
    const parsed = Number(setting.value);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

/**
 * Updates the log retention days setting.
 */
export async function setRetentionDays(db: D1Database, days: number): Promise<void> {
  const value = Math.max(1, Math.floor(days)).toString();
  await db
    .prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
    .bind(RETENTION_KEY, value, nowIso())
    .run();
}

/**
 * Loads generic settings as a key/value map.
 */
export async function listSettings(db: D1Database): Promise<Record<string, string>> {
  const result = await db.prepare('SELECT key, value FROM settings').all();
  const map: Record<string, string> = {};
  for (const row of result.results ?? []) {
    map[String(row.key)] = String(row.value);
  }
  return map;
}
