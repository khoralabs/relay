import type { Database } from "bun:sqlite";

export function ensureRelayStateSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_request_nonces (
      did TEXT NOT NULL,
      nonce TEXT NOT NULL,
      expires_at_ms INTEGER NOT NULL,
      PRIMARY KEY (did, nonce)
    );

    CREATE INDEX IF NOT EXISTS idx_agent_nonces_expires ON agent_request_nonces(expires_at_ms);

    CREATE TABLE IF NOT EXISTS rate_limit_counters (
      bucket TEXT NOT NULL,
      window_start_ms INTEGER NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (bucket, window_start_ms)
    );

    CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_counters(window_start_ms);
  `);
}
