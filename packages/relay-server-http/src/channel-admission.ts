import type { Database } from "bun:sqlite";
import type { ChannelAdmissionRecord, ChannelAdmissionStore } from "@khoralabs/relay-admission";
import {
  decryptPairingSecretHex,
  encryptPairingSecretHex,
  pairingSecretKeyFromEnv,
} from "@khoralabs/relay-crypto";

export function ensureChannelAdmissionSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS relay_rooms (
      channel_id TEXT PRIMARY KEY NOT NULL,
      pairing_secret_hex TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      expires_at_ms INTEGER NOT NULL
    );
  `);
}

export function createChannelAdmissionStore(
  db: Database,
  pairingSecretKey: Uint8Array,
): ChannelAdmissionStore {
  ensureChannelAdmissionSchema(db);
  const upsertStmt = db.prepare(
    `INSERT INTO relay_rooms (channel_id, pairing_secret_hex, created_at_ms, expires_at_ms)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(channel_id) DO UPDATE SET
       pairing_secret_hex = excluded.pairing_secret_hex,
       created_at_ms = excluded.created_at_ms,
       expires_at_ms = excluded.expires_at_ms`,
  );
  const selectStmt = db.query(
    `SELECT pairing_secret_hex, created_at_ms, expires_at_ms
     FROM relay_rooms WHERE channel_id = ? AND expires_at_ms > ?`,
  );
  const purgeExpiredStmt = db.prepare(`DELETE FROM relay_rooms WHERE expires_at_ms <= ?`);
  const deleteStmt = db.prepare(`DELETE FROM relay_rooms WHERE channel_id = ?`);

  return {
    upsertChannelAdmission(record: ChannelAdmissionRecord): void {
      upsertStmt.run(
        record.channelId,
        encryptPairingSecretHex(record.pairingSecretHex, pairingSecretKey),
        record.createdAtMs,
        record.expiresAtMs,
      );
    },

    getChannelAdmissionIfActive(
      channelId: string,
      nowMs: number,
    ): ChannelAdmissionRecord | undefined {
      const row = selectStmt.get(channelId, nowMs) as
        | { pairing_secret_hex: string; created_at_ms: number; expires_at_ms: number }
        | null
        | undefined;
      if (row === undefined || row === null) return undefined;
      return {
        channelId,
        pairingSecretHex: decryptPairingSecretHex(row.pairing_secret_hex, pairingSecretKey),
        createdAtMs: row.created_at_ms,
        expiresAtMs: row.expires_at_ms,
      };
    },

    purgeExpiredChannels(nowMs: number): number {
      return purgeExpiredStmt.run(nowMs).changes;
    },

    purgeChannel(channelId: string): void {
      deleteStmt.run(channelId);
    },
  };
}

export function createChannelAdmissionStoreFromEnv(
  db: Database,
  env: NodeJS.ProcessEnv = process.env,
): ChannelAdmissionStore {
  return createChannelAdmissionStore(db, pairingSecretKeyFromEnv(env));
}
