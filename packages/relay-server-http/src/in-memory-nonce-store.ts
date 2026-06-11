import type { NonceStore } from "./nonce-store";

type NonceEntry = { expiresAtMs: number };

/** Dev/test fallback — lazy expiry on insert; optional periodic sweep. */
export function createInMemoryNonceStore(): NonceStore {
  const seen = new Map<string, NonceEntry>();
  return {
    tryInsert(p) {
      const key = `${p.did}\0${p.nonce}`;
      const existing = seen.get(key);
      if (existing !== undefined && existing.expiresAtMs > p.nowMs) {
        return false;
      }
      seen.set(key, { expiresAtMs: p.expiresAtMs });
      return true;
    },
    sweepExpired(nowMs) {
      let removed = 0;
      for (const [k, v] of seen) {
        if (v.expiresAtMs <= nowMs) {
          seen.delete(k);
          removed += 1;
        }
      }
      return removed;
    },
  };
}
