import { ed25519PublicKeyBytesFromDid } from "@khoralabs/relay/crypto";
import type {
  AuthenticationService,
  CiphersuiteImpl,
  ClientConfig,
  Credential,
  KeyPackage,
} from "ts-mls";
import { defaultClientConfig } from "ts-mls/clientConfig.js";
import { verifyKeyPackage } from "ts-mls/keyPackage.js";

import { didFromRelayCredential } from "./relay-mls-identity";

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai === undefined || bi === undefined) return false;
    diff |= ai ^ bi;
  }
  return diff === 0;
}

/** Whether a relay basic credential's DID matches the leaf Ed25519 signature key. */
export function relayDidMatchesSignatureKey(did: string, signaturePublicKey: Uint8Array): boolean {
  try {
    return bytesEqual(ed25519PublicKeyBytesFromDid(did), signaturePublicKey);
  } catch {
    return false;
  }
}

/** MLS AuthenticationService: credential identity must be a `did:key` bound to the leaf sig key. */
export function createRelayDidAuthService(): AuthenticationService {
  return {
    async validateCredential(
      credential: Credential,
      signaturePublicKey: Uint8Array,
    ): Promise<boolean> {
      const did = didFromRelayCredential(credential);
      if (did === undefined || !did.startsWith("did:key:")) return false;
      return relayDidMatchesSignatureKey(did, signaturePublicKey);
    },
  };
}

export function createRelayMlsClientConfig(): ClientConfig {
  return { ...defaultClientConfig, authService: createRelayDidAuthService() };
}

/** Verify KeyPackage signature and that its credential DID matches the expected peer. */
export async function verifyKeyPackageForDid(
  keyPackage: KeyPackage,
  expectedDid: string,
  cs: CiphersuiteImpl,
): Promise<void> {
  if (!(await verifyKeyPackage(keyPackage, cs.signature))) {
    throw new Error("MLS KeyPackage signature invalid");
  }
  const credentialDid = didFromRelayCredential(keyPackage.leafNode.credential);
  if (credentialDid !== expectedDid) {
    throw new Error(
      `MLS KeyPackage credential DID mismatch: ${credentialDid ?? "invalid"} !== ${expectedDid}`,
    );
  }
  if (!relayDidMatchesSignatureKey(expectedDid, keyPackage.leafNode.signaturePublicKey)) {
    throw new Error("MLS KeyPackage signature key not bound to credential DID");
  }
}
