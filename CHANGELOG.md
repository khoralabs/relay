# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- DID parse (`ed25519PublicKeyBytesFromDid`) and signer types now come from `@khoralabs/did-key-identity` `^0.2.0`. `@khoralabs/relay/crypto` re-exports the DID helper; `RelaySigner` / `PersistableRelaySigner` are type aliases. Testing helpers use `didKeyFromEd25519PublicKey`.
- **Breaking:** Consolidated `@khoralabs/relay-{crypto,contracts,admission,mls,client,server-http}` into a single publishable package `@khoralabs/relay` with subpath exports (`./client`, `./crypto`, `./contracts`, `./admission`, `./mls`, `./server`, `./testing`). See root README for the import migration map.
- Added npm build/publish scripts and `.github/workflows/release.yml`.

### Added

- Initial scaffold: `package.json` workspace, `biome.json`, `tsconfig.json`, Husky hooks, VS Code config.
- OSS docs: `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`.
