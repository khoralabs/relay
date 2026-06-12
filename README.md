# @khoralabs/relay

A DID-authenticated encrypted blob transport framework — client, server, and contracts.

The relay provides a generic, deployable hub for opaque encrypted byte streams authenticated via [Decentralized Identifiers (DIDs)](https://www.w3.org/TR/did-core/). It is the network transport layer for [OBP/NBC](https://github.com/khoralabs/obp) sessions on the Khora network, but is designed to be used independently of any product.

## Packages

| Package | Description |
|---|---|
| `packages/relay-contracts` | Shared TypeScript types for auth wire, channels, sessions, roster, MLS key packages, and welcome store |
| `packages/relay-crypto` | DID utilities, encoding, ed25519 signing, pairing-secret field encryption |
| `packages/relay-admission` | Channel pairing secrets, HMAC tickets, and one-time WebSocket upgrade nonces |
| `packages/relay-mls` | RFC 9420 MLS groups, KeyPackage pool client, `MlsChannelConnection`, encrypted group-state persistence |
| `packages/relay-server-http` | Bun HTTP + WebSocket relay server library (channel management, blob spool, DID auth, rate limits) |
| `packages/relay-client` | TypeScript client SDK for connecting to a relay and managing sessions |

## Apps

| App | Description |
|---|---|
| `apps/relay-server` | Standalone relay server binary with SQLite persistence |

## Getting started

```bash
bun install
```

Run all checks before committing:

```bash
bun run check
bun run typecheck
bun run test
```

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting and deployment hardening notes.
