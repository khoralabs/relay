import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { base64urlnopad } from "@scure/base";
import { hexToBytes } from "./encoding";
import { RelayCryptoError } from "./pairing-secret-cipher";

export const PAIRING_SECRET_ENCRYPTION_KEY_ENV = "RELAY_PAIRING_SECRET_ENCRYPTION_KEY" as const;

export const TEST_PAIRING_SECRET_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" as const;

const AES_KEY_BYTES = 32;

export const PAIRING_SECRET_KDF_SALT = utf8ToBytes("khora/relay/pairing-secret/v1");
export const PAIRING_SECRET_KDF_INFO = utf8ToBytes("pairing-secret-encryption-key");

const BASE64URL_KEY_RE = /^[A-Za-z0-9_-]+$/;

export function pairingSecretKeyFromHex(hex: string): Uint8Array {
  const trimmed = hex.trim();
  if (!/^[0-9a-f]{64}$/i.test(trimmed)) {
    throw new RelayCryptoError("pairing secret encryption key must be 32-byte hex (64 characters)");
  }
  return hexToBytes(trimmed);
}

export function pairingSecretKeyFromBase64Url(b64url: string): Uint8Array {
  const trimmed = b64url.trim();
  if (!BASE64URL_KEY_RE.test(trimmed)) {
    throw new RelayCryptoError("pairing secret encryption key must be valid base64url");
  }
  try {
    const bytes = base64urlnopad.decode(trimmed);
    if (bytes.length !== AES_KEY_BYTES) {
      throw new RelayCryptoError(
        `pairing secret encryption key must decode to ${AES_KEY_BYTES} bytes`,
      );
    }
    return bytes;
  } catch (e) {
    if (e instanceof RelayCryptoError) {
      throw e;
    }
    throw new RelayCryptoError("pairing secret encryption key must be valid base64url");
  }
}

export function pairingSecretKeyFromPassphrase(passphrase: string): Uint8Array {
  if (passphrase.length === 0) {
    throw new RelayCryptoError("pairing secret passphrase must not be empty");
  }
  return hkdf(
    sha256,
    utf8ToBytes(passphrase),
    PAIRING_SECRET_KDF_SALT,
    PAIRING_SECRET_KDF_INFO,
    AES_KEY_BYTES,
  );
}

/** Derive a 32-byte key from a UTF-8 passphrase via HKDF-SHA256 (dev / low-entropy secrets). */
export function pairingSecretKeyFromUtf8(raw: string): Uint8Array {
  return pairingSecretKeyFromPassphrase(raw);
}

function tryPairingSecretKeyFromBase64Url(raw: string): Uint8Array | undefined {
  if (!BASE64URL_KEY_RE.test(raw)) {
    return undefined;
  }
  try {
    const bytes = base64urlnopad.decode(raw);
    return bytes.length === AES_KEY_BYTES ? bytes : undefined;
  } catch {
    return undefined;
  }
}

export function pairingSecretKeyFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options?: { allowDevFallback?: boolean },
): Uint8Array {
  const raw = env[PAIRING_SECRET_ENCRYPTION_KEY_ENV]?.trim();
  if (raw !== undefined && raw.length > 0) {
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      return pairingSecretKeyFromHex(raw);
    }
    const b64Key = tryPairingSecretKeyFromBase64Url(raw);
    if (b64Key !== undefined) {
      return b64Key;
    }
    if (env.NODE_ENV === "production") {
      throw new RelayCryptoError(
        `${PAIRING_SECRET_ENCRYPTION_KEY_ENV} must be 32-byte hex (64 characters) or base64url in production`,
      );
    }
    return pairingSecretKeyFromPassphrase(raw);
  }
  if (env.NODE_ENV === "production") {
    throw new RelayCryptoError(`${PAIRING_SECRET_ENCRYPTION_KEY_ENV} is required in production`);
  }
  if (options?.allowDevFallback === false) {
    throw new RelayCryptoError(`${PAIRING_SECRET_ENCRYPTION_KEY_ENV} is required`);
  }
  return pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX);
}
