import { RelaySqliteError } from "./pairing-secret-cipher";

export const PAIRING_SECRET_ENCRYPTION_KEY_ENV = "RELAY_PAIRING_SECRET_ENCRYPTION_KEY" as const;

export const TEST_PAIRING_SECRET_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" as const;

export function pairingSecretKeyFromHex(hex: string): Uint8Array {
  const trimmed = hex.trim();
  if (!/^[0-9a-f]{64}$/i.test(trimmed)) {
    throw new RelaySqliteError("pairing secret encryption key must be 32-byte hex (64 characters)");
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = Number.parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function pairingSecretKeyFromUtf8(raw: string): Uint8Array {
  const bytes = new TextEncoder().encode(raw);
  if (bytes.length < 32) {
    throw new RelaySqliteError(
      "pairing secret encryption key must be 32-byte hex or UTF-8 string of at least 32 bytes",
    );
  }
  return bytes.length === 32 ? bytes : bytes.subarray(0, 32);
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
    return pairingSecretKeyFromUtf8(raw);
  }
  if (env.NODE_ENV === "production") {
    throw new RelaySqliteError(`${PAIRING_SECRET_ENCRYPTION_KEY_ENV} is required in production`);
  }
  if (options?.allowDevFallback === false) {
    throw new RelaySqliteError(`${PAIRING_SECRET_ENCRYPTION_KEY_ENV} is required`);
  }
  return pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX);
}
