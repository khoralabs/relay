import { decodeKeyPackage, encodeKeyPackage, type KeyPackage } from "ts-mls/keyPackage.js";

export function encodeKeyPackageWire(keyPackage: KeyPackage): Uint8Array {
  return encodeKeyPackage(keyPackage);
}

export function decodeKeyPackageWire(bytes: Uint8Array): KeyPackage {
  const decoded = decodeKeyPackage(bytes, 0);
  if (decoded === undefined) {
    throw new Error("failed to decode KeyPackage wire bytes");
  }
  return decoded[0];
}
