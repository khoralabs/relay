import { LRUCache } from "lru-cache";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Decode(input: string): Uint8Array {
  const bytes: number[] = [0];
  for (const ch of input) {
    const val = BASE58_ALPHABET.indexOf(ch);
    if (val < 0) throw new Error("invalid base58");
    let carry = val;
    for (let j = 0; j < bytes.length; j++) {
      const n = (bytes[j] as number) * 58 + carry;
      bytes[j] = n % 256;
      carry = Math.floor(n / 256);
    }
    while (carry > 0) {
      bytes.push(carry % 256);
      carry = Math.floor(carry / 256);
    }
  }
  let zeros = 0;
  for (const ch of input) {
    if (ch === "1") zeros++;
    else break;
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[out.length - 1 - i] = bytes[i] as number;
  }
  return out;
}

const pubKeyCache = new LRUCache<string, Uint8Array>({ max: 512 });

/** Extract raw 32-byte Ed25519 public key from a `did:key:` string. */
export function ed25519PublicKeyBytesFromDid(did: string): Uint8Array {
  const cached = pubKeyCache.get(did);
  if (cached !== undefined) return cached;
  const didKeyPrefix = "did:key:";
  if (!did.startsWith(didKeyPrefix)) {
    throw new Error(`unsupported DID: ${did}`);
  }
  const multibase = did.slice(didKeyPrefix.length);
  if (!multibase.startsWith("z")) {
    throw new Error(`unsupported DID multibase: ${did}`);
  }
  const decoded = base58Decode(multibase.slice(1));
  if (decoded.length !== 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error(`unsupported did:key multicodec: ${did}`);
  }
  const pubKey = decoded.slice(2);
  pubKeyCache.set(did, pubKey);
  return pubKey;
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.trim();
  if (h.length % 2 !== 0) throw new Error("hex length must be even");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
