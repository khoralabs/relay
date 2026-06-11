import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const PAIRING_SECRET_ENVELOPE_MAGIC = "relay/pairing/v1" as const;
export const PAIRING_SECRET_ENVELOPE_V1 = 1 as const;
export const PAIRING_SECRET_ENVELOPE_ALG = "A256GCM" as const;

type PairingSecretEnvelopeV1 = {
  v: typeof PAIRING_SECRET_ENVELOPE_V1;
  alg: typeof PAIRING_SECRET_ENVELOPE_ALG;
  iv: string;
  ct: string;
};

export class RelaySqliteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RelaySqliteError";
  }
}

function normalizeAesKey(keyBytes: Uint8Array): Buffer {
  if (keyBytes.length === 32) {
    return Buffer.from(keyBytes);
  }
  if (keyBytes.length > 32) {
    return Buffer.from(keyBytes.subarray(0, 32));
  }
  throw new RelaySqliteError("pairing secret encryption key must be at least 32 bytes");
}

export function isEncryptedPairingSecret(stored: string): boolean {
  return stored.startsWith(PAIRING_SECRET_ENVELOPE_MAGIC);
}

function parseEnvelopeJson(stored: string): PairingSecretEnvelopeV1 {
  const text = stored.slice(PAIRING_SECRET_ENVELOPE_MAGIC.length);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new RelaySqliteError("pairing secret envelope: invalid JSON after magic prefix");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new RelaySqliteError("pairing secret envelope: body must be a JSON object");
  }
  const rec = parsed as Record<string, unknown>;
  if (rec.v !== PAIRING_SECRET_ENVELOPE_V1) {
    throw new RelaySqliteError("pairing secret envelope: unsupported version");
  }
  if (rec.alg !== PAIRING_SECRET_ENVELOPE_ALG) {
    throw new RelaySqliteError("pairing secret envelope: unsupported algorithm");
  }
  if (typeof rec.iv !== "string" || typeof rec.ct !== "string") {
    throw new RelaySqliteError("pairing secret envelope: iv/ct must be base64 strings");
  }
  return rec as PairingSecretEnvelopeV1;
}

export function encryptPairingSecretHex(hex: string, keyBytes: Uint8Array): string {
  const key = normalizeAesKey(keyBytes);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(hex, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope: PairingSecretEnvelopeV1 = {
    v: PAIRING_SECRET_ENVELOPE_V1,
    alg: PAIRING_SECRET_ENVELOPE_ALG,
    iv: iv.toString("base64"),
    ct: Buffer.concat([ct, tag]).toString("base64"),
  };
  return PAIRING_SECRET_ENVELOPE_MAGIC + JSON.stringify(envelope);
}

export function decryptPairingSecretHex(stored: string, keyBytes: Uint8Array): string {
  if (!isEncryptedPairingSecret(stored)) {
    return stored;
  }
  const wrap = parseEnvelopeJson(stored);
  const iv = Buffer.from(wrap.iv, "base64");
  const ctWithTag = Buffer.from(wrap.ct, "base64");
  if (iv.length !== 12) {
    throw new RelaySqliteError("pairing secret envelope: iv must decode to 12 bytes");
  }
  if (ctWithTag.length < 16) {
    throw new RelaySqliteError("pairing secret envelope: ciphertext too short");
  }
  const tag = ctWithTag.subarray(ctWithTag.length - 16);
  const ct = ctWithTag.subarray(0, ctWithTag.length - 16);
  const key = normalizeAesKey(keyBytes);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    throw new RelaySqliteError("pairing secret envelope: decrypt failed (bad key or ciphertext)");
  }
}
