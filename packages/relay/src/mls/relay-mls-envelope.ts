import { type MlsHubEnvelope, RELAY_MLS_ENVELOPE_VERSION } from "@khoralabs/relay/contracts";
import { base64UrlToBytes, bytesToBase64Url } from "@khoralabs/relay/crypto";

export type DecodedRelayMlsEnvelope = {
  v: typeof RELAY_MLS_ENVELOPE_VERSION;
  route: string;
  payload: Uint8Array;
};

/** Random opaque bus route (16 bytes, base64url). Not derived from session_id. */
export function generateRouteHandle(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function encodeRelayMlsEnvelope(route: string, payload: Uint8Array): Uint8Array {
  const wire: MlsHubEnvelope = {
    v: RELAY_MLS_ENVELOPE_VERSION,
    route,
    payload: bytesToBase64Url(payload),
  };
  return new TextEncoder().encode(JSON.stringify(wire));
}

export function decodeRelayMlsEnvelope(bytes: Uint8Array): DecodedRelayMlsEnvelope | undefined {
  try {
    const text = new TextDecoder().decode(bytes);
    const j = JSON.parse(text) as unknown;
    if (typeof j !== "object" || j === null) return undefined;
    const o = j as Record<string, unknown>;
    if (o.v !== RELAY_MLS_ENVELOPE_VERSION) return undefined;
    if (typeof o.route !== "string" || o.route.length === 0) return undefined;
    if (typeof o.payload !== "string" || o.payload.length === 0) return undefined;
    return {
      v: RELAY_MLS_ENVELOPE_VERSION,
      route: o.route,
      payload: base64UrlToBytes(o.payload),
    };
  } catch {
    return undefined;
  }
}
