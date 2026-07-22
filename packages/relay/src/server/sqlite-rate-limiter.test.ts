import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { ensureRelayStateSchema } from "./relay-state-schema";
import { createSqliteRateLimiter } from "./sqlite-rate-limiter";

describe("sqlite-rate-limiter", () => {
  test("enforces cap within window", () => {
    const db = new Database(":memory:");
    ensureRelayStateSchema(db);
    const limiter = createSqliteRateLimiter(db, { windowMs: 60_000, max: 2 });
    expect(limiter("user-1").ok).toBe(true);
    expect(limiter("user-1").ok).toBe(true);
    expect(limiter("user-1").ok).toBe(false);
    expect(limiter("user-2").ok).toBe(true);
  });
});
