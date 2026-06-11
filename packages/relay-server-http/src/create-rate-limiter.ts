import type { Database } from "bun:sqlite";
import {
  createInMemoryRateLimiter,
  envRatePerMinute,
  type RateLimitCheck,
  type RateLimiter,
  type RateLimitRule,
} from "./rate-limit";
import { createRedisRateLimiter } from "./redis-rate-limiter";
import type { RelayRedisClient } from "./relay-redis";
import { createSqliteRateLimiter } from "./sqlite-rate-limiter";

export function createBackedRateLimiter(
  rule: RateLimitRule | null,
  opts?: { db?: Database; redis?: RelayRedisClient; redisPrefix?: string },
): RateLimiter {
  if (rule === null) return () => ({ ok: true });
  if (opts?.redis !== undefined) {
    return createRedisRateLimiter(opts.redis, rule, opts.redisPrefix ?? "relay");
  }
  if (opts?.db !== undefined) {
    return createSqliteRateLimiter(opts.db, rule);
  }
  return createInMemoryRateLimiter(rule);
}

export function createRelayRateLimiterFromEnv(
  envVar: string | undefined,
  defaultMax: number,
  opts?: { db?: Database; redis?: RelayRedisClient; redisPrefix?: string },
): RateLimiter {
  return createBackedRateLimiter(envRatePerMinute(envVar, defaultMax), opts);
}

export async function checkRateLimit(limiter: RateLimiter, key: string): Promise<RateLimitCheck> {
  return await limiter(key);
}
