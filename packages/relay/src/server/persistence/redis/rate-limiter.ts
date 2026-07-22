import type { RateLimitCheck, RateLimitRule } from "../../rate-limit";
import type { RelayRedisClient } from "./client";

function rateLimitKey(prefix: string, bucket: string, windowStart: number): string {
  return `${prefix}:rl:${bucket}:${windowStart}`;
}

export function createRedisRateLimiter(
  redis: RelayRedisClient,
  rule: RateLimitRule,
  prefix = "relay",
): (key: string) => RateLimitCheck | Promise<RateLimitCheck> {
  const windowSecs = Math.max(1, Math.ceil(rule.windowMs / 1000));
  return async (key: string) => {
    const now = Date.now();
    const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
    const redisKey = rateLimitKey(prefix, key, windowStart);
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSecs);
    }
    if (count > rule.max) {
      const retryMs = windowStart + rule.windowMs - now;
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryMs / 1000)) };
    }
    return { ok: true };
  };
}
