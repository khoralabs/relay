import { Database } from "bun:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { openEncryptedDatabaseSync, SqliteCryptoError } from "@khoralabs/sqlite-crypto";
import { createRelayPersistence } from "../core/service";
import { ensureChannelRegistrySchema } from "./registry-schema";
import { ensureRelayStateSchema } from "./state-schema";
import { createSqlitePersistenceStrategy } from "./strategy";

export const RELAY_SQLCIPHER_ENV = "RELAY_SQLCIPHER_KEY";
/** Fixed key for unit/integration tests only — not used as a runtime default. */
export const DEV_SQLCIPHER_KEY = "relay-dev-sqlcipher-key";

export function relayDatabasePath(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.RELAY_DB_PATH?.trim();
  const raw =
    configured !== undefined && configured.length > 0
      ? configured
      : resolve(import.meta.dir, "../../../data/relay.sqlite");
  if (raw === ":memory:") return raw;
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

/**
 * Resolve `RELAY_SQLCIPHER_KEY` when set (≥16 chars); otherwise `undefined` (plaintext).
 */
export function sqlCipherKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env[RELAY_SQLCIPHER_ENV]?.trim();
  if (key === undefined || key.length === 0) return undefined;
  if (key.length < 16) {
    throw new SqliteCryptoError(`${RELAY_SQLCIPHER_ENV} must be at least 16 characters`);
  }
  return key;
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

/** Ignore "SQLite already loaded" when a prior plaintext open raced SQLCipher setCustomSQLite. */
function softenSetCustomSqlite(): void {
  const original = Database.setCustomSQLite.bind(Database);
  Database.setCustomSQLite = ((path: string) => {
    try {
      original(path);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/SQLite already loaded/i.test(msg)) throw e;
    }
  }) as typeof Database.setCustomSQLite;
}

/**
 * Open the relay SQLite database. Pass `key` (or set `RELAY_SQLCIPHER_KEY`) for SQLCipher;
 * omit both for plaintext.
 */
export function openRelayDatabase(path?: string, key?: string): Database {
  const dbPath = path ?? relayDatabasePath();
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const sqlCipherKey = key ?? sqlCipherKeyFromEnv();
  let db: Database;
  if (typeof sqlCipherKey === "string" && sqlCipherKey.length > 0) {
    softenSetCustomSqlite();
    db = openEncryptedDatabaseSync(dbPath, { create: true }, sqlCipherKey);
  } else {
    db = new Database(dbPath, { create: true });
  }
  restrictRelayStoreDatabasePermissions(dbPath);
  applyRelayDbPragmas(db);
  ensureChannelRegistrySchema(db);
  ensureRelayStateSchema(db);
  return db;
}

export function createRelayStores(db: Database, env: NodeJS.ProcessEnv = process.env) {
  const persistence = createRelayPersistence({
    durable: createSqlitePersistenceStrategy(db),
    env,
  });
  return {
    admission: persistence.admission,
    spool: persistence.spool,
    registry: persistence.registry,
    persistence,
  };
}
