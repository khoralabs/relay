/**
 * MLS hub transport profile (integration constants).
 *
 * Cryptography: RFC 9420 (MLS), ciphersuite 0x0001. HPKE: RFC 9180. Credentials: RFC 8032.
 * Wire envelope matches `khora.obp.frame.mls#MlsHubEnvelope`.
 *
 * Two integration APIs — no in-band negotiation:
 * - MLS-wrapped byte stream (hub-stamped `mls2` envelopes with opaque route).
 * - Plaintext byte stream (custodial).
 */

export const RELAY_MLS_CIPHERSUITE_NAME = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519" as const;

/** RFC 9420 ciphersuite identifier for {@link RELAY_MLS_CIPHERSUITE_NAME}. */
export const RELAY_MLS_CIPHERSUITE_ID = 0x0001 as const;

/** MLS outer envelope version on the blob bus. */
export const RELAY_MLS_ENVELOPE_VERSION = "mls2" as const;

/** MLS outer envelope on the blob bus (opaque route; session_id only on DID-signed Welcome HTTP). */
export type MlsHubEnvelope = {
  v: typeof RELAY_MLS_ENVELOPE_VERSION;
  /** Opaque per-session handle (base64url); not the stable NBC session_id. */
  route: string;
  /** Base64url RFC 9420 MLS wire bytes. */
  payload: string;
};
