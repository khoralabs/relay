import type { Database } from "bun:sqlite";
import type { RateLimitCheck, RateLimitRule } from "../../rate-limit";
import { ensureRelayStateSchema } from "./state-schema";

export function createSqliteRateLimiter(
  db: Database,
  rule: RateLimitRule,
): (key: string) => RateLimitCheck {
  let initialized = false;
  let lastSweepMs = 0;
  const sweepIntervalMs = rule.windowMs;

  function init(): void {
    if (initialized) return;
    ensureRelayStateSchema(db);
    initialized = true;
  }

  function maybeSweep(now: number): void {
    if (now - lastSweepMs < sweepIntervalMs) return;
    lastSweepMs = now;
    db.prepare("DELETE FROM rate_limit_counters WHERE window_start_ms < ?").run(
      now - rule.windowMs,
    );
  }

  return (key: string) => {
    init();
    const now = Date.now();
    maybeSweep(now);
    const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
    db.run("BEGIN IMMEDIATE");
    try {
      const row = db
        .query<{ count: number }, [string, number]>(
          "SELECT count FROM rate_limit_counters WHERE bucket = ? AND window_start_ms = ?",
        )
        .get(key, windowStart);
      const current = row?.count ?? 0;
      if (current >= rule.max) {
        const retryMs = windowStart + rule.windowMs - now;
        db.run("ROLLBACK");
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryMs / 1000)) };
      }
      db.prepare(
        `INSERT INTO rate_limit_counters (bucket, window_start_ms, count) VALUES (?, ?, 1)
         ON CONFLICT(bucket, window_start_ms) DO UPDATE SET count = count + 1`,
      ).run(key, windowStart);
      db.run("COMMIT");
      return { ok: true };
    } catch {
      db.run("ROLLBACK");
      return { ok: true };
    }
  };
}
