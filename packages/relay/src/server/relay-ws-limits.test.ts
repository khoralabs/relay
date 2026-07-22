import { describe, expect, test } from "bun:test";
import { createChannelIngressLimiter, MAX_RELAY_WS_FRAME_BYTES } from "./relay-ws-limits";

describe("relay-ws-limits", () => {
  test("MAX_RELAY_WS_FRAME_BYTES matches HTTP body cap", () => {
    expect(MAX_RELAY_WS_FRAME_BYTES).toBe(65_536);
  });

  test("ingress limiter enforces per-channel byte budget", () => {
    const limiter = createChannelIngressLimiter({
      maxBytesPerWindow: 100,
      maxFramesPerWindow: 100,
      windowMs: 60_000,
    });
    expect(limiter.tryConsume("ch-1", 60)).toBe(true);
    expect(limiter.tryConsume("ch-1", 40)).toBe(true);
    expect(limiter.tryConsume("ch-1", 1)).toBe(false);
    expect(limiter.tryConsume("ch-2", 50)).toBe(true);
  });

  test("ingress limiter enforces per-channel frame budget", () => {
    const limiter = createChannelIngressLimiter({
      maxBytesPerWindow: 1_000_000,
      maxFramesPerWindow: 2,
      windowMs: 60_000,
    });
    expect(limiter.tryConsume("ch-1", 1)).toBe(true);
    expect(limiter.tryConsume("ch-1", 1)).toBe(true);
    expect(limiter.tryConsume("ch-1", 1)).toBe(false);
  });
});
