import { RELAY_HTTP_HEADER } from "./http-headers";

export type RateLimitRule = { windowMs: number; max: number };

export const RELAY_TRUSTED_PROXY_ENV = "RELAY_TRUSTED_PROXY" as const;

export type ClientIpOptions = {
  trustedProxy?: boolean;
  peerAddress?: string | null;
  /** Trusted proxy hops counted from the right of X-Forwarded-For (default 1). */
  trustedProxyHops?: number;
};

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

export function relayTrustedProxyFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env[RELAY_TRUSTED_PROXY_ENV]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function peerAddressFromRequest(
  server: Bun.Server<unknown> | undefined,
  req: Request,
): string | null {
  if (server === undefined) return null;
  const addr = server.requestIP(req);
  return addr?.address ?? null;
}

function parseXForwardedForClientIp(xff: string, trustedProxyHops: number): string | undefined {
  const parts = xff
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return undefined;
  const hops = Math.max(1, trustedProxyHops);
  const idx = parts.length - hops - 1;
  const ip = idx >= 0 ? parts[idx] : parts[0];
  return ip !== undefined && ip.length > 0 ? ip : undefined;
}

export function clientIpFromRequest(req: Request, opts?: ClientIpOptions): string {
  const peer = opts?.peerAddress?.trim();
  const fallback = peer !== undefined && peer.length > 0 ? peer : "direct";

  if (opts?.trustedProxy !== true) {
    return fallback;
  }

  const xff = req.headers.get(RELAY_HTTP_HEADER.xForwardedFor)?.trim();
  if (xff !== undefined && xff.length > 0) {
    const fromXff = parseXForwardedForClientIp(xff, opts.trustedProxyHops ?? 1);
    if (fromXff !== undefined) return fromXff;
  }

  const realIp = req.headers.get(RELAY_HTTP_HEADER.xRealIp)?.trim();
  if (realIp !== undefined && realIp.length > 0) return realIp;

  return fallback;
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
