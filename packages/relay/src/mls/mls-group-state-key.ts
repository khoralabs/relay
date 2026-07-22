import {
  pairingSecretKeyFromBase64Url,
  pairingSecretKeyFromHex,
  pairingSecretKeyFromPassphrase,
  RelayCryptoError,
  TEST_PAIRING_SECRET_KEY_HEX,
} from "@khoralabs/relay/crypto";

export const MLS_GROUP_STATE_ENCRYPTION_KEY_ENV = "RELAY_MLS_GROUP_STATE_ENCRYPTION_KEY" as const;

const BASE64URL_KEY_RE = /^[A-Za-z0-9_-]+$/;

function tryKeyFromBase64Url(raw: string): Uint8Array | undefined {
  if (!BASE64URL_KEY_RE.test(raw)) return undefined;
  try {
    return pairingSecretKeyFromBase64Url(raw);
  } catch {
    return undefined;
  }
}

/** 32-byte AES key for MLS group-state envelopes (hex, base64url, or dev passphrase). */
export function mlsGroupStateKeyFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options?: { allowDevFallback?: boolean },
): Uint8Array {
  const raw = env[MLS_GROUP_STATE_ENCRYPTION_KEY_ENV]?.trim();
  if (raw !== undefined && raw.length > 0) {
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      return pairingSecretKeyFromHex(raw);
    }
    const b64Key = tryKeyFromBase64Url(raw);
    if (b64Key !== undefined) {
      return b64Key;
    }
    if (env.NODE_ENV === "production") {
      throw new RelayCryptoError(
        `${MLS_GROUP_STATE_ENCRYPTION_KEY_ENV} must be 32-byte hex (64 characters) or base64url in production`,
      );
    }
    return pairingSecretKeyFromPassphrase(raw);
  }
  if (env.NODE_ENV === "production") {
    throw new RelayCryptoError(`${MLS_GROUP_STATE_ENCRYPTION_KEY_ENV} is required in production`);
  }
  if (options?.allowDevFallback === false) {
    throw new RelayCryptoError(`${MLS_GROUP_STATE_ENCRYPTION_KEY_ENV} is required`);
  }
  return pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX);
}
