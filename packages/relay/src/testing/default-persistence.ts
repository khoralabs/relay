import {
  DEV_SQLCIPHER_KEY,
  openRelayPersistence,
  type RelayPersistence,
  sqliteBackend,
} from "../server";

/**
 * Private default for `createTestRelayApp` when no persistence is injected.
 * Kept out of the public testing surface so callers stay strategy-agnostic.
 */
export function createDefaultTestPersistence(env: NodeJS.ProcessEnv = process.env): {
  persistence: RelayPersistence;
  cleanup(): void;
} {
  return openRelayPersistence({
    durable: sqliteBackend({ path: ":memory:", key: DEV_SQLCIPHER_KEY }),
    env,
  });
}
