import { describe, expect, test } from "bun:test";

import { decodeRelayMlsEnvelope, encodeRelayMlsEnvelope } from "./relay-mls-envelope";

describe("relay-mls-envelope", () => {
  test("round-trip mls1 envelope", () => {
    const payload = new TextEncoder().encode("hello");
    const wire = encodeRelayMlsEnvelope("session-1", payload);
    const decoded = decodeRelayMlsEnvelope(wire);
    expect(decoded?.groupId).toBe("session-1");
    expect(decoded?.payload).toEqual(payload);
  });

  test("non-mls1 envelope returns undefined", () => {
    const wire = new TextEncoder().encode(
      JSON.stringify({ v: "plain1", groupId: "x", payload: "a" }),
    );
    expect(decodeRelayMlsEnvelope(wire)).toBeUndefined();
  });
});
