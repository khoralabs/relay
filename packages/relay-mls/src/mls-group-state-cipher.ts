import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { RelayCryptoError } from "@khoralabs/relay-crypto";

export const MLS_GROUP_STATE_ENVELOPE_MAGIC = "relay/mls-group-state/v1" as const;
export const MLS_GROUP_STATE_ENVELOPE_V1 = 1 as const;
export const MLS_GROUP_STATE_ENVELOPE_ALG = "A256GCM" as const;

type MlsGroupStateEnvelopeV1 = {
  v: typeof MLS_GROUP_STATE_ENVELOPE_V1;
  alg: typeof MLS_GROUP_STATE_ENVELOPE_ALG;
  iv: string;
  ct: string;
};

function normalizeAesKey(keyBytes: Uint8Array): Buffer {
  if (keyBytes.length !== 32) {
    throw new RelayCryptoError("MLS group state encryption key must be exactly 32 bytes");
  }
  return Buffer.from(keyBytes);
}

export function isEncryptedMlsGroupState(stored: Uint8Array): boolean {
  const prefix = new TextEncoder().encode(MLS_GROUP_STATE_ENVELOPE_MAGIC);
  if (stored.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (stored[i] !== prefix[i]) return false;
  }
  return true;
}

function parseEnvelopeJson(text: string): MlsGroupStateEnvelopeV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new RelayCryptoError("MLS group state envelope: invalid JSON after magic prefix");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new RelayCryptoError("MLS group state envelope: body must be a JSON object");
  }
  const rec = parsed as Record<string, unknown>;
  if (rec.v !== MLS_GROUP_STATE_ENVELOPE_V1) {
    throw new RelayCryptoError("MLS group state envelope: unsupported version");
  }
  if (rec.alg !== MLS_GROUP_STATE_ENVELOPE_ALG) {
    throw new RelayCryptoError("MLS group state envelope: unsupported algorithm");
  }
  if (typeof rec.iv !== "string" || typeof rec.ct !== "string") {
    throw new RelayCryptoError("MLS group state envelope: iv/ct must be base64 strings");
  }
  return rec as MlsGroupStateEnvelopeV1;
}

function groupStateAad(groupId: string): Buffer {
  if (groupId.length === 0) {
    throw new RelayCryptoError("MLS group state envelope: group id required");
  }
  return Buffer.from(groupId, "utf8");
}

export function encryptMlsGroupState(
  stateBytes: Uint8Array,
  groupId: string,
  keyBytes: Uint8Array,
): Uint8Array {
  const key = normalizeAesKey(keyBytes);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(groupStateAad(groupId));
  const ct = Buffer.concat([cipher.update(stateBytes), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope: MlsGroupStateEnvelopeV1 = {
    v: MLS_GROUP_STATE_ENVELOPE_V1,
    alg: MLS_GROUP_STATE_ENVELOPE_ALG,
    iv: iv.toString("base64"),
    ct: Buffer.concat([ct, tag]).toString("base64"),
  };
  const text = MLS_GROUP_STATE_ENVELOPE_MAGIC + JSON.stringify(envelope);
  return new TextEncoder().encode(text);
}

export function decryptMlsGroupState(
  stored: Uint8Array,
  groupId: string,
  keyBytes: Uint8Array,
): Uint8Array {
  if (!isEncryptedMlsGroupState(stored)) {
    throw new RelayCryptoError(
      "MLS group state at rest must be encrypted; refuse to load plaintext group secrets",
    );
  }
  const prefixLen = MLS_GROUP_STATE_ENVELOPE_MAGIC.length;
  const text = new TextDecoder().decode(stored.slice(prefixLen));
  const wrap = parseEnvelopeJson(text);
  const iv = Buffer.from(wrap.iv, "base64");
  const ctWithTag = Buffer.from(wrap.ct, "base64");
  if (iv.length !== 12) {
    throw new RelayCryptoError("MLS group state envelope: iv must decode to 12 bytes");
  }
  if (ctWithTag.length < 16) {
    throw new RelayCryptoError("MLS group state envelope: ciphertext too short");
  }
  const tag = ctWithTag.subarray(ctWithTag.length - 16);
  const ct = ctWithTag.subarray(0, ctWithTag.length - 16);
  const key = normalizeAesKey(keyBytes);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  decipher.setAAD(groupStateAad(groupId));
  try {
    return Uint8Array.from(Buffer.concat([decipher.update(ct), decipher.final()]));
  } catch {
    throw new RelayCryptoError("MLS group state envelope: decrypt failed (bad key or ciphertext)");
  }
}
