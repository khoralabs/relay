import {
  bytesToHex as nobleBytesToHex,
  hexToBytes as nobleHexToBytes,
} from "@noble/hashes/utils.js";
import { base58, base64urlnopad } from "@scure/base";

export function base58Decode(input: string): Uint8Array {
  return base58.decode(input);
}

export function base58Encode(bytes: Uint8Array): string {
  return base58.encode(bytes);
}

export function bytesToHex(bytes: Uint8Array): string {
  return nobleBytesToHex(bytes);
}

export function hexToBytes(hex: string): Uint8Array {
  return nobleHexToBytes(hex.trim());
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return base64urlnopad.encode(bytes);
}

export function base64UrlToBytes(b64url: string): Uint8Array {
  return base64urlnopad.decode(b64url);
}
