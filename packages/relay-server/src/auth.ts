import {
  AGENT_REQUEST_FRESHNESS_WINDOW_MS,
  AGENT_REQUEST_HEADER,
  type AgentRequestEnvelope,
  canonicalAgentRequestMessage,
  canonicalAgentRequestPath,
  envelopeSignatureBytes,
  parseAgentRequestEnvelopeFromHeaders,
} from "@khoralabs/relay-contracts";
import { verifyAsync } from "@noble/ed25519";
import { LRUCache } from "lru-cache";

export { AGENT_REQUEST_HEADER };

export const MAX_AGENT_REQUEST_BODY_BYTES = 65_536;
export const MAX_CHANNEL_TTL_MS = 7 * 86_400_000;

export class AuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(input: string): Uint8Array {
  const bytes: number[] = [0];
  for (const ch of input) {
    const val = BASE58_ALPHABET.indexOf(ch);
    if (val < 0) throw new Error("invalid base58");
    let carry = val;
    for (let j = 0; j < bytes.length; j++) {
      const n = (bytes[j] as number) * 58 + carry;
      bytes[j] = n % 256;
      carry = Math.floor(n / 256);
    }
    while (carry > 0) {
      bytes.push(carry % 256);
      carry = Math.floor(carry / 256);
    }
  }
  let zeros = 0;
  for (const ch of input) {
    if (ch === "1") zeros++;
    else break;
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[out.length - 1 - i] = bytes[i] as number;
  }
  return out;
}

const pubKeyCache = new LRUCache<string, Uint8Array>({ max: 512 });

function ed25519PublicKeyFromDid(did: string): Uint8Array {
  const cached = pubKeyCache.get(did);
  if (cached !== undefined) return cached;
  const didKeyPrefix = "did:key:";
  if (!did.startsWith(didKeyPrefix)) {
    throw new AuthError(`unsupported DID: ${did}`, 401);
  }
  const multibase = did.slice(didKeyPrefix.length);
  if (!multibase.startsWith("z")) {
    throw new AuthError(`unsupported DID multibase: ${did}`, 401);
  }
  const decoded = base58Decode(multibase.slice(1));
  if (decoded.length !== 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new AuthError(`unsupported did:key multicodec: ${did}`, 401);
  }
  const pubKey = decoded.slice(2);
  pubKeyCache.set(did, pubKey);
  return pubKey;
}

type NonceEntry = { expiresAtMs: number };

export function createInMemoryNonceStore() {
  const seen = new Map<string, NonceEntry>();
  return {
    tryInsert(entry: { did: string; nonce: string; expiresAtMs: number }): boolean {
      const key = `${entry.did}\0${entry.nonce}`;
      if (seen.has(key)) return false;
      seen.set(key, { expiresAtMs: entry.expiresAtMs });
      return true;
    },
    sweepExpired(nowMs: number): void {
      for (const [k, v] of seen) {
        if (v.expiresAtMs <= nowMs) seen.delete(k);
      }
    },
  };
}

export type RelayAuth = ReturnType<typeof createRelayAuth>;

export function createRelayAuth(opts?: { now?: () => number; freshnessWindowMs?: number }) {
  const now = opts?.now ?? (() => Date.now());
  const freshnessWindowMs = opts?.freshnessWindowMs ?? AGENT_REQUEST_FRESHNESS_WINDOW_MS;
  const nonceStore = createInMemoryNonceStore();

  async function requireAuthenticatedRequest(
    req: Request,
    url: URL,
    bodyText = "",
    signedQueryKeys: readonly string[] = [],
  ): Promise<{ did: string }> {
    const did = req.headers.get(AGENT_REQUEST_HEADER.did)?.trim();
    if (did === undefined || did.length === 0) {
      throw new AuthError(`${AGENT_REQUEST_HEADER.did} header required`, 400);
    }
    const envelope: AgentRequestEnvelope | undefined = parseAgentRequestEnvelopeFromHeaders(
      req.headers,
    );
    if (envelope === undefined) {
      throw new AuthError("missing agent request signature", 401);
    }
    if (envelope.did !== did) {
      throw new AuthError("agent DID mismatch", 401);
    }
    const t = now();
    if (Math.abs(t - envelope.timestampMs) > freshnessWindowMs) {
      throw new AuthError("agent request timestamp out of window", 401);
    }
    const path = canonicalAgentRequestPath(url.pathname, url.searchParams, signedQueryKeys);
    const message = await canonicalAgentRequestMessage({
      method: req.method,
      path,
      timestampMs: envelope.timestampMs,
      nonce: envelope.nonce,
      bodyText,
    });
    const pubKey = ed25519PublicKeyFromDid(envelope.did);
    const ok = await verifyAsync(envelopeSignatureBytes(envelope), message, pubKey);
    if (!ok) {
      throw new AuthError("agent request signature invalid", 401);
    }
    nonceStore.sweepExpired(t);
    const inserted = nonceStore.tryInsert({
      did: envelope.did,
      nonce: envelope.nonce,
      expiresAtMs: envelope.timestampMs + freshnessWindowMs,
    });
    if (!inserted) {
      throw new AuthError("agent request nonce reuse", 401);
    }
    return { did };
  }

  return { requireAuthenticatedRequest, nonceStore };
}
