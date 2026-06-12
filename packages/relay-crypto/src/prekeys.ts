export type SignedPreKey = {
  keyId: number;
  publicKey: string;
  signature: string;
};

export type OneTimePreKey = {
  keyId: number;
  publicKey: string;
};

export type PreKeyBundle = {
  did: string;
  identityKey: string;
  signedPreKey: SignedPreKey;
  oneTimePreKey?: OneTimePreKey;
  /** Unclaimed one-time prekeys remaining for this DID after a fetch (relay metadata). */
  remainingOneTimePreKeys?: number;
  /** True when the fetch could not claim an OTK (SPK-only X3DH path). */
  oneTimePreKeyDepleted?: boolean;
};

export type X3dhInitMessage = {
  ek: string;
  opkId: number | null;
};

export type PublishPreKeyBundleBody = {
  identityKey: string;
  signedPreKey: SignedPreKey;
  oneTimePreKeys: OneTimePreKey[];
};

export type AppendOneTimePreKeysBody = {
  oneTimePreKeys: OneTimePreKey[];
};

export type PreKeyBundleStatus = {
  published: boolean;
  remainingOneTimePreKeys: number;
  signedPreKeyId?: number;
  nextOneTimePreKeyId: number;
};

function obj(v: unknown, name: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new Error(`${name}: expected object`);
  }
  return v as Record<string, unknown>;
}

function str(v: unknown, field: string): string {
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`${field}: expected non-empty string`);
  }
  return v;
}

function posInt(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    throw new Error(`${field}: expected non-negative integer`);
  }
  return v;
}

function parseSignedPreKey(v: unknown): SignedPreKey {
  const o = obj(v, "SignedPreKey");
  return {
    keyId: posInt(o.keyId, "keyId"),
    publicKey: str(o.publicKey, "publicKey"),
    signature: str(o.signature, "signature"),
  };
}

function parseOneTimePreKey(v: unknown): OneTimePreKey {
  const o = obj(v, "OneTimePreKey");
  return {
    keyId: posInt(o.keyId, "keyId"),
    publicKey: str(o.publicKey, "publicKey"),
  };
}

export function parsePreKeyBundle(v: unknown): PreKeyBundle {
  const o = obj(v, "PreKeyBundle");
  const bundle: PreKeyBundle = {
    did: str(o.did, "did"),
    identityKey: str(o.identityKey, "identityKey"),
    signedPreKey: parseSignedPreKey(o.signedPreKey),
  };
  if (o.oneTimePreKey !== undefined && o.oneTimePreKey !== null) {
    bundle.oneTimePreKey = parseOneTimePreKey(o.oneTimePreKey);
  }
  if (o.remainingOneTimePreKeys !== undefined && o.remainingOneTimePreKeys !== null) {
    bundle.remainingOneTimePreKeys = posInt(o.remainingOneTimePreKeys, "remainingOneTimePreKeys");
  }
  if (o.oneTimePreKeyDepleted === true) {
    bundle.oneTimePreKeyDepleted = true;
  }
  return bundle;
}

export function parseAppendOneTimePreKeysBody(v: unknown): AppendOneTimePreKeysBody {
  const o = obj(v, "AppendOneTimePreKeysBody");
  const otks = o.oneTimePreKeys;
  if (!Array.isArray(otks)) {
    throw new Error("oneTimePreKeys: expected array");
  }
  return { oneTimePreKeys: otks.map(parseOneTimePreKey) };
}

export function parsePreKeyBundleStatus(v: unknown): PreKeyBundleStatus {
  const o = obj(v, "PreKeyBundleStatus");
  const status: PreKeyBundleStatus = {
    published: o.published === true,
    remainingOneTimePreKeys: posInt(o.remainingOneTimePreKeys, "remainingOneTimePreKeys"),
    nextOneTimePreKeyId: posInt(o.nextOneTimePreKeyId, "nextOneTimePreKeyId"),
  };
  if (o.signedPreKeyId !== undefined && o.signedPreKeyId !== null) {
    status.signedPreKeyId = posInt(o.signedPreKeyId, "signedPreKeyId");
  }
  return status;
}

export function parsePublishPreKeyBundleBody(v: unknown): PublishPreKeyBundleBody {
  const o = obj(v, "PublishPreKeyBundleBody");
  const otks = o.oneTimePreKeys;
  if (!Array.isArray(otks)) {
    throw new Error("oneTimePreKeys: expected array");
  }
  return {
    identityKey: str(o.identityKey, "identityKey"),
    signedPreKey: parseSignedPreKey(o.signedPreKey),
    oneTimePreKeys: otks.map(parseOneTimePreKey),
  };
}

export function parseX3dhInitMessage(v: unknown): X3dhInitMessage {
  const o = obj(v, "X3dhInitMessage");
  return {
    ek: str(o.ek, "ek"),
    opkId: o.opkId === null || o.opkId === undefined ? null : posInt(o.opkId, "opkId"),
  };
}
