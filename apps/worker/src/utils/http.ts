import type { Context } from 'hono';

/**
 * Sends a JSON error response with a consistent shape.
 */
export function jsonError(c: Context, status: number, message: string, code?: string) {
  return c.json(
    {
      error: message,
      code
    },
    status
  );
}
