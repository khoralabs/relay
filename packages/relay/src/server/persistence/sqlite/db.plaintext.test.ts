import { describe, expect, test } from "bun:test";
import { openRelayDatabase, sqlCipherKeyFromEnv } from "./db";

describe("openRelayDatabase plaintext", () => {
  test("opens without key and applies schema", () => {
    const db = openRelayDatabase(":memory:");
    try {
      const tables = db
        .query<{ name: string }, []>(
          `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
        )
        .all()
        .map((r) => r.name);
      expect(tables.length).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });

  test("sqlCipherKeyFromEnv returns undefined when unset", () => {
    expect(sqlCipherKeyFromEnv({})).toBeUndefined();
  });
});
