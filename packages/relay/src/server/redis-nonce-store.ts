import type { NonceStore } from "./nonce-store";
import type { RelayRedisClient } from "./relay-redis";

function nonceKey(prefix: string, did: string, nonce: string): string {
  return `${prefix}:agent-nonce:${did}:${nonce}`;
}

/** Redis-backed nonce store — SET NX PX for atomic replay rejection with TTL. */
export function createRedisNonceStore(redis: RelayRedisClient, prefix = "relay"): NonceStore {
  return {
    async tryInsert(p) {
      const ttlMs = Math.max(1, p.expiresAtMs - p.nowMs);
      const key = nonceKey(prefix, p.did, p.nonce);
      const result = await redis.send("SET", [key, "1", "NX", "PX", String(ttlMs)]);
      return result === "OK";
    },
    async sweepExpired() {
      return 0;
    },
  };
}
