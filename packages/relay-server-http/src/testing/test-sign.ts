import {
  AGENT_REQUEST_HEADER,
  canonicalAgentRequestMessage,
  canonicalAgentRequestPath,
} from "@khoralabs/relay-contracts";
import { base58Encode, bytesToBase64Url } from "@khoralabs/relay-crypto";
import { signAsync } from "@noble/ed25519";

export function didKeyFromPublicKey(pubKey: Uint8Array): string {
  const prefixed = new Uint8Array(2 + pubKey.length);
  prefixed[0] = 0xed;
  prefixed[1] = 0x01;
  prefixed.set(pubKey, 2);
  return `did:key:z${base58Encode(prefixed)}`;
}

export async function createTestAgent() {
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);
  const { getPublicKeyAsync } = await import("@noble/ed25519");
  const publicKey = await getPublicKeyAsync(privateKey);
  const did = didKeyFromPublicKey(publicKey);
  return { did, privateKey, publicKey };
}

export async function signedFetch(
  baseUrl: string,
  input: {
    method: string;
    path: string;
    bodyText?: string;
    privateKey: Uint8Array;
    did: string;
    now?: () => number;
  },
): Promise<Response> {
  const bodyText = input.bodyText ?? "";
  const timestampMs = (input.now ?? Date.now)();
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = bytesToBase64Url(nonceBytes);
  const message = await canonicalAgentRequestMessage({
    method: input.method,
    path: input.path,
    timestampMs,
    nonce,
    bodyText,
  });
  const sig = await signAsync(message, input.privateKey);
  const url = new URL(input.path, baseUrl);
  return fetch(url, {
    method: input.method,
    headers: {
      "content-type": "application/json",
      [AGENT_REQUEST_HEADER.did]: input.did,
      [AGENT_REQUEST_HEADER.ts]: String(timestampMs),
      [AGENT_REQUEST_HEADER.nonce]: nonce,
      [AGENT_REQUEST_HEADER.sig]: bytesToBase64Url(sig),
    },
    body: bodyText.length > 0 ? bodyText : undefined,
  });
}

export function signedPath(pathname: string): string {
  return canonicalAgentRequestPath(pathname, new URLSearchParams(), []);
}
