import { describe, expect, test } from "bun:test";
import {
  pairingSecretKeyFromHex,
  RelayCryptoError,
  TEST_PAIRING_SECRET_KEY_HEX,
} from "@khoralabs/relay/crypto";
import {
  decryptMlsGroupState,
  encryptMlsGroupState,
  isEncryptedMlsGroupState,
} from "./mls-group-state-cipher";
import { createEncryptingMlsStatePersistence, MemoryMlsStatePersistence } from "./persistence";

const key = pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX);
const groupId = "session-abc";
const stateBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

describe("mls-group-state-cipher", () => {
  test("round-trip encrypt/decrypt", () => {
    const stored = encryptMlsGroupState(stateBytes, groupId, key);
    expect(isEncryptedMlsGroupState(stored)).toBe(true);
    expect(decryptMlsGroupState(stored, groupId, key)).toEqual(stateBytes);
  });

  test("reject plaintext load", () => {
    expect(() => decryptMlsGroupState(stateBytes, groupId, key)).toThrow(RelayCryptoError);
  });

  test("reject decrypt with wrong key", () => {
    const stored = encryptMlsGroupState(stateBytes, groupId, key);
    const wrongKey = pairingSecretKeyFromHex(
      "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    );
    expect(() => decryptMlsGroupState(stored, groupId, wrongKey)).toThrow(RelayCryptoError);
  });

  test("reject decrypt with wrong group id", () => {
    const stored = encryptMlsGroupState(stateBytes, groupId, key);
    expect(() => decryptMlsGroupState(stored, "other-group", key)).toThrow(RelayCryptoError);
  });
});

describe("encrypting persistence", () => {
  test("stores encrypted bytes in inner adapter", async () => {
    const inner = new MemoryMlsStatePersistence();
    const encrypted = createEncryptingMlsStatePersistence(inner, key);
    await encrypted.saveGroupState(groupId, stateBytes);
    const raw = await inner.loadGroupState(groupId);
    if (raw === undefined) throw new Error("expected raw persisted bytes");
    expect(isEncryptedMlsGroupState(raw)).toBe(true);
    const loaded = await encrypted.loadGroupState(groupId);
    expect(loaded).toEqual(stateBytes);
  });
});
