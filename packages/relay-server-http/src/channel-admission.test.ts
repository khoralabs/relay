import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
  isEncryptedPairingSecret,
  pairingSecretKeyFromHex,
  TEST_PAIRING_SECRET_KEY_HEX,
} from "@khoralabs/relay-crypto";
import { createChannelAdmissionStore, ensureChannelAdmissionSchema } from "./channel-admission";

const key = pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX);
const secretHex = "deadbeef".repeat(8);

function openDb(): Database {
  const db = new Database(":memory:");
  ensureChannelAdmissionSchema(db);
  return db;
}

describe("channel-admission", () => {
  test("upsert and active lookup", () => {
    const db = openDb();
    const store = createChannelAdmissionStore(db, key);
    const now = 1_000_000;
    store.upsertChannelAdmission({
      channelId: "ch-1",
      pairingSecretHex: secretHex,
      createdAtMs: now,
      expiresAtMs: now + 60_000,
    });
    const row = store.getChannelAdmissionIfActive("ch-1", now + 1);
    expect(row?.pairingSecretHex).toBe(secretHex);
    expect(row?.expiresAtMs).toBe(now + 60_000);
  });

  test("expired channels are not returned", () => {
    const db = openDb();
    const store = createChannelAdmissionStore(db, key);
    const now = 1_000_000;
    store.upsertChannelAdmission({
      channelId: "ch-exp",
      pairingSecretHex: secretHex,
      createdAtMs: now,
      expiresAtMs: now + 1000,
    });
    expect(store.getChannelAdmissionIfActive("ch-exp", now + 1001)).toBeUndefined();
  });

  test("purgeExpiredChannels removes stale rows", () => {
    const db = openDb();
    const store = createChannelAdmissionStore(db, key);
    const now = 1_000_000;
    store.upsertChannelAdmission({
      channelId: "old",
      pairingSecretHex: secretHex,
      createdAtMs: now,
      expiresAtMs: now + 100,
    });
    store.upsertChannelAdmission({
      channelId: "new",
      pairingSecretHex: secretHex,
      createdAtMs: now,
      expiresAtMs: now + 60_000,
    });
    expect(store.purgeExpiredChannels(now + 200)).toBe(1);
    expect(store.getChannelAdmissionIfActive("old", now + 200)).toBeUndefined();
    expect(store.getChannelAdmissionIfActive("new", now + 200)?.channelId).toBe("new");
  });

  test("encrypts pairing secret at rest", () => {
    const db = openDb();
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
  });
});
