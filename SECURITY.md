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

WebSocket connections require a **one-time upgrade nonce** minted by an authorized channel member via DID-signed HTTP (`POST /v1/channels/:id/ws-nonce`). The nonce is consumed on upgrade; replay with the same nonce fails. Nonce TTL is fixed by the registry (default 60s).

After a successful upgrade, the hub issues an HMAC **channel ticket** bound to the channel pairing secret. That ticket is **reusable until the channel `expiresAtMs`** — there is no per-ticket TTL or single-use rotation today. Treat stolen tickets as valid for the remaining channel lifetime.

**Origin policy** (cross-site WebSocket hijacking):

- `RELAY_WS_ALLOW_MISSING_ORIGIN` — default `true`. Headless agents and `relay-client` typically send **no `Origin` header**; they continue to work with zero configuration.
- `RELAY_WS_ALLOWED_ORIGINS` — comma-separated allowlist (e.g. `https://app.example.com`). When a browser sends `Origin`, it must match the allowlist exactly (normalized to URL origin). **Empty allowlist + present `Origin` → reject** (blocks browser CSWSH by default).
- Browser-facing relays must list every trusted web origin explicitly. Peers do not need to coordinate origins with each other — `Origin` names the web page that opened the socket, not the peer identity.

IP rate limits apply to the upgrade path. Use TLS termination when upgrades are served over HTTPS.

**Not yet implemented:** admission knobs such as `singleUseTickets`, per-ticket `ticketTtlMs`, or `rotateOnMint` for hub tickets.

### DID-signed HTTP requests

All mutating HTTP endpoints require a DID-signed request envelope. Hosts **must** verify the signing DID matches an authorized principal for the resource being accessed. The relay does not maintain a global trust registry — channel membership determines authorization.

**Replay protection and rate limits** use the relay SQLite database by default (`agent_request_nonces`, `rate_limit_counters` on `RELAY_DB_PATH`). That survives process restart on a **single instance**.

**Multiple instances behind a load balancer** must set `RELAY_REDIS_URL` so nonce replay protection and HTTP rate limits share state across pods. Without Redis, a captured signed request can be replayed against a different instance, and per-DID/IP limits reset per process. SQLite on separate DB files per pod does **not** coordinate across instances.

**Prekey fetch** (`GET /v1/prekeys/:did`) requires DID-signed auth and per-requester rate limits. Each successful fetch claims one one-time prekey; responses include `remainingOneTimePreKeys` and `oneTimePreKeyDepleted` when the SPK-only X3DH path applies. The relay cannot mint keys — hosts should run `@khoralabs/relay-client` `PreKeyManager` (or equivalent) to poll `GET /v1/prekeys/status` and append OTKs via `POST /v1/prekeys/otks` before the pool is exhausted.

IP-based rate limits use the socket peer address by default. Set `RELAY_TRUSTED_PROXY=1` only when the relay sits behind a trusted reverse proxy or load balancer that strips client-supplied forwarding headers and appends the real client IP. Without this flag, `X-Forwarded-For` and `X-Real-IP` are ignored so clients cannot spoof their IP to evade limits.
