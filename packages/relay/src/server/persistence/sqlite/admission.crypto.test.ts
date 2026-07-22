import { describe, expect, test } from "bun:test";
import {
  isEncryptedPairingSecret,
  pairingSecretKeyFromHex,
  TEST_PAIRING_SECRET_KEY_HEX,
} from "@khoralabs/relay/crypto";
import { createChannelAdmissionStore } from "./admission";
import { DEV_SQLCIPHER_KEY, openRelayDatabase } from "./db";

/** SQLite-only: pairing secrets must be ciphertext at rest (not visible via strategy API). */
describe("sqlite admission encryption at rest", () => {
  test("stores encrypted pairing secret", () => {
    const db = openRelayDatabase(":memory:", DEV_SQLCIPHER_KEY);
    const key = pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX);
    const secretHex = "deadbeef".repeat(8);
    const store = createChannelAdmissionStore(db, key);
    const now = 1_000_000;
    store.upsertChannelAdmission({
      channelId: "enc",
      pairingSecretHex: secretHex,
      createdAtMs: now,
      expiresAtMs: now + 60_000,
    });
    const raw = db
      .query(`SELECT pairing_secret_hex FROM relay_channels WHERE channel_id = ?`)
      .get("enc") as { pairing_secret_hex: string };
    expect(isEncryptedPairingSecret(raw.pairing_secret_hex)).toBe(true);
    expect(raw.pairing_secret_hex).not.toBe(secretHex);
    db.close();
  });
});
