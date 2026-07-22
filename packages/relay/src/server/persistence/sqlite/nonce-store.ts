import type { Database } from "bun:sqlite";
import type { NonceStore } from "../../nonce-store";
import { ensureRelayStateSchema } from "./state-schema";

export function createSqliteNonceStore(db: Database): NonceStore {
  let initialized = false;
  function init(): void {
    if (initialized) return;
    ensureRelayStateSchema(db);
    initialized = true;
  }
  return {
    tryInsert(p) {
      init();
      try {
        db.prepare(
          "INSERT INTO agent_request_nonces (did, nonce, expires_at_ms) VALUES (?, ?, ?)",
        ).run(p.did, p.nonce, p.expiresAtMs);
        return true;
      } catch {
        return false;
      }
    },
    sweepExpired(nowMs) {
      init();
      const res = db
        .prepare("DELETE FROM agent_request_nonces WHERE expires_at_ms <= ?")
        .run(nowMs);
      return Number(res.changes ?? 0);
    },
  };
}
