import type { RelayPersistenceStrategy } from "../core/types";
import type { RelayRedisClient } from "./client";
import { createRedisNonceStore } from "./nonce-store";
import { createRedisRateLimiter } from "./rate-limiter";

export function createRedisPersistenceStrategy(
  redis: RelayRedisClient,
  prefix = "relay",
): RelayPersistenceStrategy {
  return {
    kind: "redis",
    createNonceStore: () => createRedisNonceStore(redis, prefix),
    createRateLimiter: (rule) => {
      if (rule === null) return () => ({ ok: true });
      return createRedisRateLimiter(redis, rule, prefix);
    },
  };
}
