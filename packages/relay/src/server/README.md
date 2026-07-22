# @khoralabs/relay-server-http

Server library providing the HTTP + WebSocket relay implementation. Consumed by `apps/relay-server`; importable as a library to embed in other Bun servers.

## Exports

### Main (`@khoralabs/relay-server-http`)

| Export | Description |
|---|---|
| `createRelayApp` | Builds the `fetch` + `websocket` handlers for `Bun.serve` |
| `createRelayHub` | In-memory WebSocket hub with optional blob spool |
| `createChannelRegistry` | SQLite-backed channel/session/roster/KeyPackage/Welcome store |
| `openRelayPersistence` / `sqliteBackend` / `redisBackend` / `memoryBackend` | Open `RelayPersistence` from strategy material (no Database handles) |
| `createRelayStores` | Low-level: compose persistence from an already-open SQLite `Database` |
| `loadRelayProfile` | Reads `RELAY_MODE` env to produce a `pool` or `single` profile |
| `bootstrapSingleChannel` | Seeds a single channel on startup (single mode) |
| `createRelayAuth` | DID-signed request verifier (requires `nonceStore`) |
| `createSqliteNonceStore` / `createInMemoryNonceStore` | Direct nonce store constructors |
| `createRelayRateLimiters` | HTTP rate limiting via `RelayPersistence.createRateLimiter` |
| `createRelayIngressLimiter` / `createChannelIngressLimiter` | Per-channel WebSocket ingress byte/frame limits |
| `createBlobSpool` | SQLite-backed blob replay store |
| `checkWsUpgradeOrigin` / `wsOriginPolicyFromEnv` | Browser WebSocket origin policy |
| `relayHubWebSocketHandlers` | WebSocket handler bundle for custom `Bun.serve` wiring |

### Testing (`@khoralabs/relay-server-http/testing`)

Helpers for spinning up in-process relay instances in tests (`createTestRelayApp`, signing helpers). Pass `persistence` to inject a strategy; omit it for an ephemeral default.

## HTTP API

All endpoints except `/health` require a DID-signed `Agent-Request` header.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check (no auth) |
| POST | `/v1/channels` | Create channel (pool mode only; `501` in single mode) |
| POST | `/v1/channels/join` | Join via invite token |
| POST | `/v1/channels/:id/ticket` | Mint HMAC ticket + fresh WS upgrade nonce for a member |
| POST | `/v1/channels/:id/join-tokens` | Mint invite join token |
| POST | `/v1/channels/:id/ws-nonce` | Mint one-time WS upgrade nonce |
| GET | `/v1/channels/:id/ws` | WebSocket upgrade (requires consumed upgrade nonce) |
| POST | `/v1/channels/:id/sessions/allocate` | Allocate session between two channel members |
| GET | `/v1/channels/:id/sessions/:sessionId` | Session allocation status |
| POST | `/v1/channels/:id/sessions/:sessionId/release` | Release session |
| POST | `/v1/channels/:id/sessions/:sessionId/mls-welcome` | Publish MLS Welcome (initiator only) |
| GET | `/v1/channels/:id/sessions/:sessionId/mls-welcome` | Fetch MLS Welcome once (delete-on-read; session parties only) |
| POST | `/v1/channels/:id/actor` | Register actor pubkey on roster |
| GET | `/v1/channels/:id/roster` | Get roster |
| POST | `/v1/key-packages` | Publish initial MLS KeyPackage pool |
| GET | `/v1/key-packages/status` | Own pool status (remaining count; no claim) |
| POST | `/v1/key-packages/batch` | Append KeyPackages to existing pool |
| GET | `/v1/key-packages/:did` | Fetch one KeyPackage (claims from pool; DID-signed) |

### WebSocket upgrade flow

1. Authorized member mints a one-time nonce (`POST .../ws-nonce`, or included in create/join/ticket responses).
2. Client opens `GET .../ws` with the nonce in `Sec-WebSocket-Protocol` (`relay.nonce.<nonce>`) or `X-Relay-Upgrade-Nonce`.
3. Hub consumes the nonce, mints an HMAC channel ticket server-side, and attaches the peer.
4. Optional `?replayAfter=<blobId>` replays spooled blobs when the channel has `enableSpool`.

The HMAC `ticket` returned by create/join/ticket endpoints documents channel binding; clients do not send it on upgrade.
