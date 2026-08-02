/**
 * Bun loads this before tests (see repo-root bunfig.toml).
 * SQLCipher's Database.setCustomSQLite must run before any bun:sqlite Database open.
 */
import { resolveSqlCipherLib } from "@khoralabs/sqlite-crypto";

resolveSqlCipherLib();
