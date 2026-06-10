# Contributing

Thanks for helping improve `@khoralabs/relay`. This repo is a Bun workspace with packages under `packages/` and deployable apps under `apps/`.

## Prerequisites

- [Bun](https://bun.sh) 1.3+

## Setup

```bash
bun install
```

Husky installs via `prepare`. **pre-commit** runs `check`; **pre-push** runs `check`, `typecheck`, and `test`.

## Before you open a PR

From the repo root:

```bash
bun run check
bun run typecheck
bun run test
```

If you changed public TypeScript APIs, update `CHANGELOG.md` under **Unreleased** (see existing entries for breaking vs additive changes).

## Scope and style

- Match existing patterns in the package you touch; keep diffs focused.
- Use Bun for scripts and tests (`bun test`), not Jest/Vitest.
- Biome handles formatting; the VS Code Biome extension is listed in `.vscode/extensions.json`.
- Do not commit secrets (`.env`, API keys). Do not commit generated `dist/` unless a release workflow requires it.

## Documentation

User-facing docs live in package READMEs. When behavior is normative (auth wire format, admission policy, session lifecycle), update the relevant spec or guide rather than only inline comments.

## Questions

Open a [GitHub issue](https://github.com/khoralabs/relay/issues) for design questions or bugs. For security issues, see [SECURITY.md](SECURITY.md).
