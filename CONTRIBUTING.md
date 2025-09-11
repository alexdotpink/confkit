# Contributing to Confkit

Thanks for your interest in contributing! This repo is a Bun + Turborepo monorepo with packages under `packages/*`, a docs app under `apps/docs`, and examples under `examples/*`.

## Quick Start

- Requirements: Node >= 18, Bun (repo uses `packageManager: bun@…`), Git, pnpm/yarn optional.
- Install: `bun install`
- Build all: `bun run build` (or just packages: `bun run build:packages`)
- Run tests: `bun run test` (watch: `bun run test:watch`, coverage: `bun run coverage`)
- Lint/format: `bun run lint` and `bun run format`
- Docs (Next.js): `bun run docs` then open http://localhost:3000

Tip: You can target a single package with Turbo filters, e.g.:

```
bun run test --filter=@confkit/azure
bun run build --filter=@confkit/vite
```

Or run scripts directly inside a package:

```
cd packages/confkit-aws
bun run build && bun run test
```

## Making Changes

- Prefer small, focused PRs. Include tests and docs where relevant.
- Update or add docs under `docs/*.mdx` and/or the docs app in `apps/docs` when behavior changes.
- Run `bun run test` and ensure everything is green locally.
- If touching provider integrations, note any required environment variables in the PR and consider adding mocked tests when secrets are not available.

### Commit Style

Conventional commits are encouraged (e.g. `feat: …`, `fix: …`, `docs: …`, `refactor: …`, `chore: …`).

## Changesets & Releases

This repo uses Changesets for versioning and release notes.

- Add a changeset: `bun run changeset` and select affected packages and bump type.
- Write clear summaries; they become part of release notes.
- Maintainers merge the Changesets release PR; CI handles versioning and publish.

See `RELEASING.md` for full details on branches, dist-tags, and provenance.

## Running the Docs Locally

- Dev: `bun run docs` (opens the docs app under `apps/docs`)
- Build: `bun run docs:build`

Docs content lives in `docs/` (MD/MDX) and the app shell in `apps/docs`.

## Testing

- Unit tests: `bun run test` or target a scope with `--filter=…`.
- Watch mode: `bun run test:watch`
- Coverage: `bun run coverage`

Some provider tests may require credentials. When credentials aren’t available, prefer tests that stub or mock network calls.

## Labels & Triage

Standard labels are defined in `.github/labels.yml` and synced by a GitHub Action. Maintainers can run the “Sync Labels” workflow after label changes.

Recommended labels for triage: `bug`, `feat`, `provider`, `docs`, `good first issue`.

## Pull Request Checklist

- [ ] Tests added/updated and passing locally
- [ ] Docs updated (user-facing changes)
- [ ] Changeset added (`bun run changeset`)
- [ ] CI green and size checks reasonable

## Code of Conduct

By participating, you agree to abide by our Code of Conduct (`CODE_OF_CONDUCT.md`).

## Security

If you discover a security issue, please report it privately via GitHub Security Advisories:
https://github.com/alexdotpink/confkit/security/advisories/new

## Questions

Open an issue using the appropriate template or start a discussion if enabled. Thank you for helping improve Confkit!

