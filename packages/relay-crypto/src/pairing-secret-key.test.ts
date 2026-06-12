import { describe, expect, test } from "bun:test";
import { bytesToBase64Url, bytesToHex } from "./encoding";
import { RelayCryptoError } from "./pairing-secret-cipher";
import {
  pairingSecretKeyFromBase64Url,
  pairingSecretKeyFromEnv,
  pairingSecretKeyFromHex,
  pairingSecretKeyFromPassphrase,
  pairingSecretKeyFromUtf8,
  TEST_PAIRING_SECRET_KEY_HEX,
} from "./pairing-secret-key";

describe("pairing-secret-key", () => {
  test("hex round-trip", () => {
    const key = pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX);
    expect(key.length).toBe(32);
    expect(bytesToHex(key)).toBe(TEST_PAIRING_SECRET_KEY_HEX);
  });

  test("base64url round-trip", () => {
    const hexKey = pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX);
    const b64 = bytesToBase64Url(hexKey);
    expect(pairingSecretKeyFromBase64Url(b64)).toEqual(hexKey);
  });

  test("passphrase derives stable 32-byte key via HKDF", () => {
    const a = pairingSecretKeyFromPassphrase("dev-only passphrase");
    const b = pairingSecretKeyFromUtf8("dev-only passphrase");
    expect(a).toEqual(b);
    expect(a.length).toBe(32);
  });

  test("rejects empty passphrase", () => {
    expect(() => pairingSecretKeyFromPassphrase("")).toThrow(RelayCryptoError);
  });

  test("env accepts hex and base64url", () => {
    const hexKey = pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX);
    expect(
      pairingSecretKeyFromEnv({
        RELAY_PAIRING_SECRET_ENCRYPTION_KEY: TEST_PAIRING_SECRET_KEY_HEX,
      }),
    ).toEqual(hexKey);
    expect(
      pairingSecretKeyFromEnv({
        RELAY_PAIRING_SECRET_ENCRYPTION_KEY: bytesToBase64Url(hexKey),
      }),
    ).toEqual(hexKey);
  });

  test("env rejects passphrase in production", () => {
    expect(() =>
      pairingSecretKeyFromEnv({
        NODE_ENV: "production",
        RELAY_PAIRING_SECRET_ENCRYPTION_KEY: "dev-only passphrase",
      }),
    ).toThrow(/base64url in production/);
  });

  test("env accepts passphrase in dev", () => {
    const key = pairingSecretKeyFromEnv({
      RELAY_PAIRING_SECRET_ENCRYPTION_KEY: "dev-only passphrase",
    });
    expect(key).toEqual(pairingSecretKeyFromPassphrase("dev-only passphrase"));
  });
});
