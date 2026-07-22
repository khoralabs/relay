# @khoralabs/relay

DID-authenticated encrypted blob transport — client SDK, Bun HTTP/WebSocket server, contracts, crypto, admission, and MLS.

## Entrypoints

| Import | Role |
| --- | --- |
| `@khoralabs/relay` / `@khoralabs/relay/client` | TypeScript client SDK |
| `@khoralabs/relay/crypto` | DID utilities, encoding, ed25519 signing, pairing-secret encryption |
| `@khoralabs/relay/contracts` | Shared wire types (auth, channels, roster, MLS key packages, welcome) |
| `@khoralabs/relay/admission` | Channel pairing secrets, HMAC tickets, WS upgrade nonces |
| `@khoralabs/relay/mls` | RFC 9420 MLS groups, KeyPackage pool, `MlsChannelConnection` |
| `@khoralabs/relay/server` | Bun HTTP + WebSocket relay server library |
| `@khoralabs/relay/testing` | In-process test helpers for the server |

`./server` requires Bun and optional peer `@khoralabs/sqlite-crypto`.

## Migration from split packages

```ts
"@khoralabs/relay-client"              → "@khoralabs/relay/client" // or "@khoralabs/relay"
"@khoralabs/relay-crypto"              → "@khoralabs/relay/crypto"
"@khoralabs/relay-contracts"           → "@khoralabs/relay/contracts"
"@khoralabs/relay-mls"                 → "@khoralabs/relay/mls"
"@khoralabs/relay-admission"           → "@khoralabs/relay/admission"
"@khoralabs/relay-server-http"         → "@khoralabs/relay/server"
"@khoralabs/relay-server-http/testing" → "@khoralabs/relay/testing"
```
