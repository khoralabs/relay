# Security policy

## Supported versions

Security fixes are applied to the latest release on the default branch. Older major/minor lines may not receive backports unless noted in release notes.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive reports.

1. Use [GitHub private vulnerability reporting](https://github.com/khoralabs/relay/security/advisories/new) for this repository, if enabled, **or**
2. Contact the maintainers through your organization's usual secure channel if you are an internal contributor.

Include:

- A clear description of the issue and impact
- Steps to reproduce or a minimal proof of concept
- Affected package versions and commit SHA if known

We aim to acknowledge reports within a few business days and will coordinate disclosure timing with you.

## Scope notes

This repository provides a DID-authenticated blob transport framework (contracts, server, client). It does **not** provide end-user authentication or production KMS integration by itself. Hosts remain responsible for protecting persistence backends, transport credentials, and product-specific policy enforcement.

### Channel pairing secrets (`channels.pairing_secret_hex`)

`@khoralabs/relay-crypto` **encrypts channel pairing secrets at rest** with AES-256-GCM before `@khoralabs/relay-admission` writes them to SQLite (`relay_rooms`). Hosts **must** supply a 32-byte key (from KMS or `RELAY_PAIRING_SECRET_ENCRYPTION_KEY`). In production the env var must be **64-character hex** or **base64url encoding 32 bytes** — passphrase-style strings are rejected. Dev may use a passphrase (derived via HKDF-SHA256). SQLCipher whole-file encryption is complementary, not a substitute — field encryption limits blast radius when only the DB file is copied without the field key.

Production deployments **should**:

1. Set `RELAY_PAIRING_SECRET_ENCRYPTION_KEY` to a random 32-byte key (hex or base64url) when starting the relay (`relay-server-http` `createChannelAdmissionStoreFromEnv` reads it automatically).
2. Restrict relay DB, `-wal`, and `-shm` files to owner-only (`0o600`).
3. Rotate or purge expired channels so stale admission rows do not accumulate.

Anyone with **both** the database file and the field encryption key can still mint valid tickets for active channels; protect keys separately from backups and restrict process/runtime access.

### WebSocket admission

WebSocket connections require a **one-time upgrade nonce** minted by an authorized channel member via DID-signed HTTP (`POST /v1/channels/:id/ws-nonce`, or bundled in create/join/ticket responses). The nonce is consumed on upgrade; replay with the same nonce fails. Nonce TTL is **60 seconds** (`DEFAULT_WS_UPGRADE_NONCE_TTL_MS` in `@khoralabs/relay-admission`). Clients pass the nonce via `Sec-WebSocket-Protocol` (`relay.nonce.<nonce>`) or `X-Relay-Upgrade-Nonce` — not via the HMAC ticket field in JSON responses.

After a successful upgrade, the hub mints an HMAC **channel ticket** server-side and binds it to the WebSocket peer. That ticket is **reusable until the channel `expiresAtMs`** — there is no per-ticket TTL or single-use rotation today. Treat stolen tickets as valid for the remaining channel lifetime.

**Ingress limits:** each channel enforces per-minute caps on WebSocket frame count and total bytes (`RELAY_RL_WS_FRAMES_PER_MIN_PER_CHANNEL`, default 1200; `RELAY_RL_WS_BYTES_PER_MIN_PER_CHANNEL`, default 1 MiB). Single-frame size is capped at **64 KiB** (`MAX_RELAY_WS_FRAME_BYTES`).

**Origin policy** (cross-site WebSocket hijacking):

- `RELAY_WS_ALLOW_MISSING_ORIGIN` — default `true`. Headless agents and `relay-client` typically send **no `Origin` header**; they continue to work with zero configuration.
- `RELAY_WS_ALLOWED_ORIGINS` — comma-separated allowlist (e.g. `https://app.example.com`). When a browser sends `Origin`, it must match the allowlist exactly (normalized to URL origin). **Empty allowlist + present `Origin` → reject** (blocks browser CSWSH by default).
- Browser-facing relays must list every trusted web origin explicitly. Peers do not need to coordinate origins with each other — `Origin` names the web page that opened the socket, not the peer identity.

IP rate limits apply to the upgrade path. Use TLS termination when upgrades are served over HTTPS.

**Not yet implemented:** admission knobs such as `singleUseTickets`, per-ticket `ticketTtlMs`, or `rotateOnMint` for hub tickets.

### DID-signed HTTP requests

All HTTP endpoints except `/health` require a DID-signed request envelope. Hosts **must** verify the signing DID matches an authorized principal for the resource being accessed. The relay does not maintain a global trust registry — channel membership determines authorization.

**Replay protection and rate limits** use the relay SQLite database by default (`agent_request_nonces`, `rate_limit_counters` on `RELAY_DB_PATH`). That survives process restart on a **single instance**.

**Multiple instances behind a load balancer** must set `RELAY_REDIS_URL` so nonce replay protection and HTTP rate limits share state across pods. Without Redis, a captured signed request can be replayed against a different instance, and per-DID/IP limits reset per process. SQLite on separate DB files per pod does **not** coordinate across instances.

**MLS KeyPackage fetch** (`GET /v1/key-packages/:did`) requires DID-signed auth and per-requester rate limits. Each successful fetch claims one KeyPackage from the peer's pool. The relay cannot mint keys — hosts should run `@khoralabs/relay-mls` `KeyPackageManager` (via `RelayClient.createKeyPackageManager`) to poll `GET /v1/key-packages/status` and append packages via `POST /v1/key-packages/batch` before the pool is depleted.

**MLS Welcome store** (`POST/GET .../sessions/:id/mls-welcome`) holds opaque Welcome blobs and the per-session bus `route` handle (`mls2`). Only the session initiator may publish; session parties may fetch once (delete-on-read). Rows are also removed on session release and when channels expire.

**Two integration profiles (no in-band negotiation):** `MlsChannelConnection` (`@khoralabs/relay-mls`) uses RFC 9420 MLS inside `khora.obp.frame.mls#MlsHubEnvelope` (`mls2` with opaque `route` on the bus). `connectRelay` / `connectTimedRelay` (`@khoralabs/relay-client`) send plaintext bytes; `connectTimedRelay` wraps payloads in `RelayTimingFrame` (`rt1`) with HLC. The hub forwards opaque blobs in all cases.

**MLS group state at rest:** Persisted MLS group bytes (`encodeGroupState`) contain ratchet secrets. Use `createEncryptingMlsStatePersistence` or `createFileMlsStatePersistence` with `RELAY_MLS_GROUP_STATE_ENCRYPTION_KEY` (32-byte hex or base64url in production). Plain `MemoryMlsStatePersistence` is for tests only.

**MLS KeyPackage private halves:** `KeyPackageManager` persists private state through the same encrypted `MlsStatePersistenceAdapter` when configured. A local last-resort KeyPackage is kept and re-appended to the relay pool when depleted so joins can proceed after restart.

IP-based rate limits use the socket peer address by default. Set `RELAY_TRUSTED_PROXY=1` only when the relay sits behind a trusted reverse proxy or load balancer that strips client-supplied forwarding headers and appends the real client IP. Without this flag, `X-Forwarded-For` and `X-Real-IP` are ignored so clients cannot spoof their IP to evade limits.
