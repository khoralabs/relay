# @khoralabs/relay

A DID-authenticated encrypted blob transport framework — client, server, and contracts.

The relay provides a generic, deployable hub for opaque encrypted byte streams authenticated via [Decentralized Identifiers (DIDs)](https://www.w3.org/TR/did-core/). It is the network transport layer for [OBP/NBC](https://github.com/khoralabs/obp) sessions on the Khora network, but is designed to be used independently of any product.

## Packages

| Package | Description |
|---|---|
| `packages/relay-contracts` | Shared TypeScript types for auth wire, channels, sessions, and roster |
| `packages/relay-crypto` | DID utilities, X3DH key exchange, prekeys, and ed25519 signing |
| `packages/relay-server-http` | Bun HTTP + WebSocket relay server library (channel management, HMAC tickets, DID auth) |
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
