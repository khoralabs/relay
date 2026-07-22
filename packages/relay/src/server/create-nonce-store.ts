import type { Database } from "bun:sqlite";
import { createInMemoryNonceStore } from "./in-memory-nonce-store";
import type { NonceStore } from "./nonce-store";
import { createRedisNonceStore } from "./redis-nonce-store";
import type { RelayRedisClient } from "./relay-redis";
import { createSqliteNonceStore } from "./sqlite-nonce-store";

export function createNonceStore(opts?: {
  db?: Database;
  redis?: RelayRedisClient;
  redisPrefix?: string;
}): NonceStore {
  if (opts?.redis !== undefined) {
    return createRedisNonceStore(opts.redis, opts.redisPrefix ?? "relay");
  }
  if (opts?.db !== undefined) {
    return createSqliteNonceStore(opts.db);
  }
  return createInMemoryNonceStore();
}
