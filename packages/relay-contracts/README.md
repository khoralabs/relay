# @khoralabs/relay-contracts

Shared TypeScript types used by both the relay server and client. No runtime dependencies beyond `@khoralabs/relay-crypto`.

## Contents

| Module | Description |
|---|---|
| `auth-wire` | `Agent-Request` header format and DID auth wire types |
| `channels` | Channel creation, join, ticket, and session types |
| `roster` | Actor registration and roster response types |
| `relay-timing` | `RelayTimingFrame` (`rt1`) encode/decode for HLC peer timing |
| `relay-crypto-profile` | MLS / plaintext integration profile constants |

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
