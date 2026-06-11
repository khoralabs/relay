import { describe, expect, test } from "bun:test";
import { RELAY_WS_NONCE_PREFIX, relayWsUpgradeProtocol } from "@khoralabs/relay-contracts";
import {
  hashWsUpgradeNonce,
  wsUpgradeNonceFromProtocolHeader,
  wsUpgradeNonceFromRequest,
} from "./ws-upgrade-nonce";

describe("ws-upgrade-nonce", () => {
  test("hashWsUpgradeNonce is stable", () => {
    const nonce = "abc123";
    expect(hashWsUpgradeNonce(nonce)).toBe(hashWsUpgradeNonce(nonce));
    expect(hashWsUpgradeNonce(nonce)).toMatch(/^[0-9a-f]{64}$/);
  });

  test("wsUpgradeNonceFromProtocolHeader parses subprotocol", () => {
    const nonce = "n-once-value";
    const header = `other, ${relayWsUpgradeProtocol(nonce)}, foo`;
    expect(wsUpgradeNonceFromProtocolHeader(header)).toBe(nonce);
    expect(wsUpgradeNonceFromProtocolHeader(`${RELAY_WS_NONCE_PREFIX}`)).toBeUndefined();
    expect(wsUpgradeNonceFromProtocolHeader(null)).toBeUndefined();
  });

  test("wsUpgradeNonceFromRequest prefers X-Relay-Upgrade-Nonce header", () => {
    const headerNonce = "from-header";
    const protocolNonce = "from-protocol";
    const req = new Request("https://relay.test/v1/channels/ch/ws", {
      headers: {
        "X-Relay-Upgrade-Nonce": headerNonce,
        "Sec-WebSocket-Protocol": relayWsUpgradeProtocol(protocolNonce),
      },
    });
    expect(wsUpgradeNonceFromRequest(req)).toBe(headerNonce);
  });

  test("wsUpgradeNonceFromRequest falls back to Sec-WebSocket-Protocol", () => {
    const protocolNonce = "proto-only";
    const req = new Request("https://relay.test/v1/channels/ch/ws", {
      headers: {
        "Sec-WebSocket-Protocol": relayWsUpgradeProtocol(protocolNonce),
      },
    });
    expect(wsUpgradeNonceFromRequest(req)).toBe(protocolNonce);
  });
});
