import { getPublicKeyAsync } from "@noble/ed25519";
import {
  type CiphersuiteImpl,
  defaultCapabilities,
  defaultLifetime,
  generateKeyPackageWithKey,
  type KeyPackage,
  type PrivateKeyPackage,
} from "ts-mls";

import { relayDidCredential } from "./relay-mls-identity";

export type Ed25519KeyPair = {
  signKey: Uint8Array;
  publicKey: Uint8Array;
};

export async function ed25519KeyPairFromPrivateKey(
  ed25519PrivateKey: Uint8Array,
): Promise<Ed25519KeyPair> {
  const publicKey = await getPublicKeyAsync(ed25519PrivateKey);
  return { signKey: ed25519PrivateKey, publicKey };
}

/** KeyPackage whose leaf signature key is the agent's `did:key` Ed25519 key. */
export async function generateDidBoundKeyPackage(
  did: string,
  ed25519PrivateKey: Uint8Array,
  cs: CiphersuiteImpl,
): Promise<{ publicPackage: KeyPackage; privatePackage: PrivateKeyPackage }> {
  return generateKeyPackageWithKey(
    relayDidCredential(did),
    defaultCapabilities(),
    defaultLifetime,
    [],
    await ed25519KeyPairFromPrivateKey(ed25519PrivateKey),
    cs,
  );
}
