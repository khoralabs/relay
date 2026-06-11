# @khoralabs/relay-crypto

Cryptographic primitives for the relay: DID parsing, ed25519 signing, X3DH key exchange, and prekey management.

## Install

```bash
bun add @khoralabs/relay-crypto
```

## API

| Export | Description |
|---|---|
| `ed25519PublicKeyBytesFromDid` | Extract raw public key bytes from a `did:key` DID |
| `base58Decode` / `bytesToHex` / `hexToBytes` | Encoding helpers |
| `RelaySigner` / `PersistableRelaySigner` | Signing interface and persistable variant |
| `buildX3dhInitiator` / `deriveX3dhResponder` | X3DH key exchange (initiator and responder sides) |
| `generateSignedPreKey` / `generateOneTimePreKeys` | Prekey generation |
| `verifySignedPreKey` | Signed prekey verification |
| `parsePreKeyBundle` / `parsePublishPreKeyBundleBody` / `parseX3dhInitMessage` | Prekey message parsing |

Built on [@noble/curves](https://github.com/paulmillr/noble-curves) and [@noble/ed25519](https://github.com/paulmillr/noble-ed25519).
