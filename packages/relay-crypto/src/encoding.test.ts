import { describe, expect, test } from "bun:test";
import {
  base58Decode,
  base58Encode,
  base64UrlToBytes,
  bytesToBase64Url,
  bytesToHex,
  hexToBytes,
} from "./encoding";

describe("encoding", () => {
  test("hex round-trip", () => {
    const raw = new Uint8Array([0, 1, 255, 16]);
    expect(bytesToHex(raw)).toBe("0001ff10");
    expect(hexToBytes("0001ff10")).toEqual(raw);
  });

  test("hexToBytes trims whitespace", () => {
    expect(hexToBytes("  abcd  ")).toEqual(new Uint8Array([0xab, 0xcd]));
  });

  test("hexToBytes rejects non-hex characters", () => {
    expect(() => hexToBytes("abzz")).toThrow();
    expect(() => hexToBytes("")).not.toThrow();
  });

  test("hexToBytes rejects odd length", () => {
    expect(() => hexToBytes("abc")).toThrow();
  });

  test("base64url round-trip", () => {
    const raw = new Uint8Array([1, 2, 3, 255]);
    const encoded = bytesToBase64Url(raw);
    expect(encoded).not.toContain("=");
    expect(base64UrlToBytes(encoded)).toEqual(raw);
  });

  test("base58 round-trip", () => {
    const raw = new Uint8Array([0, 0, 1, 2, 3]);
    expect(base58Decode(base58Encode(raw))).toEqual(raw);
  });
});
