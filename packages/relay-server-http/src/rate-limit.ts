import { RELAY_HTTP_HEADER } from "./http-headers";

export type RateLimitRule = { windowMs: number; max: number };

export function envRatePerMinute(
  raw: string | undefined,
  defaultMax: number,
): RateLimitRule | null {
  if (raw === undefined || raw.trim() === "") {
    return { windowMs: 60_000, max: defaultMax };
  }
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return { windowMs: 60_000, max: Math.floor(n) };
}

export type RateLimitCheck = { ok: true } | { ok: false; retryAfterSec: number };

export type RateLimiter = (key: string) => RateLimitCheck | Promise<RateLimitCheck>;

const STALE_KEY_SWEEP_INTERVAL_MS = 60_000;

export function createInMemoryRateLimiter(rule: RateLimitRule | null): RateLimiter {
  if (rule === null) return () => ({ ok: true });
  const windowMs = rule.windowMs;
  const max = rule.max;
  const buckets = new Map<string, number[]>();
  let lastStaleSweepMs = 0;

  function maybeSweepStaleKeys(now: number): void {
    if (now - lastStaleSweepMs < STALE_KEY_SWEEP_INTERVAL_MS) return;
    lastStaleSweepMs = now;
    const cutoff = now - windowMs;
    for (const [key, hits] of buckets) {
      const active = hits.filter((t) => t > cutoff);
      if (active.length === 0) {
        buckets.delete(key);
      } else if (active.length !== hits.length) {
        buckets.set(key, active);
      }
    }
  }

  return (key: string) => {
    const now = Date.now();
    maybeSweepStaleKeys(now);
    const cutoff = now - windowMs;
    let hits = buckets.get(key) ?? [];
    hits = hits.filter((t) => t > cutoff);
    if (hits.length >= max) {
      const oldest = hits[0] ?? now;
      const retryMs = oldest + windowMs - now;
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryMs / 1000)) };
    }
    hits.push(now);
    buckets.set(key, hits);
    return { ok: true };
  };
}

/** @deprecated Use createInMemoryRateLimiter or backend-specific factories. */
export function createRateLimiter(rule: RateLimitRule | null): RateLimiter {
  return createInMemoryRateLimiter(rule);
}

export function clientIpFromRequest(req: Request): string {
  const realIp = req.headers.get(RELAY_HTTP_HEADER.xRealIp)?.trim();
  if (realIp !== undefined && realIp.length > 0) return realIp;
  const xff = req.headers.get(RELAY_HTTP_HEADER.xForwardedFor)?.trim();
  if (xff !== undefined && xff.length > 0) {
    const first = xff.split(",")[0]?.trim();
    if (first !== undefined && first.length > 0) return first;
  }
  return "direct";
}
