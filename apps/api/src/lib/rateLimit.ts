import type { MiddlewareHandler } from "hono";

/**
 * Small in-memory fixed-window limiter. Per-instance only, which is enough to blunt abuse of the
 * IC-proxying routes on a single service.
 *
 * `check(key)` returns null when allowed, or the seconds until the window resets when limited.
 */
export function createLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): number | null => {
    const now = Date.now();
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return null;
    }
    if (++entry.count > limit) return Math.ceil((entry.resetAt - now) / 1000);
    return null;
  };
}

/**
 * Client IP behind Render's proxy. Render appends the real peer address to X-Forwarded-For, so the
 * LAST entry is trustworthy; earlier entries are whatever the client sent and are spoofable.
 */
export function clientIp(header: string | undefined): string {
  const parts = header?.split(",").map((s) => s.trim()).filter(Boolean);
  return parts?.length ? parts[parts.length - 1] : "unknown";
}

/** Per-IP middleware. */
export function rateLimit(limit: number, windowMs: number): MiddlewareHandler {
  const check = createLimiter(limit, windowMs);
  return async (c, next) => {
    const retry = check(clientIp(c.req.header("x-forwarded-for")));
    if (retry !== null) {
      c.header("Retry-After", String(retry));
      return c.json({ error: "Too many requests" }, 429);
    }
    await next();
  };
}
