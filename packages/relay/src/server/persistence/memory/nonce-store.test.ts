import { describe, expect, test } from "bun:test";
import { createInMemoryNonceStore } from "./nonce-store";

describe("in-memory-nonce-store", () => {
  test("rejects duplicate while not expired", () => {
    const store = createInMemoryNonceStore();
    const nowMs = 1_000;
    const expiresAtMs = nowMs + 60_000;
    expect(store.tryInsert({ did: "did:key:a", nonce: "n1", expiresAtMs, nowMs })).toBe(true);
    expect(store.tryInsert({ did: "did:key:a", nonce: "n1", expiresAtMs, nowMs })).toBe(false);
  });

  test("allows reuse after expiry without sweep", () => {
    const store = createInMemoryNonceStore();
    expect(store.tryInsert({ did: "did:key:a", nonce: "n1", expiresAtMs: 100, nowMs: 0 })).toBe(
      true,
    );
    expect(store.tryInsert({ did: "did:key:a", nonce: "n1", expiresAtMs: 200, nowMs: 150 })).toBe(
      true,
    );
  });
});
