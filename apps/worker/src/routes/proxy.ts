import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { tokenAuth, type TokenRecord } from '../middleware/tokenAuth';
import { createWeightedOrder, extractModels, type ChannelRecord } from '../services/channels';
import { recordUsage } from '../services/usage';
import { jsonError } from '../utils/http';
import { safeJsonParse } from '../utils/json';
import { normalizeBaseUrl } from '../utils/url';

const proxy = new Hono<AppEnv>();

function channelSupportsModel(channel: ChannelRecord, model?: string | null): boolean {
  if (!model) {
    return true;
  }
  const models = extractModels(channel);
  return models.some((entry) => entry.id === model);
}

function filterAllowedChannels(channels: ChannelRecord[], tokenRecord: TokenRecord): ChannelRecord[] {
  const allowed = safeJsonParse<string[] | null>(tokenRecord.allowed_channels, null);
  if (!allowed || allowed.length === 0) {
    return channels;
  }
  const allowedSet = new Set(allowed);
  return channels.filter((channel) => allowedSet.has(channel.id));
}

/**
 * Determines whether a response status should be retried.
 *
 * Args:
 *   status: HTTP response status code.
 *
 * Returns:
 *   True if the status is retryable.
 */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Waits before the next retry round.
 *
 * Args:
 *   ms: Delay in milliseconds.
 *
 * Returns:
 *   Promise resolved after delay.
 */
async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * OpenAI-compatible proxy handler.
 */
proxy.all('/*', tokenAuth, async (c) => {
  const tokenRecord = c.get('tokenRecord') as TokenRecord;
  const requestText = await c.req.text();
  const parsedBody = requestText ? safeJsonParse<any>(requestText, null) : null;
  const model = parsedBody?.model ?? null;
  const isStream = parsedBody?.stream === true;

  const channelResult = await c.env.DB.prepare('SELECT * FROM channels WHERE status = ?')
    .bind('active')
    .all();
  const activeChannels = (channelResult.results ?? []) as ChannelRecord[];
  const allowedChannels = filterAllowedChannels(activeChannels, tokenRecord);
  const modelChannels = allowedChannels.filter((channel) => channelSupportsModel(channel, model));
  const candidates = modelChannels.length > 0 ? modelChannels : allowedChannels;

  if (candidates.length === 0) {
    return jsonError(c, 503, 'no_available_channels', 'no_available_channels');
  }

  const ordered = createWeightedOrder(candidates);
  const targetPath = c.req.path;
  const retryRounds = Math.max(1, Number(c.env.PROXY_RETRY_ROUNDS ?? '1'));
  const retryDelayMs = Math.max(0, Number(c.env.PROXY_RETRY_DELAY_MS ?? '200'));
  let lastResponse: Response | null = null;
  let lastChannel: ChannelRecord | null = null;
  const start = Date.now();
  let selectedChannel: ChannelRecord | null = null;
  let usagePayload: any = null;

  let round = 0;
  while (round < retryRounds && !selectedChannel) {
    let shouldRetry = false;
    for (const channel of ordered) {
      lastChannel = channel;
      const target = `${normalizeBaseUrl(channel.base_url)}${targetPath}${c.req.url.includes('?') ? `?${c.req.url.split('?')[1]}` : ''}`;
      const headers = new Headers(c.req.header());
      headers.set('Authorization', `Bearer ${channel.api_key}`);
      headers.set('x-api-key', String(channel.api_key));
      headers.delete('host');
      headers.delete('content-length');

      try {
        const response = await fetch(target, {
          method: c.req.method,
          headers,
          body: requestText || undefined
        });

        lastResponse = response;
        if (response.ok) {
          selectedChannel = channel;
          if (!isStream && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.clone().json().catch(() => null);
            usagePayload = data?.usage ?? null;
          }
          break;
        }

        if (isRetryableStatus(response.status)) {
          shouldRetry = true;
        }
      } catch {
        lastResponse = null;
        shouldRetry = true;
      }
    }

    if (selectedChannel || !shouldRetry) {
      break;
    }

    round += 1;
    if (round < retryRounds) {
      await sleep(retryDelayMs);
    }
  }

  const latencyMs = Date.now() - start;

  if (!lastResponse) {
    await recordUsage(c.env.DB, {
      tokenId: tokenRecord.id,
      model,
      requestPath: targetPath,
      totalTokens: 0,
      latencyMs,
      status: 'error'
    });
    return jsonError(c, 502, 'upstream_unavailable', 'upstream_unavailable');
  }

  const channelForUsage = selectedChannel ?? lastChannel;
  if (channelForUsage) {
    const totalTokens = Number(usagePayload?.total_tokens ?? 0);
    await recordUsage(c.env.DB, {
      tokenId: tokenRecord.id,
      channelId: channelForUsage.id,
      model,
      requestPath: targetPath,
      totalTokens: Number.isNaN(totalTokens) ? 0 : totalTokens,
      promptTokens: Number(usagePayload?.prompt_tokens ?? 0),
      completionTokens: Number(usagePayload?.completion_tokens ?? 0),
      cost: 0,
      latencyMs,
      status: lastResponse.ok ? 'ok' : 'error'
    });
  }

  return lastResponse;
});

export default proxy;
