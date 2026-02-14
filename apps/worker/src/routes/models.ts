import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { extractModels } from '../services/channels';

const models = new Hono<AppEnv>();

/**
 * Returns aggregated models from all channels.
 */
models.get('/', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM channels WHERE status = ?').bind('active').all();
  const entries = (result.results ?? []).flatMap((channel) => extractModels(channel as any));

  const map = new Map<string, { id: string; channels: { id: string; name: string }[] }>();
  for (const entry of entries) {
    const existing = map.get(entry.id) ?? { id: entry.id, channels: [] };
    existing.channels.push({ id: entry.channelId, name: entry.channelName });
    map.set(entry.id, existing);
  }

  return c.json({
    models: Array.from(map.values())
  });
});

export default models;
