import {
  AGENT_REQUEST_FRESHNESS_WINDOW_MS,
  AGENT_REQUEST_HEADER,
  type AgentRequestEnvelope,
  canonicalAgentRequestMessage,
  canonicalAgentRequestPath,
  envelopeSignatureBytes,
  parseAgentRequestEnvelopeFromHeaders,
} from "@khoralabs/relay-contracts";
import { ed25519PublicKeyBytesFromDid } from "@khoralabs/relay-crypto";
import { verifyAsync } from "@noble/ed25519";
import { createInMemoryNonceStore } from "./in-memory-nonce-store";
import type { NonceStore } from "./nonce-store";

export { AGENT_REQUEST_HEADER };

export const MAX_AGENT_REQUEST_BODY_BYTES = 65_536;
export const MAX_CHANNEL_TTL_MS = 7 * 86_400_000;
export const DEFAULT_NONCE_SWEEP_INTERVAL_MS = 60_000;

export class AuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function ed25519PublicKeyFromDid(did: string): Uint8Array {
  try {
    return ed25519PublicKeyBytesFromDid(did);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("agent DID public key parse failed:", detail);
    throw new AuthError("invalid agent DID", 401);
  }
}

export type RelayAuth = ReturnType<typeof createRelayAuth>;

export function createRelayAuth(opts?: {
  now?: () => number;
  freshnessWindowMs?: number;
  nonceStore?: NonceStore;
  sweepIntervalMs?: number;
}) {
  const now = opts?.now ?? (() => Date.now());
  const freshnessWindowMs = opts?.freshnessWindowMs ?? AGENT_REQUEST_FRESHNESS_WINDOW_MS;
  const nonceStore = opts?.nonceStore ?? createInMemoryNonceStore();
  const sweepIntervalMs = opts?.sweepIntervalMs ?? DEFAULT_NONCE_SWEEP_INTERVAL_MS;
  let lastSweepMs = 0;

  async function maybeSweep(t: number): Promise<void> {
    if (t - lastSweepMs < sweepIntervalMs) return;
    lastSweepMs = t;
    await nonceStore.sweepExpired(t);
  }

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
    await maybeSweep(t);
    const inserted = await nonceStore.tryInsert({
      did: envelope.did,
      nonce: envelope.nonce,
      expiresAtMs: envelope.timestampMs + freshnessWindowMs,
      nowMs: t,
    });
    if (!inserted) {
      throw new AuthError("agent request nonce reuse", 401);
    }
    return { did };
  }

  return { requireAuthenticatedRequest, nonceStore };
}
