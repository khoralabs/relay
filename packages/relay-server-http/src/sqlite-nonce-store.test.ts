import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { ensureRelayStateSchema } from "./relay-state-schema";
import { createSqliteNonceStore } from "./sqlite-nonce-store";

function openDb(): Database {
  const db = new Database(":memory:");
  ensureRelayStateSchema(db);
  return db;
}

describe("sqlite-nonce-store", () => {
  test("inserts unique (did, nonce) pairs", () => {
    const store = createSqliteNonceStore(openDb());
    expect(store.tryInsert({ did: "did:key:a", nonce: "n1", expiresAtMs: 1_000, nowMs: 0 })).toBe(
      true,
    );
    expect(store.tryInsert({ did: "did:key:a", nonce: "n2", expiresAtMs: 1_000, nowMs: 0 })).toBe(
      true,
    );
    expect(store.tryInsert({ did: "did:key:b", nonce: "n1", expiresAtMs: 1_000, nowMs: 0 })).toBe(
      true,
    );
  });

  test("rejects duplicate (did, nonce)", () => {
    const store = createSqliteNonceStore(openDb());
    expect(store.tryInsert({ did: "did:key:a", nonce: "n1", expiresAtMs: 1_000, nowMs: 0 })).toBe(
      true,
    );
    expect(store.tryInsert({ did: "did:key:a", nonce: "n1", expiresAtMs: 2_000, nowMs: 0 })).toBe(
      false,
    );
  });

  test("sweepExpired removes stale rows", () => {
    const store = createSqliteNonceStore(openDb());
    store.tryInsert({ did: "did:key:a", nonce: "n1", expiresAtMs: 100, nowMs: 0 });
    store.tryInsert({ did: "did:key:a", nonce: "n2", expiresAtMs: 300, nowMs: 0 });
    expect(store.sweepExpired(200)).toBe(1);
    expect(store.tryInsert({ did: "did:key:a", nonce: "n1", expiresAtMs: 400, nowMs: 250 })).toBe(
      true,
    );
    expect(store.tryInsert({ did: "did:key:a", nonce: "n2", expiresAtMs: 400, nowMs: 250 })).toBe(
      false,
    );
  });
});
