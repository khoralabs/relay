# @khoralabs/relay-client

TypeScript client SDK for connecting to a relay server and managing channels, sessions, and WebSocket connections.

## Install

```bash
bun add @khoralabs/relay-client
```

## Usage

```ts
import { RelayClient, connectRelay } from "@khoralabs/relay-client";

const client = new RelayClient({
  baseUrl: "http://localhost:8790",
  signer, // RelaySigner from @khoralabs/relay-crypto
});

// Create or join a channel, then open a WebSocket connection
const ticket = await client.mintTicket(channelId);
const { send, close } = await connectRelay({ url, ticket });
```

## API

| Export | Description |
|---|---|
| `RelayClient` | High-level client: channel CRUD, sessions, roster, prekeys |
| `connectRelay` | Opens an authenticated WebSocket connection |
| `signAgentRequest` / `signedAgentFetch` | Low-level DID-signed request helpers |
| Channel helpers | `createChannel`, `joinChannel`, `mintTicket`, `mintWsNonce`, etc. |
