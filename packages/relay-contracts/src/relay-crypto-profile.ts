/**
 * MLS hub transport profile (integration constants).
 *
 * Cryptography: RFC 9420 (MLS), ciphersuite 0x0001. HPKE: RFC 9180. Credentials: RFC 8032.
 * Wire envelope matches `khora.obp.frame.mls#MlsHubEnvelope` (`mls1` profile version label).
 *
 * Two integration APIs — no in-band negotiation:
 * - MLS-wrapped byte stream (hub-stamped `mls1` envelopes).
 * - Plaintext byte stream (custodial).
 */

export const RELAY_MLS_CIPHERSUITE_NAME = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519" as const;

/** Profile version label for `khora.obp.frame.mls#MlsHubEnvelope`. */
export const RELAY_MLS_ENVELOPE_VERSION = "mls1" as const;

/** MLS outer envelope on the blob bus. */
export type MlsHubEnvelopeV1 = {
  v: typeof RELAY_MLS_ENVELOPE_VERSION;
  groupId: string;
  /** Base64url RFC 9420 MLS wire bytes. */
  payload: string;
};

/** @deprecated Use `MlsHubEnvelopeV1`. */
export type RelayMlsEnvelopeV1 = MlsHubEnvelopeV1;
