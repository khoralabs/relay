import { describe, expect, test } from "bun:test";
import { bytesToBase64Url } from "@khoralabs/relay/crypto";
import { decodeRelayTimingFrame, encodeRelayTimingFrame } from "./relay-timing";
import { withTiming } from "./relay-timing-layer";

describe("relay timing", () => {
  test("encode/decode round-trip", () => {
    const body = new TextEncoder().encode("payload");
    const frame = encodeRelayTimingFrame({
      hlc: { pt: 100, lc: 1 },
      body: bytesToBase64Url(body),
    });
    const decoded = decodeRelayTimingFrame(frame);
    expect(decoded?.hlc).toEqual({ pt: 100, lc: 1 });
    expect(decoded?.body).toEqual(body);
  });

  test("withTiming send/handleFrame", () => {
    const sent: Uint8Array[] = [];
    const received: Uint8Array[] = [];
    const layer = withTiming({
      nodeId: "a",
      innerSend: (f) => sent.push(f),
      onBody: (b) => received.push(b),
    });
    const payload = new TextEncoder().encode("mux");
    layer.send(payload);
    expect(sent).toHaveLength(1);
    const wire = sent[0];
    if (!wire) throw new Error("expected timing wire frame");
    layer.handleFrame(wire);
    expect(received[0]).toEqual(payload);
    expect(layer.timingContext.getCurrentHlc().pt).toBeGreaterThan(0);
  });
});
