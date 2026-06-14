# Channel persistence and opaque relay wire

How the relay stores channel admission and optional blob replay. **Payload bytes are opaque** at this layer — the relay does not parse OBP `Frame` objects.

OBP negotiation semantics (`khora.obp.frame`, `khora.obp.nbc`) live in the OBP packages. This document covers relay infrastructure only.

## Persistence ports

| Concern | TypeScript port | Package |
|---------|-----------------|---------|
| Channel admission (pairing secret, TTL) | `ChannelAdmissionStore` | `@khoralabs/relay-admission` |
| Opaque blob spool (late-join replay) | `BlobSpool` | `@khoralabs/relay-server-http` |
| Live fan-out + echo | `RelayHub` (`createRelayHub`) | `@khoralabs/relay-server-http` |

### ChannelAdmissionStore

```ts
// packages/relay-admission/src/channel-admission.ts
upsertChannelAdmission(record: ChannelAdmissionRecord): void;
getChannelAdmissionIfActive(channelId: string, nowMs: number): ChannelAdmissionRecord | undefined;
purgeExpiredChannels(nowMs: number): number;
purgeChannel(channelId: string): void;
```

SQLite table: `relay_channels` (`channel_id`, encrypted `pairing_secret_hex`, `created_at_ms`, `expires_at_ms`).

### BlobSpool

```ts
// packages/relay-server-http/src/blob-spool.ts
append(channelId: string, blob: Uint8Array, nowMs: number): number;
getBlobsAfter(channelId: string, afterId: number): Array<{ id: number; blob: Uint8Array }>;
getMaxId(channelId: string): number | undefined;
purgeChannel(channelId: string): void;
```

SQLite table: `relay_spool`. Ring-buffer limits per channel (reference defaults):

- **10,000** frames max
- **64 MiB** total bytes max

Oldest rows are dropped when limits are exceeded. Spool is optional per channel (`enableSpool` on channel create).

### RelayHub

`createRelayHub` attaches WebSocket peers, verifies HMAC channel tickets, fans out opaque bytes to all peers **including the sender** (echo), and optionally appends to `BlobSpool`.

## Wire policy

- **No `RelayEnvelope`** — the relay never wraps `{ frame: Frame }`. After MLS decrypt (or on custodial plaintext), bytes follow `khora.obp.frame#NegotiationFrameProtocol` (bare `Frame`, `init`, multiplex). See OBP `mls-hub-protocol.smithy`.
- **MLS profile (internet default):** outer bus `mls2` (`MlsHubEnvelope` with opaque `route`); inner `RelayTimingFrame` (`rt1`) then multiplex. See [multiplex-groups.md](./multiplex-groups.md).
- **Custodial plaintext:** `rt1` + multiplex without MLS.

## Echo rule

Originators **must** apply negotiation `Frame` effects only from **inbound channel bytes** received from the relay (including self-echo), not from the local pre-send path. This keeps DAG advance and counterparty view consistent.

Same behavioral rule as the MLS blob-hub profile in OBP; enforced in client/runtime, not by a hub JSON wrapper.

## HTTP surface

Channel lifecycle (create, join, ticket mint, WS upgrade nonce, session allocate) is documented in `@khoralabs/relay-server-http` README. Wire types for HTTP bodies/responses are in `@khoralabs/relay-contracts` (`channels`, `roster`, `auth-wire`).

## Security

Pairing secret encryption at rest, WS upgrade nonces, Origin policy, and ticket lifetime: [SECURITY.md](../SECURITY.md).
