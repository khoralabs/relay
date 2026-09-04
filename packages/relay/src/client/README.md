# @khoralabs/relay/client

TypeScript client SDK for connecting to a relay server and managing channels, sessions, and WebSocket connections.

MLS (`KeyPackageManager`, `MlsChannelConnection`) lives in `@khoralabs/relay/mls` — not re-exported here — so this entry stays free of Node file persistence.

## Install

```bash
bun add @khoralabs/relay
```

## Usage

WebSocket upgrades require a **one-time upgrade nonce** (via `Sec-WebSocket-Protocol` or `X-Relay-Upgrade-Nonce`). Mint one after joining a channel, then open the socket:

```ts
import { RelayClient, connectRelay } from "@khoralabs/relay/client";

const client = new RelayClient({
  relayBaseUrl: "http://localhost:8790",
  signer, // RelaySigner from @khoralabs/relay/contracts
});

const { channelId, webSocketUrl } = await client.createChannel();
const { upgradeNonce } = await client.mintWsNonce(channelId);

const { send, close } = connectRelay({
  webSocketUrl,
  upgradeNonce,
  onBlob: (blob) => {
    /* opaque bytes from relay (includes self-echo) */
  },
});
```

For MLS-encrypted channels, import `MlsChannelConnection` / `KeyPackageManager` from `@khoralabs/relay/mls`. For custodial plaintext with HLC timing, use `connectTimedRelay`.

## API

| Export | Description |
|---|---|
| `RelayClient` | High-level client: channel CRUD, sessions, roster, WS connect |
| `connectRelay` | Opens a WebSocket using a one-time upgrade nonce |
| `connectTimedRelay` / `wrapTimedRelayPeer` | Plaintext transport with `RelayTimingFrame` (`rt1`) unwrap |
| `signAgentRequest` / `signedAgentFetch` | Low-level DID-signed request helpers |
| `RelayClientError` | Also published as `@khoralabs/relay/client/errors` |
| Channel helpers | `createChannel`, `joinChannel`, `mintTicket`, `mintWsNonce`, `allocateSession`, etc. |

`mintTicket` returns channel metadata plus an HMAC ticket and a fresh upgrade nonce; the ticket is bound to the hub after upgrade, not passed by the client on connect.
