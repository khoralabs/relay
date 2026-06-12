# Relay profile: multiplex-groups

One WebSocket channel, many MLS groups. **`group_id === session_id`** (NBC bilateral session).

## APIs

| API | Encryption | Use |
|-----|------------|-----|
| `MlsChannelConnection` | MLS always (`mls1` envelopes) | Internet agents, OBP/NBC over relay |
| `connectRelay` | Plaintext bytes | Custodial / internal |

No `mode` flag or in-band capability negotiation.

## Bootstrap (per session)

1. Both peers publish KeyPackages (`POST /v1/key-packages`).
2. Initiator allocates session on relay.
3. Initiator `createGroup(sessionId, peerDid)` → `POST mls-welcome`.
4. Responder `joinGroup(sessionId)` → `GET mls-welcome`.
5. Application payloads flow as `mls1 { groupId, payload }` on the shared WS bus.

Ciphersuite: `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519` (library constant in `@khoralabs/relay-mls`).
