import { describe, expect, test } from "bun:test";
import { pairingSecretKeyFromHex, TEST_PAIRING_SECRET_KEY_HEX } from "@khoralabs/relay/crypto";
import type { RelayPersistenceStrategy } from "./types";

export type PersistenceStrategyHarness = {
  strategy: RelayPersistenceStrategy;
  cleanup(): void;
};

/**
 * Shared contract for `RelayPersistenceStrategy` implementations.
 * Covers ephemeral nonce + rate-limit invariants for every strategy, and
 * durable admission/spool invariants when those factories are present.
 */
export function describePersistenceStrategyContract(
  name: string,
  open: () => PersistenceStrategyHarness,
): void {
  describe(`persistence strategy contract (${name})`, () => {
    test("nonce store accepts distinct (did, nonce) pairs and rejects live duplicates", async () => {
      const { strategy, cleanup } = open();
      try {
        const store = strategy.createNonceStore();
        expect(
          await store.tryInsert({
            did: "did:key:a",
            nonce: "n1",
            expiresAtMs: 1_000,
            nowMs: 0,
          }),
        ).toBe(true);
        expect(
          await store.tryInsert({
            did: "did:key:a",
            nonce: "n2",
            expiresAtMs: 1_000,
            nowMs: 0,
          }),
        ).toBe(true);
        expect(
          await store.tryInsert({
            did: "did:key:b",
            nonce: "n1",
            expiresAtMs: 1_000,
            nowMs: 0,
          }),
        ).toBe(true);
        expect(
          await store.tryInsert({
            did: "did:key:a",
            nonce: "n1",
            expiresAtMs: 2_000,
            nowMs: 0,
          }),
        ).toBe(false);
      } finally {
        cleanup();
      }
    });

    test("nonce store allows reuse after sweepExpired", async () => {
      const { strategy, cleanup } = open();
      try {
        const store = strategy.createNonceStore();
        expect(
          await store.tryInsert({
            did: "did:key:a",
            nonce: "n1",
            expiresAtMs: 100,
            nowMs: 0,
          }),
        ).toBe(true);
        expect(
          await store.tryInsert({
            did: "did:key:a",
            nonce: "n2",
            expiresAtMs: 300,
            nowMs: 0,
          }),
        ).toBe(true);
        expect(await store.sweepExpired(200)).toBeGreaterThanOrEqual(1);
        expect(
          await store.tryInsert({
            did: "did:key:a",
            nonce: "n1",
            expiresAtMs: 400,
            nowMs: 250,
          }),
        ).toBe(true);
        expect(
          await store.tryInsert({
            did: "did:key:a",
            nonce: "n2",
            expiresAtMs: 400,
            nowMs: 250,
          }),
        ).toBe(false);
      } finally {
        cleanup();
      }
    });

    test("rate limiter null rule always allows", async () => {
      const { strategy, cleanup } = open();
      try {
        const limiter = strategy.createRateLimiter(null);
        expect((await limiter("any")).ok).toBe(true);
        expect((await limiter("any")).ok).toBe(true);
      } finally {
        cleanup();
      }
    });

    test("rate limiter enforces max per key within window", async () => {
      const { strategy, cleanup } = open();
      try {
        const limiter = strategy.createRateLimiter({ windowMs: 60_000, max: 2 });
        expect((await limiter("user-1")).ok).toBe(true);
        expect((await limiter("user-1")).ok).toBe(true);
        const blocked = await limiter("user-1");
        expect(blocked.ok).toBe(false);
        if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
        expect((await limiter("user-2")).ok).toBe(true);
      } finally {
        cleanup();
      }
    });

    test("durable factories expose admission + spool when present", async () => {
      const { strategy, cleanup } = open();
      try {
        const hasDurable =
          strategy.createAdmissionStore !== undefined &&
          strategy.createBlobSpool !== undefined &&
          strategy.createChannelRegistry !== undefined;
        if (!hasDurable) {
          expect(strategy.createAdmissionStore).toBeUndefined();
          expect(strategy.createBlobSpool).toBeUndefined();
          expect(strategy.createChannelRegistry).toBeUndefined();
          return;
        }

        const key = pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX);
        const secretHex = "deadbeef".repeat(8);
        const admission = strategy.createAdmissionStore?.(key);
        const spool = strategy.createBlobSpool?.();
        const now = 1_000_000;

        admission.upsertChannelAdmission({
          channelId: "ch-1",
          pairingSecretHex: secretHex,
          createdAtMs: now,
          expiresAtMs: now + 60_000,
        });
        const row = admission.getChannelAdmissionIfActive("ch-1", now + 1);
        expect(row?.pairingSecretHex).toBe(secretHex);
        expect(row?.expiresAtMs).toBe(now + 60_000);

        admission.upsertChannelAdmission({
          channelId: "ch-exp",
          pairingSecretHex: secretHex,
          createdAtMs: now,
          expiresAtMs: now + 1000,
        });
        expect(admission.getChannelAdmissionIfActive("ch-exp", now + 1001)).toBeUndefined();

        admission.upsertChannelAdmission({
          channelId: "old",
          pairingSecretHex: secretHex,
          createdAtMs: now,
          expiresAtMs: now + 100,
        });
        admission.upsertChannelAdmission({
          channelId: "new",
          pairingSecretHex: secretHex,
          createdAtMs: now,
          expiresAtMs: now + 60_000,
        });
        expect(admission.purgeExpiredChannels(now + 200)).toBe(1);
        expect(admission.getChannelAdmissionIfActive("old", now + 200)).toBeUndefined();
        expect(admission.getChannelAdmissionIfActive("new", now + 200)?.channelId).toBe("new");

        const blob = new TextEncoder().encode("hello");
        const id = spool.append("ch-spool", blob, now);
        expect(id).toBeGreaterThan(0);
        const after = spool.getBlobsAfter("ch-spool", 0);
        expect(after).toHaveLength(1);
        expect(after[0]?.id).toBe(id);
        expect(after[0]?.blob).toEqual(blob);
        expect(spool.getMaxId("ch-spool")).toBe(id);
        spool.purgeChannel("ch-spool");
        expect(spool.getBlobsAfter("ch-spool", 0)).toHaveLength(0);
        expect(spool.getMaxId("ch-spool")).toBeUndefined();
      } finally {
        cleanup();
      }
    });
  });
}
