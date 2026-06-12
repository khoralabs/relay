import { RELAY_MLS_ENVELOPE_VERSION, type RelayMlsEnvelopeV1 } from "@khoralabs/relay-contracts";
import { base64UrlToBytes, bytesToBase64Url } from "@khoralabs/relay-crypto";

export type DecodedRelayMlsEnvelope = {
  v: typeof RELAY_MLS_ENVELOPE_VERSION;
  groupId: string;
  payload: Uint8Array;
};

export function encodeRelayMlsEnvelope(groupId: string, payload: Uint8Array): Uint8Array {
  const wire: RelayMlsEnvelopeV1 = {
    v: RELAY_MLS_ENVELOPE_VERSION,
    groupId,
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
    if (typeof o.groupId !== "string" || o.groupId.length === 0) return undefined;
    if (typeof o.payload !== "string" || o.payload.length === 0) return undefined;
    return {
      v: RELAY_MLS_ENVELOPE_VERSION,
      groupId: o.groupId,
      payload: base64UrlToBytes(o.payload),
    };
  } catch {
    return undefined;
  }
}
