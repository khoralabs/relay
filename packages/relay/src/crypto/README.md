# @khoralabs/relay-crypto

Cryptographic primitives for the relay: DID parsing, ed25519 signing, encoding helpers, and AES-256-GCM field encryption for channel pairing secrets at rest.

## Install

```bash
bun add @khoralabs/relay-crypto
```

## API

| Export | Description |
|---|---|
| `ed25519PublicKeyBytesFromDid` | Extract raw public key bytes from a `did:key` DID |
| `base58Decode` / `base58Encode` / `bytesToHex` / `hexToBytes` / `bytesToBase64Url` / `base64UrlToBytes` | Encoding helpers (`@scure/base`, `@noble/hashes`) |
| `RelaySigner` / `PersistableRelaySigner` | Signing interface and persistable variant |
| `encryptPairingSecretHex` / `decryptPairingSecretHex` / `isEncryptedPairingSecret` | AES-256-GCM envelope for pairing secrets stored in SQLite |
| `pairingSecretKeyFromEnv` / `pairingSecretKeyFromHex` / `pairingSecretKeyFromBase64Url` / `pairingSecretKeyFromPassphrase` | Derive the 32-byte field encryption key from `RELAY_PAIRING_SECRET_ENCRYPTION_KEY` |
| `PAIRING_SECRET_ENCRYPTION_KEY_ENV` | Env var name (`RELAY_PAIRING_SECRET_ENCRYPTION_KEY`) |

MLS KeyPackage generation and group-state encryption live in `@khoralabs/relay-mls`, not this package.

Built on [@noble/curves](https://github.com/paulmillr/noble-curves) and [@noble/ed25519](https://github.com/paulmillr/noble-ed25519).
