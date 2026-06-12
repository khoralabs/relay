# @khoralabs/relay-server-http

Server library providing the HTTP + WebSocket relay implementation. Consumed by `apps/relay-server`; importable as a library to embed in other Bun servers.

## Exports

### Main (`@khoralabs/relay-server-http`)

| Export | Description |
|---|---|
| `createRelayApp` | Builds the `fetch` + `websocket` handlers for `Bun.serve` |
| `createRelayHub` | In-memory WebSocket hub with blob spool support |
| `createChannelRegistry` | SQLite-backed channel/session/roster store |
| `openRelayDatabase` | Opens the SQLCipher SQLite database |
| `createRelayStores` | Creates admission store + blob spool from an open DB |
| `loadRelayProfile` | Reads `RELAY_MODE` env to produce a `pool` or `single` profile |
| `bootstrapSingleChannel` | Seeds a single channel on startup (single mode) |
| `createRelayAuth` | DID-signed request verifier |
| `createNonceStore` / `createSqliteNonceStore` | Pluggable agent-request nonce replay store (SQLite, Redis, in-memory) |
| `createInMemoryRateLimiter` / `createRelayRateLimiters` | HTTP rate limiting (SQLite, Redis, or in-memory backends) |
| `createBlobSpool` | SQLite-backed blob replay store |

### Testing (`@khoralabs/relay-server-http/testing`)

Helpers for spinning up in-process relay instances in tests (`test-app.ts`, `test-db.ts`, `test-sign.ts`).

## HTTP API

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/v1/channels` | Create channel (pool mode) |
| POST | `/v1/channels/join` | Join via invite token |
| POST | `/v1/channels/:id/ticket` | Mint HMAC WebSocket ticket |
| POST | `/v1/channels/:id/join-tokens` | Mint join token |
| POST | `/v1/channels/:id/ws-nonce` | Mint one-time WS upgrade nonce |
| GET | `/v1/channels/:id/ws` | WebSocket upgrade |
| POST | `/v1/channels/:id/sessions/allocate` | Allocate session |
| GET | `/v1/channels/:id/sessions/:sessionId` | Session status |
| POST | `/v1/channels/:id/sessions/:sessionId/release` | Release session |
| POST | `/v1/channels/:id/actor` | Register actor |
| GET | `/v1/channels/:id/roster` | Get roster |
| POST | `/v1/prekeys` | Publish prekey bundle |
| GET | `/v1/prekeys/status` | Own bundle status (remaining OTKs; no claim) |
| POST | `/v1/prekeys/otks` | Append one-time prekeys to existing bundle |
| GET | `/v1/prekeys/:did` | Fetch prekey bundle (claims one OTK; DID-signed) |

All endpoints except `/health` require a DID-signed `Agent-Request` header.
