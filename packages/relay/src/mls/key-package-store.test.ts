import { describe, expect, test } from "bun:test";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  pairingSecretKeyFromHex,
  TEST_PAIRING_SECRET_KEY_HEX,
} from "@khoralabs/relay/crypto";
import type { StoredKeyPackage } from "./key-package-manager";
import type { KeyPackageStoreEntry } from "./key-package-store";
import { loadKeyPackageStore, saveKeyPackageStore } from "./key-package-store";
import { decodeKeyPackageWire, encodeKeyPackageWire } from "./key-package-wire";
import { createEncryptingMlsStatePersistence, MemoryMlsStatePersistence } from "./persistence";
import { getRelayMlsCiphersuite } from "./relay-mls-ciphersuite";
import { generateDidBoundKeyPackage } from "./relay-mls-key-package";

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function storedEntryFromKp(kp: StoredKeyPackage): KeyPackageStoreEntry {
  const publicB64 = bytesToBase64Url(encodeKeyPackageWire(kp.publicPackage));
  return {
    publicB64,
    initPrivateKeyB64: bytesToBase64Url(kp.privatePackage.initPrivateKey),
    hpkePrivateKeyB64: bytesToBase64Url(kp.privatePackage.hpkePrivateKey),
    signaturePrivateKeyB64: bytesToBase64Url(kp.privatePackage.signaturePrivateKey),
  };
}

function storedFromEntry(entry: KeyPackageStoreEntry): StoredKeyPackage {
  return {
    publicPackage: decodeKeyPackageWire(base64UrlToBytes(entry.publicB64)),
    privatePackage: {
      initPrivateKey: base64UrlToBytes(entry.initPrivateKeyB64),
      hpkePrivateKey: base64UrlToBytes(entry.hpkePrivateKeyB64),
      signaturePrivateKey: base64UrlToBytes(entry.signaturePrivateKeyB64),
    },
  };
}

describe("key-package-store", () => {
  test("round-trip through encrypted persistence", async () => {
    const cs = await getRelayMlsCiphersuite();
    const privateKey = new Uint8Array(32);
    crypto.getRandomValues(privateKey);
    const kp = await generateDidBoundKeyPackage("did:key:z6Mktest", privateKey, cs);
    const entry = storedEntryFromKp(kp);
    const key = pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX);
    const persistence = createEncryptingMlsStatePersistence(new MemoryMlsStatePersistence(), key);

    await saveKeyPackageStore(persistence, {
      entries: [entry],
      lastResortPublicB64: entry.publicB64,
    });
    const loaded = await loadKeyPackageStore(persistence);
    expect(loaded.entries).toHaveLength(1);
    expect(loaded.lastResortPublicB64).toBe(entry.publicB64);
    const loadedEntry = loaded.entries[0];
    if (loadedEntry === undefined) throw new Error("expected store entry");
    const roundTrip = storedFromEntry(loadedEntry);
    expect(
      bytesEqual(
        encodeKeyPackageWire(roundTrip.publicPackage),
        encodeKeyPackageWire(kp.publicPackage),
      ),
    ).toBe(true);
  });
});
