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

`@khoralabs/relay-crypto` **encrypts channel pairing secrets at rest** with AES-256-GCM before `@khoralabs/relay-admission` writes them to SQLite (`relay_rooms`). Hosts **must** supply a 32-byte key (from KMS or `RELAY_PAIRING_SECRET_ENCRYPTION_KEY`). SQLCipher whole-file encryption is complementary, not a substitute — field encryption limits blast radius when only the DB file is copied without the field key.

Production deployments **should**:

1. Set `RELAY_PAIRING_SECRET_ENCRYPTION_KEY` when starting the relay (`relay-server-http` `createChannelAdmissionStoreFromEnv` reads it automatically).
2. Restrict relay DB, `-wal`, and `-shm` files to owner-only (`0o600`).
3. Rotate or purge expired channels so stale admission rows do not accumulate.

Anyone with **both** the database file and the field encryption key can still mint valid tickets for active channels; protect keys separately from backups and restrict process/runtime access.

### WebSocket admission

The relay WebSocket upgrade handler verifies HMAC tickets but does **not** enforce `Origin`, TLS, or rate limits by default. Browser-facing relays **must** configure `allowedOrigins` — ticket-only admission does not prevent cross-site WebSocket CSRF. Use TLS termination when upgrades are served over HTTPS.

Hub tickets are **reusable until channel expiry** unless admission policy enables `singleUseTickets`, `ticketTtlMs`, or `rotateOnMint`. Treat stolen tickets as valid for the remaining window; use short TTLs or one-time nonces when admission must not be replayable.

### DID-signed HTTP requests

All mutating HTTP endpoints require a DID-signed request envelope. Hosts **must** verify the signing DID matches an authorized principal for the resource being accessed. The relay does not maintain a global trust registry — channel membership determines authorization.
