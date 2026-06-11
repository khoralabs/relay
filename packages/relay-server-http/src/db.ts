import type { Database } from "bun:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { openEncryptedDatabaseSync, SqliteCryptoError } from "@khoralabs/sqlite-crypto";
import { createBlobSpool } from "./blob-spool";
import { createChannelAdmissionStoreFromEnv } from "./channel-admission";
import { ensureChannelRegistrySchema } from "./registry-schema";
import { ensureRelayStateSchema } from "./relay-state-schema";

export const RELAY_SQLCIPHER_ENV = "RELAY_SQLCIPHER_KEY";
export const DEV_SQLCIPHER_KEY = "relay-dev-sqlcipher-key";

export function relayDatabasePath(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.RELAY_DB_PATH?.trim();
  const raw =
    configured !== undefined && configured.length > 0
      ? configured
      : resolve(import.meta.dir, "../../data/relay.sqlite");
  if (raw === ":memory:") return raw;
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

export function sqlCipherKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const key = env[RELAY_SQLCIPHER_ENV]?.trim();
  if (key !== undefined && key.length > 0) {
    if (key.length < 16) {
      throw new SqliteCryptoError(`${RELAY_SQLCIPHER_ENV} must be at least 16 characters`);
    }
    return key;
  }
  if (env.NODE_ENV === "production") {
    throw new SqliteCryptoError(`${RELAY_SQLCIPHER_ENV} is required in production`);
  }
  return DEV_SQLCIPHER_KEY;
}

export function restrictRelayStoreDatabasePermissions(dbPath: string): void {
  if (dbPath === ":memory:") {
    return;
  }
  for (const path of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (existsSync(path)) {
      chmodSync(path, 0o600);
    }
  }
}

export function applyRelayDbPragmas(db: Database): void {
  db.run(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA cache_size = -64000;
    PRAGMA temp_store = MEMORY;
  `);
}

export function openRelayDatabase(path?: string, key?: string): Database {
  const dbPath = path ?? relayDatabasePath();
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = openEncryptedDatabaseSync(dbPath, { create: true }, key ?? sqlCipherKeyFromEnv());
  restrictRelayStoreDatabasePermissions(dbPath);
  applyRelayDbPragmas(db);
  ensureChannelRegistrySchema(db);
  ensureRelayStateSchema(db);
  return db;
}

export function createRelayStores(db: Database) {
  return {
    admission: createChannelAdmissionStoreFromEnv(db),
    spool: createBlobSpool(db),
  };
}
