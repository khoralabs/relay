import { describe, expect, test } from "bun:test";
import { RELAY_MLS_ENVELOPE_VERSION } from "@khoralabs/relay/contracts";

import {
  decodeRelayMlsEnvelope,
  encodeRelayMlsEnvelope,
  generateRouteHandle,
} from "./relay-mls-envelope";

describe("relay-mls-envelope", () => {
  test("mls2 round-trip with opaque route", () => {
    const payload = new TextEncoder().encode("hello");
    const route = generateRouteHandle();
    const wire = encodeRelayMlsEnvelope(route, payload);
    const decoded = decodeRelayMlsEnvelope(wire);
    expect(decoded?.v).toBe(RELAY_MLS_ENVELOPE_VERSION);
    expect(decoded?.route).toBe(route);
    expect(decoded?.payload).toEqual(payload);
  });

  test("unknown profile returns undefined", () => {
    const wire = new TextEncoder().encode(
      JSON.stringify({ v: "mls1", groupId: "x", payload: "a" }),
    );
    expect(decodeRelayMlsEnvelope(wire)).toBeUndefined();
  });
});
