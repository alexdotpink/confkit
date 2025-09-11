# Releasing and Versioning

This repo uses Changesets to manage versions, changelogs, and publishing for all packages.

Semver policy:
- Core (`confkit`): follows semver. Breaking changes increment major. New features minor. Fixes patch.
- Integrations (`@confkit/next`, `@confkit/vite`, `@confkit/expo`): follow semver and align with core compatibility via peer ranges.
- Providers (`@confkit/*`): follow semver. Breaking changes when provider SDK usage or config shape changes.

Peer dependency ranges:
- All adapters/providers declare a conservative peer range for `confkit`: `>=0.0.1 <1.0.0` (updated as we move toward 1.0).
- Framework peers (e.g. `next`, `vite`) use broad ranges (e.g. `>=15`, `>=4`).

Branches and dist-tags:
- `main` → `latest` releases.
- `next` (or manual dispatch) → `next`/`beta` prereleases for breaking changes and previews.

How to cut a release:
1) Create a changeset: `bun run changeset` and select packages + bump types.
2) Merge the generated Release PR from the Changesets bot.
3) GitHub Actions on `main` will version, build, and publish with provenance.

How to cut a prerelease:
- Push to `next` branch with pending changesets, or run the manual workflow:
  - GitHub → Actions → Pre-Release → Run workflow → choose `next` or `beta`.

Notes:
- Publishing uses `--provenance` and requires `NPM_TOKEN` in repo secrets.
- All scoped packages publish with `access=public`.
- Changelogs are generated per package in each release.

