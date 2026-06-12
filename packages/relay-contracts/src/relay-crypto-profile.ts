/**
 * Normative relay crypto profile (v1).
 *
 * Two APIs — no in-band negotiation:
 * - `MlsChannelConnection` (@khoralabs/relay-mls): always MLS (`mls1` envelopes).
 * - `connectRelay` (@khoralabs/relay-client): always plaintext bytes.
 *
 * Ciphersuite is a library constant, not negotiated on the wire.
 */

export const RELAY_MLS_CIPHERSUITE_NAME = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519" as const;

export const RELAY_MLS_ENVELOPE_VERSION = "mls1" as const;

export type RelayMlsEnvelopeV1 = {
  v: typeof RELAY_MLS_ENVELOPE_VERSION;
  groupId: string;
  payload: string;
};
