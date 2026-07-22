import { describe, expect, test } from "bun:test";
import {
  AGENT_REQUEST_HEADER,
  parseAgentRequestEnvelopeFromHeaders,
  parseAgentRequestEnvelopeFromSearch,
  signatureBytesToB64Url,
} from "./auth-wire";

function envelopeHeaders(ts: string): Headers {
  const headers = new Headers();
  headers.set(AGENT_REQUEST_HEADER.did, "did:key:abc");
  headers.set(AGENT_REQUEST_HEADER.ts, ts);
  headers.set(AGENT_REQUEST_HEADER.nonce, "nonce-xyz");
  headers.set(AGENT_REQUEST_HEADER.sig, signatureBytesToB64Url(new Uint8Array([1, 2, 3])));
  return headers;
}

describe("parseAgentRequestEnvelope", () => {
  test("accepts all-digit timestamps", () => {
    const env = parseAgentRequestEnvelopeFromHeaders(envelopeHeaders("1700000000000"));
    expect(env?.timestampMs).toBe(1700000000000);
  });

  test("rejects timestamps with trailing junk", () => {
    expect(parseAgentRequestEnvelopeFromHeaders(envelopeHeaders("123abc"))).toBeUndefined();
  });

  test("rejects timestamps with embedded whitespace", () => {
    const sp = new URLSearchParams({
      did: "did:key:abc",
      ts: "1700 000000000",
      nonce: "n",
      sig: "AAA",
    });
    expect(parseAgentRequestEnvelopeFromSearch(sp)).toBeUndefined();
  });

  test("rejects negative-looking timestamps", () => {
    expect(parseAgentRequestEnvelopeFromHeaders(envelopeHeaders("-1"))).toBeUndefined();
  });

  test("search params use the same timestamp rules", () => {
    const sp = new URLSearchParams({
      did: "did:key:abc",
      ts: "123abc",
      nonce: "n",
      sig: "AAA",
    });
    expect(parseAgentRequestEnvelopeFromSearch(sp)).toBeUndefined();
  });
});
