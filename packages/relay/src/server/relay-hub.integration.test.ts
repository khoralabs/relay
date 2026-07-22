import { describe, expect, test } from "bun:test";
import { openRelayPersistence, sqliteBackend } from "./persistence";
import { createRelayHub } from "./relay-hub";

describe("createRelayHub opaque relay", () => {
  test("echoes same bytes to sender and peer", async () => {
    const { persistence, cleanup } = openRelayPersistence({
      durable: sqliteBackend({ path: ":memory:" }),
    });
    const hub = createRelayHub({ admission: persistence.admission, spool: persistence.spool });
    const receivedA: Uint8Array[] = [];
    const receivedB: Uint8Array[] = [];
    const peerA = { send: (b: Uint8Array) => receivedA.push(b) };
    const peerB = { send: (b: Uint8Array) => receivedB.push(b) };
    const { ticket } = await hub.createChannel("ch-stamp");
    await hub.attachPeer("ch-stamp", peerA, ticket);
    await hub.attachPeer("ch-stamp", peerB, ticket);
    const inbound = new TextEncoder().encode(
      JSON.stringify({ v: "mls2", route: "opaque-route", payload: "YWJj" }),
    );
    hub.relayBytes("ch-stamp", peerA, inbound);
    expect(receivedA.length).toBe(1);
    expect(receivedB.length).toBe(1);
    expect(receivedA[0]).toEqual(inbound);
    expect(receivedB[0]).toEqual(inbound);
    cleanup();
  });
});
