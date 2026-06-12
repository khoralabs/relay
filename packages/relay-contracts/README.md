# @khoralabs/relay-contracts

Shared TypeScript types used by both the relay server and client. Runtime dependencies are limited to `@khoralabs/relay-crypto` (signer type only).

## Contents

| Module | Description |
|---|---|
| `auth-wire` | `Agent-Request` header format and DID auth wire types |
| `channels` | Channel create/join, tickets, WS upgrade nonces, session allocate/release |
| `roster` | Actor registration and roster response types |
| `key-packages` | MLS KeyPackage pool publish/append/fetch wire types |
| `mls-welcome` | MLS Welcome publish/fetch wire types (opaque blob + `route` handle) |
| `relay-crypto-profile` | MLS envelope version (`mls2`), ciphersuite name/id |
| `relay-timing` / `relay-timing-layer` | `RelayTimingFrame` (`rt1`) encode/decode and `withTiming` helper |
| `relay-hlc` | Hybrid logical clock types for peer timing |

## Persistence ports (relay infrastructure)

Relay persistence is **opaque bytes** — not OBP graph semantics. Implementations live outside this package:

| Port | Package | Role |
|------|---------|------|
| `ChannelAdmissionStore` | `@khoralabs/relay-admission` | Channel pairing secrets + TTL (`relay_rooms`) |
| `BlobSpool` | `@khoralabs/relay-server-http` | Per-channel blob replay spool (`relay_spool`) |
| `RelayHub` | `@khoralabs/relay-server-http` | WS attach, ticket verify, fan-out, echo |

Full mapping and spool limits: [docs/channel-persistence.md](../../docs/channel-persistence.md).

HTTP API types for channel create/join/ticket/ws-nonce are in the `channels` module. Server handlers: `@khoralabs/relay-server-http`.

## OBP wire (peer agreement)

Negotiation `Frame`, MLS hub envelopes (`mls2`), and NBC timing are defined in OBP (`@khoralabs/obp-frames-impl`, `khora.obp.frame.mls`). The relay forwards blobs; clients decode OBP after MLS/timing unwrap.

## Install

```bash
bun add @khoralabs/relay-contracts
```
