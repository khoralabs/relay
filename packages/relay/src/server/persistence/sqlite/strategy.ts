import type { Database } from "bun:sqlite";
import type { RelayPersistenceStrategy } from "../core/types";
import { createChannelAdmissionStore } from "./admission";
import { createBlobSpool } from "./blob-spool";
import { createSqliteNonceStore } from "./nonce-store";
import { createSqliteRateLimiter } from "./rate-limiter";
import { createChannelRegistry } from "./registry";

export function createSqlitePersistenceStrategy(db: Database): RelayPersistenceStrategy {
  return {
    kind: "sqlite",
    createNonceStore: () => createSqliteNonceStore(db),
    createRateLimiter: (rule) => {
      if (rule === null) return () => ({ ok: true });
      return createSqliteRateLimiter(db, rule);
    },
    createAdmissionStore: (key) => createChannelAdmissionStore(db, key),
    createBlobSpool: () => createBlobSpool(db),
    createChannelRegistry: () => createChannelRegistry(db),
  };
}
