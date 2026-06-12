# @khoralabs/relay-server

Deployable relay server binary — a DID-authenticated encrypted blob transport hub with SQLite persistence.

## Overview

Wraps `@khoralabs/relay-server-http` into a runnable `Bun.serve` process. Supports two modes:

- **pool** — multi-channel, open creation (default)
- **single** — one pre-configured channel bootstrapped at startup (set `RELAY_CHANNEL_ID` + `RELAY_CHANNEL_CREATOR_DID`, or `RELAY_MODE=single`)

Channels are **invite-only** (`admissionMode: "invite_only"`). Optional per-channel blob spool (`enableSpool` on create) persists opaque frames for late-join replay.

## Run

```bash
bun run start
```

Default port: **8790** (override with `PORT`).

## Configuration

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `8790` |
| `RELAY_MODE` | `pool` or `single` | `pool` (inferred from `RELAY_CHANNEL_ID` when set) |
| `RELAY_CHANNEL_ID` | Channel ID for single mode | — |
| `RELAY_CHANNEL_CREATOR_DID` | Creator DID for single mode | — |
| `RELAY_CHANNEL_TTL_MS` | Channel TTL in milliseconds | `86400000` (single mode) |
| `RELAY_MAX_POPULATION` | Max roster size per channel | unlimited |
| `RELAY_MAX_SESSIONS` | Max concurrent sessions (JSON quota) | `{"mode":"principal","measure":8}` |
| `RELAY_MAX_CHANNELS` | Pool mode channel cap | `10000` |
| `RELAY_DB_PATH` | SQLite path (`:memory:` supported) | `packages/data/relay.sqlite` |
| `RELAY_SQLCIPHER_KEY` | Whole-file DB encryption key | dev default (required in production) |
| `RELAY_PAIRING_SECRET_ENCRYPTION_KEY` | Field-level pairing secret encryption (32-byte hex or base64url in prod) | — |
| `RELAY_REDIS_URL` | Redis URL for shared nonce/rate-limit state (required multi-instance) | — |
| `RELAY_REDIS_PREFIX` | Key prefix for Redis state | `relay` |
| `RELAY_TRUSTED_PROXY` | Honor `X-Forwarded-For` / `X-Real-IP` for IP rate limits (behind LB) | unset (socket peer only) |
| `RELAY_PUBLIC_BASE_URL` | Override public base URL in create/join/ticket WS URLs | request host |
| `RELAY_RL_CHANNELS_CREATE_PER_MIN_PER_DID` | Per-DID rate limit for channel create | `30` |
| `RELAY_RL_CHANNELS_JOIN_PER_MIN_PER_DID` | Per-DID rate limit for channel join | `30` |
| `RELAY_RL_CHANNELS_TICKET_PER_MIN_PER_DID` | Per-DID rate limit for ticket mint | `60` |
| `RELAY_RL_CHANNELS_ALLOCATE_PER_MIN_PER_DID` | Per-DID rate limit for session allocate | `60` |
| `RELAY_RL_KEY_PACKAGES_FETCH_PER_MIN_PER_DID` | Per-requester DID rate limit for KeyPackage fetch | `30` |
| `RELAY_RL_DEFAULT_PER_MIN_PER_IP` | Default per-IP rate limit for HTTP | `900` |
| `RELAY_RL_WS_BYTES_PER_MIN_PER_CHANNEL` | Per-channel WS ingress bytes per minute | `1048576` (1 MiB) |
| `RELAY_RL_WS_FRAMES_PER_MIN_PER_CHANNEL` | Per-channel WS ingress frames per minute | `1200` |
| `RELAY_KEY_PACKAGE_LOW_WARN` | Log warning when remaining KeyPackage count is at or below this | `5` |
| `RELAY_WS_ALLOWED_ORIGINS` | Comma-separated browser origins allowed on WS upgrade | unset (any present `Origin` rejected) |
| `RELAY_WS_ALLOW_MISSING_ORIGIN` | Allow WS upgrades with no `Origin` header (headless agents) | `true` |

Single-instance deployments can rely on SQLite (`RELAY_DB_PATH`) for agent-request nonce replay protection and HTTP rate limits. Behind a load balancer, set `RELAY_REDIS_URL`.

MLS group-state and KeyPackage private halves are encrypted client-side via `RELAY_MLS_GROUP_STATE_ENCRYPTION_KEY` in `@khoralabs/relay-mls` — not read by this server binary.

## Tests

```bash
bun test
```

Tests cover DID auth, rate limiting, WebSocket origin policy, KeyPackages, MLS welcome store, and end-to-end channel/session flows.
