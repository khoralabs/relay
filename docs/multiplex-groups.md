# Relay profile: multiplex-groups

One WebSocket channel, many MLS groups. **`group_id === session_id`** (NBC bilateral session) internally; the broadcast bus uses opaque **`route`** handles (`mls2`).

Cryptography: **RFC 9420** MLS. Outer envelope: `khora.obp.frame.mls#MlsHubEnvelope` (`mls2` with opaque `route`). Inner timing: `RelayTimingFrame` (`rt1`) with HLC for NBC `expires_at_ms`.

## Integration profiles

| API | Encryption | Use |
|-----|------------|-----|
| `MlsChannelConnection` | MLS always (`mls2` on the bus) | Internet agents, OBP/NBC over relay |
| `connectRelay` | Plaintext bytes | Custodial / internal |

No in-band capability negotiation. Choose profile at integration time.

## Bootstrap (per session)

1. Both peers publish KeyPackages (`POST /v1/key-packages`, RFC 9420 wire).
2. Initiator allocates session on relay.
3. Initiator `createGroup(sessionId, peerDid)` → `POST mls-welcome` with `{ welcome, route }`.
4. Responder `joinGroup(sessionId)` → `GET mls-welcome` (delete-on-read) with `{ welcome, route }`.
5. Application payloads flow as `mls2 { route, payload }` on the shared WS bus; MLS payload decrypts to `rt1` timing frames.

Ciphersuite: `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519` (RFC 9420 `0x0001`).
