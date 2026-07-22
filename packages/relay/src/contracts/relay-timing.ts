import { base64UrlToBytes, bytesToBase64Url } from "@khoralabs/relay/crypto";
import type { RelayHlcTimestamp } from "./relay-hlc";

export const RELAY_TIMING_FRAME_VERSION = "rt1" as const;

export type RelayClockObservation = {
  p_hash: string;
  peer_actor: string;
  peer_pt: number;
  recv_ms: number;
};

export type RelayTimingFrame = {
  v: typeof RELAY_TIMING_FRAME_VERSION;
  hlc: RelayHlcTimestamp;
  observed?: RelayClockObservation;
  body: string;
};

export function encodeRelayTimingFrame(frame: Omit<RelayTimingFrame, "v">): Uint8Array {
  const wire: RelayTimingFrame = { v: RELAY_TIMING_FRAME_VERSION, ...frame };
  return new TextEncoder().encode(JSON.stringify(wire));
}

export type DecodedRelayTimingFrame = {
  hlc: RelayHlcTimestamp;
  observed?: RelayClockObservation;
  body: Uint8Array;
};

export function decodeRelayTimingFrame(bytes: Uint8Array): DecodedRelayTimingFrame | undefined {
  try {
    const text = new TextDecoder().decode(bytes);
    const j = JSON.parse(text) as unknown;
    if (typeof j !== "object" || j === null) return undefined;
    const o = j as Record<string, unknown>;
    if (o.v !== RELAY_TIMING_FRAME_VERSION) return undefined;
    const hlcRaw = o.hlc;
    if (typeof hlcRaw !== "object" || hlcRaw === null) return undefined;
    const h = hlcRaw as Record<string, unknown>;
    const pt = h.pt;
    const lc = h.lc;
    if (typeof pt !== "number" || !Number.isFinite(pt) || pt < 0) return undefined;
    if (typeof lc !== "number" || !Number.isFinite(lc) || lc < 0 || !Number.isInteger(lc)) {
      return undefined;
    }
    if (typeof o.body !== "string" || o.body.length === 0) return undefined;
    let observed: RelayClockObservation | undefined;
    if (o.observed !== undefined && o.observed !== null) {
      const obs = o.observed as Record<string, unknown>;
      if (
        typeof obs.p_hash === "string" &&
        typeof obs.peer_actor === "string" &&
        typeof obs.peer_pt === "number" &&
        typeof obs.recv_ms === "number"
      ) {
        observed = {
          p_hash: obs.p_hash,
          peer_actor: obs.peer_actor,
          peer_pt: obs.peer_pt,
          recv_ms: obs.recv_ms,
        };
      }
    }
    return {
      hlc: { pt, lc },
      body: base64UrlToBytes(o.body),
      ...(observed !== undefined ? { observed } : {}),
    };
  } catch {
    return undefined;
  }
}

export function encodeRelayTimingBody(body: Uint8Array): string {
  return bytesToBase64Url(body);
}
