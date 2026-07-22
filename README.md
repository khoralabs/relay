# @khoralabs/relay

A DID-authenticated encrypted blob transport framework — client, server, and contracts.

The relay provides a generic, deployable hub for opaque encrypted byte streams authenticated via [Decentralized Identifiers (DIDs)](https://www.w3.org/TR/did-core/). It is the network transport layer for [OBP/NBC](https://github.com/khoralabs/obp) sessions on the Khora network, but is designed to be used independently of any product.

## Packages

| Package | Description |
|---|---|
| [`packages/relay`](packages/relay) (`@khoralabs/relay`) | Unified library: client, crypto, contracts, admission, MLS, server, testing |

### Entrypoints

| Import | Role |
|---|---|
| `@khoralabs/relay` / `./client` | TypeScript client SDK |
| `@khoralabs/relay/crypto` | DID utilities, encoding, signing, pairing-secret encryption |
| `@khoralabs/relay/contracts` | Shared wire types |
| `@khoralabs/relay/admission` | Pairing secrets, HMAC tickets, WS upgrade nonces |
| `@khoralabs/relay/mls` | RFC 9420 MLS groups and KeyPackage pool |
| `@khoralabs/relay/server` | Bun HTTP + WebSocket server library |
| `@khoralabs/relay/testing` | Server test helpers |

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

### Migration from split packages

```ts
"@khoralabs/relay-client"              → "@khoralabs/relay/client" // or "@khoralabs/relay"
"@khoralabs/relay-crypto"              → "@khoralabs/relay/crypto"
"@khoralabs/relay-contracts"           → "@khoralabs/relay/contracts"
"@khoralabs/relay-mls"                 → "@khoralabs/relay/mls"
"@khoralabs/relay-admission"           → "@khoralabs/relay/admission"
"@khoralabs/relay-server-http"         → "@khoralabs/relay/server"
"@khoralabs/relay-server-http/testing" → "@khoralabs/relay/testing"
```

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting and deployment hardening notes.
