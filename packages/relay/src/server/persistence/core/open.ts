import { createMemoryPersistenceStrategy } from "../memory/strategy";
import {
  createRelayRedisClient,
  relayRedisPrefixFromEnv,
  relayRedisUrlFromEnv,
} from "../redis/client";
import { createRedisPersistenceStrategy } from "../redis/strategy";
import { openRelayDatabase } from "../sqlite/db";
import { createSqlitePersistenceStrategy } from "../sqlite/strategy";
import { createRelayPersistence } from "./service";
import type { RelayPersistence, RelayPersistenceStrategy } from "./types";

export type SqliteBackend = {
  readonly kind: "sqlite";
  path?: string;
  key?: string;
};

export type RedisBackend = {
  readonly kind: "redis";
  url?: string;
  prefix?: string;
};

export type MemoryBackend = {
  readonly kind: "memory";
};

/** Durable backends (SQLite today). Pass material only — no Database handles. */
export type DurableBackend = SqliteBackend;

/** Ephemeral backends for nonce + rate limits. */
export type EphemeralBackend = SqliteBackend | RedisBackend | MemoryBackend;

export function sqliteBackend(opts?: { path?: string; key?: string }): SqliteBackend {
  return { kind: "sqlite", path: opts?.path, key: opts?.key };
}

export function redisBackend(opts?: { url?: string; prefix?: string }): RedisBackend {
  return { kind: "redis", url: opts?.url, prefix: opts?.prefix };
}

export function memoryBackend(): MemoryBackend {
  return { kind: "memory" };
}

export type OpenRelayPersistenceOptions = {
  durable: DurableBackend;
  ephemeral?: EphemeralBackend;
  pairingSecretKey?: Uint8Array;
  env?: NodeJS.ProcessEnv;
};

export type OpenedRelayPersistence = {
  persistence: RelayPersistence;
  cleanup(): void;
};

/**
 * Open persistence from strategy material. The caller supplies per-backend options
 * (paths, keys, URLs); this owns opening resources and returns `RelayPersistence`.
 */
export function openRelayPersistence(opts: OpenRelayPersistenceOptions): OpenedRelayPersistence {
  const env = opts.env ?? process.env;
  const cleanups: Array<() => void> = [];

  const durable = openBackend(opts.durable, env, cleanups);
  const ephemeral =
    opts.ephemeral !== undefined
      ? openBackend(opts.ephemeral, env, cleanups).strategy
      : openEphemeralFromEnv(env, cleanups);

  const persistence = createRelayPersistence({
    durable: durable.strategy,
    ephemeral,
    pairingSecretKey: opts.pairingSecretKey,
    env,
  });

  return {
    persistence,
    cleanup() {
      for (const fn of [...cleanups].reverse()) fn();
    },
  };
}

function openEphemeralFromEnv(
  env: NodeJS.ProcessEnv,
  cleanups: Array<() => void>,
): RelayPersistenceStrategy | undefined {
  if (relayRedisUrlFromEnv(env) === undefined) return undefined;
  return openBackend(redisBackend(), env, cleanups).strategy;
}

function openBackend(
  backend: EphemeralBackend,
  env: NodeJS.ProcessEnv,
  cleanups: Array<() => void>,
): { strategy: RelayPersistenceStrategy } {
  switch (backend.kind) {
    case "sqlite": {
      const db = openRelayDatabase(backend.path, backend.key);
      cleanups.push(() => db.close());
      return { strategy: createSqlitePersistenceStrategy(db) };
    }
    case "redis": {
      const url = backend.url ?? relayRedisUrlFromEnv(env);
      if (url === undefined) {
        throw new Error("redisBackend requires url or RELAY_REDIS_URL");
      }
      const prefix = backend.prefix ?? relayRedisPrefixFromEnv(env);
      const client = createRelayRedisClient(url);
      cleanups.push(() => {
        try {
          client.close();
        } catch {
          /* ignore */
        }
      });
      return { strategy: createRedisPersistenceStrategy(client, prefix) };
    }
    case "memory":
      return { strategy: createMemoryPersistenceStrategy() };
  }
}
