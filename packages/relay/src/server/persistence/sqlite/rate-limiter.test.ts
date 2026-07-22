import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { createSqliteRateLimiter } from "./rate-limiter";
import { ensureRelayStateSchema } from "./state-schema";

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
