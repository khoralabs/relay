# Relay profile: multiplex-groups

One WebSocket channel, many MLS groups. **`group_id === session_id`** (NBC bilateral session).

Cryptography: **RFC 9420** MLS. Outer envelope: `khora.obp.frame.mls#MlsHubEnvelope` (`mls1`). Inner timing: `RelayTimingFrame` (`rt1`) with HLC for NBC `expires_at_ms`. The relay **never** wraps bare `Frame` in `{ frame }` — inner multiplex uses OBP `Frame` directly after MLS decrypt (see [channel-persistence.md](./channel-persistence.md)).

## Integration profiles

| API | Encryption | Use |
|-----|------------|-----|
| `MlsChannelConnection` | MLS always (`mls1`) | Internet agents, OBP/NBC over relay |
| `connectRelay` | Plaintext bytes | Custodial / internal |

No in-band capability negotiation. Choose profile at integration time.

## Bootstrap (per session)

1. Both peers publish KeyPackages (`POST /v1/key-packages`, RFC 9420 wire).
2. Initiator allocates session on relay.
3. Initiator `createGroup(sessionId, peerDid)` → `POST mls-welcome`.
4. Responder `joinGroup(sessionId)` → `GET mls-welcome`.
5. Application payloads flow as `mls1 { groupId, payload }` on the shared WS bus; MLS payload decrypts to `rt1` timing frames.

Ciphersuite: `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519` (RFC 9420 `0x0001`).
