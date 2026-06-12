# @khoralabs/relay-server

Deployable relay server binary — a DID-authenticated encrypted blob transport hub with SQLite persistence.

## Overview

Wraps `@khoralabs/relay-server-http` into a runnable `Bun.serve` process. Supports two modes:

- **pool** — multi-channel, open creation (default)
- **single** — one pre-configured channel bootstrapped at startup

## Run

```bash
bun run start
```

Default port: **8790** (override with `PORT`).

## Configuration

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `8790` |
| `RELAY_MODE` | `pool` or `single` | `pool` |
| `RELAY_CHANNEL_ID` | Channel ID for single mode | — |
| `RELAY_CHANNEL_CREATOR_DID` | Creator DID for single mode | — |
| `RELAY_CHANNEL_TTL_MS` | Channel TTL in milliseconds | — |
| `RELAY_MAX_POPULATION` | Max roster size per channel | — |
| `RELAY_MAX_SESSIONS` | Max concurrent sessions (JSON) | — |
| `RELAY_MAX_CHANNELS` | Pool mode channel cap | `10000` |
| `RELAY_DB_PATH` | SQLite path (`:memory:` supported) | `packages/data/relay.sqlite` |
| `RELAY_SQLCIPHER_KEY` | Whole-file DB encryption key | — (required in prod) |
| `RELAY_PAIRING_SECRET_ENCRYPTION_KEY` | Field-level pairing secret encryption (32-byte hex or base64url in prod) | — |
| `RELAY_REDIS_URL` | Redis URL for shared nonce/rate-limit state (required multi-instance) | — |
| `RELAY_REDIS_PREFIX` | Key prefix for Redis state | `relay` |
| `RELAY_TRUSTED_PROXY` | Honor `X-Forwarded-For` / `X-Real-IP` for IP rate limits (behind LB) | unset (use socket peer only) |
| `RELAY_RL_PREKEYS_FETCH_PER_MIN_PER_DID` | Per-requester DID rate limit for prekey fetch | `30` |
| `RELAY_PREKEY_LOW_OTK_WARN` | Log warning when remaining OTK count is at or below this | `5` |

Single-instance deployments can rely on SQLite (`RELAY_DB_PATH`) for agent-request nonce replay protection and HTTP rate limits. Behind a load balancer, set `RELAY_REDIS_URL`.

## Tests

```bash
bun test
```

Tests cover DID auth, rate limiting, and end-to-end channel/session flows.
