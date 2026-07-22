import { afterEach, describe, expect, mock, test } from "bun:test";
import type { RelaySigner } from "@khoralabs/relay/contracts";
import { KeyPackageManager } from "./key-package-manager";

const signer = {} as RelaySigner;
const ed25519PrivateKey = new Uint8Array(32);

function createManager() {
  return new KeyPackageManager({
    relayBaseUrl: "http://localhost:59156",
    signer,
    myDid: "did:key:z6Mktest",
    ed25519PrivateKey,
  });
}

describe("KeyPackageManager auto-replenish", () => {
  afterEach(() => {
    mock.restore();
  });

  test("gives up after max consecutive failures with backoff", async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((
      fn: (...args: unknown[]) => void,
      delay?: number,
      ...args: unknown[]
    ) => {
      if (typeof delay === "number") delays.push(delay);
      return originalSetTimeout(fn, 0, ...args);
    }) as typeof setTimeout;

    let giveUpAttempts = 0;
    let giveUpError: unknown;
    const kpm = createManager();
    let ticks = 0;
    kpm.replenishIfNeeded = mock(() => {
      ticks++;
      return Promise.reject(
        Object.assign(new Error("ConnectionRefused"), { code: "ConnectionRefused" }),
      );
    });

    kpm.startAutoReplenish({
      maxConsecutiveFailures: 3,
      backoffBaseMs: 1_000,
      intervalMs: 60_000,
      onGiveUp: (error, attempts) => {
        giveUpError = error;
        giveUpAttempts = attempts;
      },
    });

    await Bun.sleep(50);
    kpm.stopAutoReplenish();
    globalThis.setTimeout = originalSetTimeout;

    expect(ticks).toBeGreaterThanOrEqual(3);
    expect(giveUpAttempts).toBe(3);
    expect(giveUpError).toBeDefined();
    expect(delays).toEqual([1_000, 2_000]);
  });

  test("resets failure count after a successful tick", async () => {
    let calls = 0;
    let giveUpCalled = false;
    const kpm = createManager();
    kpm.replenishIfNeeded = mock(() => {
      calls++;
      if (calls <= 2) return Promise.reject(new Error("temporary"));
      return Promise.resolve();
    });

    kpm.startAutoReplenish({
      maxConsecutiveFailures: 3,
      backoffBaseMs: 1,
      intervalMs: 60_000,
      onGiveUp: () => {
        giveUpCalled = true;
      },
    });

    await Bun.sleep(50);
    kpm.stopAutoReplenish();

    expect(giveUpCalled).toBe(false);
    expect(calls).toBeGreaterThanOrEqual(3);
  });
});
