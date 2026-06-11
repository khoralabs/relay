import { describe, expect, test } from "bun:test";
import {
  decryptPairingSecretHex,
  encryptPairingSecretHex,
  isEncryptedPairingSecret,
  RelayCryptoError,
} from "./pairing-secret-cipher";
import { pairingSecretKeyFromHex, TEST_PAIRING_SECRET_KEY_HEX } from "./pairing-secret-key";

const key = pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX);
const secretHex = "a1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01";
const channelId = "ch-test-1";

describe("pairing-secret-cipher", () => {
  test("round-trip encrypt/decrypt", () => {
    const stored = encryptPairingSecretHex(secretHex, channelId, key);
    expect(isEncryptedPairingSecret(stored)).toBe(true);
    expect(decryptPairingSecretHex(stored, channelId, key)).toBe(secretHex);
  });

  test("plaintext passthrough when not envelope-prefixed", () => {
    expect(decryptPairingSecretHex(secretHex, channelId, key)).toBe(secretHex);
    expect(isEncryptedPairingSecret(secretHex)).toBe(false);
  });

  test("reject bad key length", () => {
    expect(() => encryptPairingSecretHex(secretHex, channelId, new Uint8Array(16))).toThrow(
      RelayCryptoError,
    );
  });

  test("reject decrypt with wrong key", () => {
    const stored = encryptPairingSecretHex(secretHex, channelId, key);
    const wrongKey = pairingSecretKeyFromHex(
      "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    );
    expect(() => decryptPairingSecretHex(stored, channelId, wrongKey)).toThrow(RelayCryptoError);
  });

  test("reject decrypt with wrong channel id", () => {
    const stored = encryptPairingSecretHex(secretHex, channelId, key);
    expect(() => decryptPairingSecretHex(stored, "ch-other", key)).toThrow(RelayCryptoError);
  });

  test("reject corrupt envelope JSON", () => {
    expect(() => decryptPairingSecretHex("relay/pairing/v1{not-json", channelId, key)).toThrow(
      RelayCryptoError,
    );
  });
});
