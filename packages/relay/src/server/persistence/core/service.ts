import { pairingSecretKeyFromEnv } from "@khoralabs/relay/crypto";
import {
  createRelayRedisClient,
  relayRedisPrefixFromEnv,
  relayRedisUrlFromEnv,
} from "../redis/client";
import { createRedisPersistenceStrategy } from "../redis/strategy";
import type { RelayPersistence, RelayPersistenceStrategy } from "./types";

export type CreateRelayPersistenceOptions = {
  durable: RelayPersistenceStrategy;
  ephemeral?: RelayPersistenceStrategy;
  pairingSecretKey?: Uint8Array;
  env?: NodeJS.ProcessEnv;
};

/** Redis strategy when `RELAY_REDIS_URL` is set; otherwise undefined (use durable/memory). */
export function ephemeralStrategyFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): RelayPersistenceStrategy | undefined {
  const redisUrl = relayRedisUrlFromEnv(env);
  if (redisUrl === undefined) return undefined;
  return createRedisPersistenceStrategy(
    createRelayRedisClient(redisUrl),
    relayRedisPrefixFromEnv(env),
  );
}

/**
 * Compose durable (SQLite) stores with optional ephemeral (Redis) for nonce + rate limits.
 * Priority for ephemeral: explicit `ephemeral`, else env Redis, else `durable`.
 */
export function createRelayPersistence(opts: CreateRelayPersistenceOptions): RelayPersistence {
  const durable = opts.durable;
  const env = opts.env ?? process.env;
  const ephemeral = opts.ephemeral ?? ephemeralStrategyFromEnv(env) ?? durable;
  const pairingKey = opts.pairingSecretKey ?? pairingSecretKeyFromEnv(env);

  const createAdmission = durable.createAdmissionStore;
  const createSpool = durable.createBlobSpool;
  const createRegistry = durable.createChannelRegistry;
  if (createAdmission === undefined || createSpool === undefined || createRegistry === undefined) {
    throw new Error(
      "createRelayPersistence requires a durable strategy with admission, spool, and registry",
    );
  }

  return {
    admission: createAdmission(pairingKey),
    spool: createSpool(),
    registry: createRegistry(),
    nonceStore: ephemeral.createNonceStore(),
    createRateLimiter: (rule) => ephemeral.createRateLimiter(rule),
  };
}
